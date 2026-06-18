import express from 'express';
import { CronJob } from 'cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { sendBoth } from './services/outreach.js';
import { constructWebhookEvent } from './services/stripe.js';
import { getLeadsReadyForOutreach, addLead, getAllLeads, getLeadByEmail, updateLead, LeadStatus, getLeadsByStatus, getLead } from './services/leads.js';
import { handleUpfrontPayment, handleFinalPayment, handleLeadInterested, handleApproval } from './workflows/client-flow.js';
import { scrapeAllCities } from './services/lead-scraper.js';
import { handleReceptionistInterested, handleReceptionistSetupPaid, handleCalendarLinked, buildReceptionistSms, callLeadForDemo } from './workflows/receptionist-flow.js';
import { buildVoiceResponse, handleConversationInput } from './services/voice-agent.js';
import { buildDemoVoiceResponse, buildDemoFollowUpTwiML } from './services/demo-caller.js';
import { getOAuthUrl, handleOAuthCallback } from './services/google-calendar.js';
import { getContractHtml } from './services/contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/preview/:leadId', (req, res) => {
  const sitePath = path.resolve(__dirname, '../sites', req.params.leadId, 'index.html');
  res.sendFile(sitePath, (err) => {
    if (err) res.status(404).send('Site preview not found');
  });
});

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = constructWebhookEvent(req.body, sig);
    logger.info(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const leadId = session.metadata?.leadId;
        const paymentStage = session.metadata?.payment_stage;

        if (!leadId) {
          logger.warn('No leadId in session metadata');
          break;
        }

        if (paymentStage === 'upfront') {
          await handleUpfrontPayment(leadId);
        } else if (paymentStage === 'final') {
          await handleFinalPayment(leadId);
        } else if (paymentStage === 'receptionist_setup') {
          await handleReceptionistSetupPaid(leadId);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const invLeadId = invoice.metadata?.leadId;

        if (!invLeadId) {
          logger.info(`Invoice paid (no leadId): ${invoice.id}`);
          break;
        }

        const lineItem = Array.isArray(invoice.lines?.data) ? invoice.lines.data.find(l => l.description) : null;
        const description = lineItem?.description || '';
        logger.info(`Invoice paid for lead ${invLeadId}: ${invoice.id} (${description})`);

        if (description.includes('Website Upfront') || description.includes('website upfront')) {
          await handleUpfrontPayment(invLeadId);
        } else if (description.includes('Website Final') || description.includes('website final')) {
          await handleFinalPayment(invLeadId);
        } else if (description.includes('Receptionist Setup') || description.includes('receptionist setup')) {
          const { handleReceptionistSetupPaid } = await import('./workflows/receptionist-flow.js');
          await handleReceptionistSetupPaid(invLeadId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        logger.info(`Payment succeeded for customer: ${event.data.object.customer}`);
        break;
      }

      case 'invoice.payment_failed': {
        logger.warn(`Payment failed for customer: ${event.data.object.customer}`);
        break;
      }

      case 'customer.subscription.deleted': {
        logger.warn(`Subscription cancelled: ${event.data.object.id}`);
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.post('/webhooks/twilio', express.urlencoded({ extended: false }), async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim().toLowerCase();

  logger.info(`Twilio SMS from ${from}: "${body}"`);

  const lead = getAllLeads().find(l => l.phone === from);
  if (!lead) {
    logger.warn(`No lead found for phone ${from}`);
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, I don't have your info on file. Text your business name to get started.</Message></Response>`);
  }

  const positiveWords = ['yes', 'si', 'yeah', 'yep', 'interested', 'me interesa', 'quiero', 'ok', 'sure', 'go ahead', 'approve', 'aprobar', 'si quiero'];
  const isPositive = positiveWords.some(w => body.includes(w));

  const receptionistInterest =
    body.includes('receptionist') || body.includes('recepcionista') ||
    body.includes('call') || body.includes('llamada') ||
    body.includes('answer') || body.includes('contestar') ||
    body.includes('demo') || body.includes('quiero escuchar') ||
    lead.offerStage === 'receptionist';

  if (isPositive && (lead.offerStage === 'receptionist' || (lead.status === 'contacted' && (lead.website || receptionistInterest)))) {
    logger.info(`Receptionist interest from ${lead.businessName}. Triggering demo call...`);
    try {
      const msg = lead.language === 'es'
        ? `¡Genial! Le voy a llamar ahora mismo para que escuche cómo funciona nuestra recepcionista AI.`
        : `Great! I'll call you right now so you can hear our AI receptionist in action.`;
      sendSMS(lead.phone, msg);

      const { sendSMS } = await import('./services/outreach.js');
      await sendSMS(lead.phone, msg);

      await callLeadForDemo(lead.id);

      return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`);
    } catch (err) {
      logger.error(`Demo call error: ${err.message}`);
    }
  }

  if (isPositive && lead.status === 'contacted') {
    logger.info(`Auto-detected interest from ${lead.businessName}`);
    try {
      const link = await handleLeadInterested(lead.id);
      const msg = lead.language === 'es'
        ? `¡Genial! Usa este enlace para pagar los $500 iniciales y empezamos su sitio web: ${link}`
        : `Great! Use this link to pay the $500 deposit and we'll start building your site: ${link}`;
      return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`);
    } catch (err) {
      logger.error(`Auto-response error: ${err.message}`);
    }
  }

  if (isPositive && lead.status === 'preview_sent') {
    logger.info(`Auto-detected approval from ${lead.businessName}`);
    try {
      const link = await handleApproval(lead.id);
      const msg = lead.language === 'es'
        ? `¡Perfecto! Pague los $500 finales aquí: ${link} y publicamos su sitio.`
        : `Perfect! Pay the final $500 here: ${link} and we'll publish your site.`;
      return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`);
    } catch (err) {
      logger.error(`Auto-response error: ${err.message}`);
    }
  }

  const negativeWords = ['no', 'not interested', 'stop', 'don\'t', 'dont', 'no me interesa', 'cancel'];
  const isNegative = negativeWords.some(w => body.includes(w));
  if (isNegative) {
    if (lead.status === 'contacted' || lead.status === 'new') {
      const receptionistMsg = lead.language === 'es'
        ? `Entendido. ¿Qué tal una recepcionista AI que conteste sus llamadas 24/7 y agende citas automáticamente? Solo $2,995 setup + $299/mes. Responda "SI" para escuchar una demo.`
        : `No problem. What about an AI receptionist that answers your calls 24/7 and books appointments automatically? $2,995 setup + $299/mo. Reply "YES" to hear a live demo.`;
      updateLead(lead.id, { offerStage: 'receptionist' });
      return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${receptionistMsg}</Message></Response>`);
    }
    updateLead(lead.id, { status: LeadStatus.DECLINED });
    const msg = lead.language === 'es'
      ? `Entendido. Si cambia de opinión, responda "SI" en cualquier momento.`
      : `Understood. If you change your mind, reply "YES" anytime.`;
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`);
  }

  if (lead.offerStage === 'receptionist') {
    const receptionistMsg = lead.language === 'es'
      ? `Responda "SI" para escuchar una demo de nuestra recepcionista AI, o "NO" para cancelar.`
      : `Reply "YES" to hear a demo of our AI receptionist, or "NO" to decline.`;
    return res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${receptionistMsg}</Message></Response>`);
  }

  const autoReply = lead.language === 'es'
    ? `Responda "SI" para un sitio web, "RECEPCIONISTA" para una recepcionista AI, o "NO".`
    : `Reply "YES" for a website, "RECEPTIONIST" for an AI receptionist, or "NO".`;
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${autoReply}</Message></Response>`);
});

const voiceSessions = {};

app.post('/voice/incoming', (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).type('text/xml').send('<Response><Say>Error</Say></Response>');

  voiceSessions[leadId] = { step: 'greeting', completed: false };
  updateLead(leadId, { callCount: (lead.callCount || 0) + 1 });
  logger.info(`Incoming call for ${lead.businessName}`);

  res.type('text/xml').send(buildVoiceResponse(lead));
});

app.post('/voice/handle-input', async (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).type('text/xml').send('<Response><Say>Error</Say></Response>');

  const speechResult = req.body.SpeechResult;
  const session = voiceSessions[leadId] || { step: 'greeting', completed: false };

  if (session.completed) {
    return res.type('text/xml').send(buildVoiceResponse(lead));
  }

  const twiml = await handleConversationInput(lead, speechResult, session);

  if (session.completed) {
    updateLead(leadId, { appointmentsBooked: (lead.appointmentsBooked || 0) + 1 });
  }

  res.type('text/xml').send(twiml);
});

const demoVoiceSessions = {};

app.get('/receptionist/contract', (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).send('Lead not found');

  const html = getContractHtml({
    product: 'receptionist',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  res.send(html);
});

app.get('/website/contract', (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).send('Lead not found');

  const html = getContractHtml({
    product: 'website',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  res.send(html);
});

app.post('/voice/demo', (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).type('text/xml').send('<Response><Say>Error</Say></Response>');

  demoVoiceSessions[leadId] = {};
  logger.info(`Demo call connected for ${lead.businessName}`);

  res.type('text/xml').send(buildDemoVoiceResponse(lead));
});

app.post('/voice/demo-input', async (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  if (!lead) return res.status(404).type('text/xml').send('<Response><Say>Error</Say></Response>');

  const speechResult = req.body.SpeechResult;
  const result = buildDemoFollowUpTwiML(lead, speechResult);

  if (result.interested === true) {
    const link = await handleReceptionistInterested(leadId);
    const msg = lead.language === 'es'
      ? `Le envié el enlace de pago por mensaje de texto.`
      : `I've sent you the payment link by text message.`;
    const { sendSMS } = await import('./services/outreach.js');
    await sendSMS(lead.phone, lead.language === 'es'
      ? `¡Excelente! Use este enlace para pagar los $2,995 y activamos su recepcionista AI: ${link}`
      : `Excellent! Use this link to pay the $2,995 setup and we'll activate your AI receptionist: ${link}`
    );
  }

  res.type('text/xml').send(result.twiml);
});

app.post('/voice/transfer', (req, res) => {
  const leadId = req.query.leadId;
  const lead = getLead(leadId);
  const lang = lead?.language === 'es' ? 'es-MX' : 'en-US';
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${lang}">${lead?.language === 'es' ? 'Transferiendo su llamada. Un momento por favor.' : 'Transferring your call. One moment please.'}</Say>
</Response>`);
});

app.post('/api/receptionist/notify/:id', async (req, res) => {
  try {
    const lead = getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const msg = buildReceptionistSms(lead);
    const { sendSMS } = await import('./services/outreach.js');
    const result = await sendSMS(lead.phone, msg);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/receptionist/interested/:id', async (req, res) => {
  try {
    const link = await handleReceptionistInterested(req.params.id);
    res.json({ success: true, paymentLink: link });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/receptionist/oauth', (req, res) => {
  const leadId = req.query.leadId;
  if (!leadId) return res.status(400).send('Missing leadId');
  const url = getOAuthUrl(leadId);
  res.redirect(url);
});

app.get('/receptionist/oauth/callback', async (req, res) => {
  try {
    const { code, state: leadId } = req.query;
    if (!code || !leadId) return res.status(400).send('Missing code or state');

    const refreshToken = await handleOAuthCallback(code);
    const result = await handleCalendarLinked(leadId, refreshToken);

    res.send(`<h1>AI Receptionist Live!</h1><p>${result.message}</p><p>Your dedicated number: <strong>${result.phoneNumber}</strong></p>`);
  } catch (err) {
    logger.error(`OAuth callback failed: ${err.message}`);
    res.status(500).send(`Setup failed: ${err.message}`);
  }
});

app.get('/api/receptionist/stats', (req, res) => {
  const all = getAllLeads();
  res.json({
    total: all.length,
    receptionistLive: all.filter(l => l.status === LeadStatus.RECEPTIONIST_LIVE).length,
    totalCalls: all.reduce((s, l) => s + (l.callCount || 0), 0),
    totalAppointments: all.reduce((s, l) => s + (l.appointmentsBooked || 0), 0),
    monthlyRecurring: all.filter(l => l.status === LeadStatus.RECEPTIONIST_LIVE).length * 299,
  });
});

app.get('/dashboard', (req, res) => {
  const all = getAllLeads();
  const rows = all.map(l => `
    <tr>
      <td>${l.businessName}</td>
      <td>${l.phone || ''}</td>
      <td>${l.email || ''}</td>
      <td><span class="status status-${l.status}">${l.status}</span></td>
      <td>${l.offerStage || 'website'}</td>
      <td>${l.language || 'en'}</td>
      <td>${l.twilioPhoneNumber || ''}</td>
      <td>${l.callCount || 0}</td>
      <td>${l.appointmentsBooked || 0}</td>
      <td>${l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''}</td>
      <td>
        ${l.stripeSubscriptionId
          ? `<a href="https://dashboard.stripe.com/subscriptions/${l.stripeSubscriptionId}" target="_blank">View</a>`
          : ''}
        ${l.previewUrl ? `<a href="${l.previewUrl}" target="_blank">Preview</a>` : ''}
        ${l.liveUrl ? `<a href="${l.liveUrl}" target="_blank">Live</a>` : ''}
      </td>
    </tr>`).join('');

  const liveCount = all.filter(l => l.status === LeadStatus.RECEPTIONIST_LIVE || l.status === LeadStatus.LIVE).length;
  const contactedToday = all.filter(l => l.lastOutreachAt && new Date(l.lastOutreachAt).toDateString() === new Date().toDateString()).length;
  const mrr = all.filter(l => l.status === LeadStatus.RECEPTIONIST_LIVE).length * 299 + all.filter(l => l.status === LeadStatus.LIVE).length * 99;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kevin's Lead Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; color: #f8fafc; }
  .contact { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
  .contact a { color: #38bdf8; text-decoration: none; }
  .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat-card { background: #1e293b; border-radius: 12px; padding: 16px 24px; min-width: 120px; }
  .stat-card .num { font-size: 28px; font-weight: 700; color: #f8fafc; }
  .stat-card .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; font-size: 13px; }
  th { background: #334155; color: #94a3b8; text-align: left; padding: 12px; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #334155; }
  tr:hover { background: #1e3a5f; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .status-new { background: #1e3a5f; color: #60a5fa; }
  .status-contacted { background: #1e3a5f; color: #fbbf24; }
  .status-interested { background: #1e3a5f; color: #34d399; }
  .status-receptionist_live { background: #064e3b; color: #6ee7b7; }
  .status-live { background: #064e3b; color: #6ee7b7; }
  .status-declined { background: #3b1e1e; color: #f87171; }
  a { color: #38bdf8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .actions { display: flex; gap: 4px; flex-wrap: wrap; }
  .btn { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #334155; color: #e2e8f0; text-decoration: none; }
  .btn:hover { background: #475569; }
</style>
</head>
<body>
  <h1>Lead Dashboard</h1>
  <div class="contact">Kevin Regan — <a href="tel:2402702646">240-270-2646</a> | <a href="https://github.com/wopdego/website-bot">GitHub</a> | <a href="/api/receptionist/stats">API Stats</a> | <a href="/health">Health</a></div>

  <div class="stats">
    <div class="stat-card"><div class="num">${all.length}</div><div class="label">Total Leads</div></div>
    <div class="stat-card"><div class="num">${liveCount}</div><div class="label">Active Clients</div></div>
    <div class="stat-card"><div class="num">${contactedToday}</div><div class="label">Contacted Today</div></div>
    <div class="stat-card"><div class="num">$${mrr}</div><div class="label">Monthly MRR</div></div>
    <div class="stat-card"><div class="num">${all.reduce((s, l) => s + (l.callCount || 0), 0)}</div><div class="label">Total Calls</div></div>
  </div>

  <table>
    <thead><tr>
      <th>Business</th><th>Phone</th><th>Email</th><th>Status</th><th>Offer</th><th>Lang</th><th>AI Number</th><th>Calls</th><th>Bookings</th><th>Added</th><th>Links</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
});

app.post('/api/leads', (req, res) => {
  try {
    const { businessName, email, phone, industry, location, notes, language } = req.body;
    if (!businessName || (!email && !phone)) {
      return res.status(400).json({ error: 'businessName and email or phone required' });
    }
    const lead = addLead({ businessName, email, phone, industry, location, notes, language: language || 'en' });
    logger.info(`Lead added via API: ${businessName}`);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leads/:id/respond', express.json(), async (req, res) => {
  try {
    const { response } = req.body;
    const lead = getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    switch (response) {
      case 'interested':
        const link = await handleLeadInterested(lead.id);
        return res.json({ success: true, message: 'Interest recorded', paymentLink: link });
      case 'not_interested':
        updateLead(lead.id, { status: LeadStatus.DECLINED });
        return res.json({ success: true, message: 'Marked as declined' });
      case 'approved':
        const finalLink = await handleApproval(lead.id);
        return res.json({ success: true, paymentLink: finalLink });
      default:
        return res.status(400).json({ error: 'Invalid response' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', (req, res) => {
  const { status } = req.query;
  if (!status) return res.json(getAllLeads());
  res.json(getLeadsByStatus(status));
});

app.get('/api/leads/:email', (req, res) => {
  const lead = getLeadByEmail(req.params.email);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

app.post('/api/domain/register', async (req, res) => {
  try {
    const { leadId, domain } = req.body;
    if (!leadId || !domain) return res.status(400).json({ error: 'leadId and domain required' });

    const lead = getLead(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const { provisionDomain } = await import('./services/cloudflare-domains.js');
    const vercelTarget = `${leadId}.vercel.app`;
    const result = await provisionDomain(domain, vercelTarget);

    updateLead(leadId, { liveUrl: `https://${domain}` });
    logger.info(`Domain ${domain} configured for ${lead.businessName}`);

    res.json({ success: true, domain, nameServers: result.nameServers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    res.json({ status: 'started' });
    const count = await scrapeAllCities();
    logger.info(`Manual scrape done: ${count} new leads`);
  } catch (err) {
    logger.error(`Manual scrape failed: ${err.message}`);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const outreachJob = new CronJob('0 9 * * 1-5', async () => {
  logger.info('Starting daily outreach cycle...');

  const leads = getLeadsReadyForOutreach();
  const toSend = leads.slice(0, config.bot.maxDailyOutreach);

  logger.info(`Found ${leads.length} leads ready, sending ${toSend.length}`);

  for (const lead of toSend) {
    try {
      const template = lead.outreachCount === 0 ? 'initial' : 'followUp';
      await sendBoth(lead.email, lead.phone, template, { businessName: lead.businessName }, lead.language || 'en');

      updateLead(lead.id, {
        status: LeadStatus.CONTACTED,
        contactedAt: new Date().toISOString(),
        outreachCount: lead.outreachCount + 1,
        lastOutreachAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(`Failed outreach to ${lead.email}:`, err.message);
    }
  }

  logger.info(`Outreach complete. Sent: ${toSend.length}`);
});

app.listen(config.bot.port, () => {
  logger.info(`Website Bot running on http://localhost:${config.bot.port}`);
  logger.info(`  Stripe webhooks:      POST /webhooks/stripe`);
  logger.info(`  Twilio SMS:           POST /webhooks/twilio`);
  logger.info(`  Add leads:            POST /api/leads`);
  logger.info(`  Auto-scrape:          POST /api/scrape`);
  logger.info(`  View leads:           GET  /api/leads`);
  logger.info(`  Site previews:        GET  /preview/:leadId`);
  logger.info(`  Voice incoming:       POST /voice/incoming`);
  logger.info(`  Voice input handler:  POST /voice/handle-input`);
  logger.info(`  Receptionist notify:  POST /api/receptionist/notify/:id`);
  logger.info(`  Receptionist oauth:   GET  /receptionist/oauth`);
  logger.info(`  Receptionist stats:   GET  /api/receptionist/stats`);
  logger.info(`  Demo call:            POST /voice/demo`);
  logger.info(`  Demo input:           POST /voice/demo-input`);
  logger.info(`  Website contract:     GET  /website/contract`);
  logger.info(`  Receptionist contract:GET  /receptionist/contract`);
  logger.info(`  Domain register:      POST /api/domain/register`);
  logger.info(`  Dashboard:            GET  /dashboard`);

  const scrapeJob = new CronJob('0 8 * * 1', async () => {
    logger.info('Starting weekly lead scrape...');
    await scrapeAllCities();
  });
  scrapeJob.start();

  outreachJob.start();
  logger.info('Outreach scheduler started (Mon-Fri 9am)');
  logger.info('Scrape scheduler started (Monday 8am)');
});
