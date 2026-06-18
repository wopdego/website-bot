import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { updateLead, getLead, LeadStatus } from '../services/leads.js';
import { createInvoice, createCustomer, createSubscription } from '../services/stripe.js';
import { findAvailableNumber, purchaseNumber, updateVoiceUrl } from '../services/twilio-provision.js';
import { getOAuthUrl } from '../services/google-calendar.js';
import { getContractHtml, saveContractPdf } from '../services/contract.js';
import { provisionDomain } from '../services/cloudflare-domains.js';
import { callLeadForDemo } from '../services/demo-caller.js';
import { sendBoth } from '../services/outreach.js';

export { callLeadForDemo };

export async function handleReceptionistInterested(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  let customerId = lead.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      email: lead.email || undefined,
      name: lead.businessName,
      phone: lead.phone,
    });
    customerId = customer.id;
  }

  updateLead(leadId, { stripeCustomerId: customerId });

  const html = getContractHtml({
    product: 'receptionist',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  saveContractPdf(leadId, html);

  const invoice = await createInvoice({
    customerId,
    priceId: config.stripe.prices.receptionistSetup || 'price_receptionist_setup',
    leadId,
    description: 'AI Receptionist Setup — one-time fee',
    daysUntilDue: 15,
  });

  updateLead(leadId, { status: LeadStatus.RECEPTIONIST_INTERESTED });

  const invoiceUrl = invoice.hosted_invoice_url;
  logger.info(`Receptionist invoice sent to ${lead.businessName}: ${invoiceUrl}`);
  return invoiceUrl;
}

export async function handleReceptionistSetupPaid(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  logger.info(`Receptionist setup paid for ${lead.businessName}. Generating contract...`);

  const html = getContractHtml({
    product: 'receptionist',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  const contractPath = saveContractPdf(leadId, html);

  updateLead(leadId, { status: LeadStatus.RECEPTIONIST_CALENDAR_LINKED });

  const oauthUrl = getOAuthUrl(leadId);
  return { oauthUrl, contractPath };
}

export async function handleCalendarLinked(leadId, refreshToken) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  updateLead(leadId, { googleRefreshToken: refreshToken });
  logger.info(`Calendar linked for ${lead.businessName}`);

  const areaCode = extractAreaCode(lead.location);
  const available = await findAvailableNumber(areaCode);

  const voiceUrl = `${config.bot.publicUrl}/voice/incoming?leadId=${leadId}`;
  const purchased = await purchaseNumber(available, voiceUrl);

  updateLead(leadId, {
    status: LeadStatus.RECEPTIONIST_PROVISIONED,
    phoneNumberSid: purchased.sid,
    twilioPhoneNumber: purchased.phoneNumber,
  });

  const subscriptionPrice = config.stripe.prices.receptionistMonthly || 'price_receptionist_monthly';
  let customerId = lead.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      email: lead.email || undefined,
      name: lead.businessName,
      phone: lead.phone,
    });
    customerId = customer.id;
  }

  const subscription = await createSubscription(customerId, subscriptionPrice);

  updateLead(leadId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: LeadStatus.RECEPTIONIST_LIVE,
  });

  const msg = lead.language === 'es'
    ? `¡Su recepcionista AI está activa! Número: ${purchased.phoneNumber}. Los clientes que llamen serán atendidos automáticamente.`
    : `Your AI receptionist is live! Number: ${purchased.phoneNumber}. Incoming callers will be handled automatically.`;

  return {
    phoneNumber: purchased.phoneNumber,
    subscriptionId: subscription.id,
    message: msg,
  };
}

function extractAreaCode(location) {
  const match = (location || '').match(/\b(20[0-9]{2})\b/);
  if (match) {
    const areaMap = {
      '20109': '571', '20110': '571', '20111': '571', '20112': '571',
      '20155': '571', '20169': '571', '20136': '571',
      '22030': '703', '22031': '703', '20151': '703',
      '22191': '703', '22192': '703', '22193': '703',
      '22401': '540', '22406': '540',
      '22701': '540',
    };
    return areaMap[match[1]] || '571';
  }
  return '571';
}

export async function handleBundleInterested(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  let customerId = lead.stripeCustomerId;
  if (!customerId) {
    const customer = await createCustomer({
      email: lead.email || undefined,
      name: lead.businessName,
      phone: lead.phone,
    });
    customerId = customer.id;
  }

  updateLead(leadId, { stripeCustomerId: customerId });

  const html = getContractHtml({
    product: 'receptionist',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  saveContractPdf(leadId, html);

  const invoice = await createInvoice({
    customerId,
    priceId: config.stripe.prices.bundleSetup || 'price_bundle_setup',
    leadId,
    description: 'Website + AI Receptionist Bundle — save $500',
    daysUntilDue: 15,
  });

  updateLead(leadId, { status: LeadStatus.INTERESTED, offerBundle: true });

  const invoiceUrl = invoice.hosted_invoice_url;
  logger.info(`Bundle invoice sent to ${lead.businessName}: ${invoiceUrl}`);
  return invoiceUrl;
}

export function buildBundleSms(lead) {
  const lang = lead.language || 'en';
  if (lang === 'es') {
    return `🔥 Oferta especial: sitio web + recepcionista AI juntos. Ahorre $500. $2,997 setup, $398/mes los dos. Sitio web profesional + AI que contesta 24/7. Responda "AMBOS" para más info. ~Kevin, 240-270-2646`;
  }
  return `🔥 Special offer: website + AI receptionist together. Save $500. $2,997 setup, $398/mo for both. Professional site + AI that answers 24/7. Reply "BOTH" for details. ~Kevin, 240-270-2646`;
}

export async function handleBundlePaid(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  logger.info(`Bundle paid for ${lead.businessName}. Starting both builds...`);

  updateLead(leadId, { status: LeadStatus.UPFRONT_PAID, offerStage: 'bundle' });

  await sendBoth(lead.email, lead.phone, 'paymentReceived', { businessName: lead.businessName }, lead.language || 'en');

  updateLead(leadId, { status: LeadStatus.SITE_BUILDING });

  try {
    const { generateAndSaveSite, deployToVercel } = await import('../services/deploy.js');
    const { html, previewUrl } = await generateAndSaveSite(lead);

    let vercelInfo = {};
    try {
      vercelInfo = await deployToVercel(lead, html);
    } catch (deployErr) {
      logger.warn(`Vercel deploy failed: ${deployErr.message}`);
    }

    const areaCode = extractAreaCode(lead.location);
    const available = await findAvailableNumber(areaCode);
    const voiceUrl = `${config.bot.publicUrl}/voice/incoming?leadId=${leadId}`;
    const purchased = await purchaseNumber(available, voiceUrl);

    updateLead(leadId, {
      status: LeadStatus.PREVIEW_SENT,
      previewUrl,
      liveUrl: vercelInfo.liveUrl || null,
      phoneNumberSid: purchased.sid,
      twilioPhoneNumber: purchased.phoneNumber,
    });

    await sendBoth(lead.email, lead.phone, 'previewReady', {
      businessName: lead.businessName,
      previewUrl: vercelInfo.liveUrl || previewUrl,
    }, lead.language || 'en');

    const msg = lead.language === 'es'
      ? `Su sitio web está listo para revisar. Su número de recepcionista AI: ${purchased.phoneNumber} ya está activo.`
      : `Your website is ready to review. Your AI receptionist number: ${purchased.phoneNumber} is already live.`;
    const { sendSMS } = await import('../services/outreach.js');
    await sendSMS(lead.phone, msg);

    logger.info(`Bundle preview + number sent to ${lead.businessName}`);
  } catch (err) {
    logger.error(`Bundle build failed for ${lead.businessName}: ${err.message}`);
  }
}

export function buildReceptionistSms(lead) {
  const lang = lead.language || 'en';
  if (lang === 'es') {
    return `¿Sabía que ${lead.businessName} pierde llamadas? Nuestra recepcionista AI contesta 24/7, agenda citas a su calendario automáticamente. $2,995 setup + $299/mes. ¿Le interesa?`;
  }
  return `Did you know ${lead.businessName} misses calls? Our AI receptionist answers 24/7, books appointments to your calendar automatically. $2,995 setup + $299/mo. Interested?`;
}

export function buildReceptionistEmail(lead) {
  const lang = lead.language || 'en';
  if (lang === 'es') {
    return {
      subject: `Recepcionista AI para ${lead.businessName}`,
      body: `Hola,

¿Sabía que los plomeros pierden hasta el 30% de las llamadas entrantes? Cada llamada perdida es un trabajo de $500+ que nunca llama de vuelta.

Nuestra recepcionista AI:
• Contesta el teléfono 24/7, 365 días al año
• Habla inglés y español
• Agenda citas directamente a su calendario de Google
• Nunca se enferma, nunca toma descansos
• Envía recordatorios automáticos

Inversión única: $2,995 (configuración + número dedicado)
Mensualidad: $299/mes

¿Quiere una demo? Responda este mensaje.

Saludos,
[Your Name]`,
    };
  }
  return {
    subject: `AI Receptionist for ${lead.businessName}`,
    body: `Hi,

Did you know plumbers miss up to 30% of incoming calls? Each missed call is a $500+ job that never calls back.

Our AI receptionist:
• Answers the phone 24/7, 365 days a year
• Speaks English and Spanish
• Books appointments directly to your Google Calendar
• Never gets sick, never takes breaks
• Sends automatic reminders

One-time setup: $2,995 (includes dedicated phone number)
Monthly: $299/mo

Want a demo? Reply to this message.

Best,
[Your Name]`,
  };
}
