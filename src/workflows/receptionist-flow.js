import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { updateLead, getLead, LeadStatus } from '../services/leads.js';
import { createCheckoutSession, createCustomer, createSubscription } from '../services/stripe.js';
import { findAvailableNumber, purchaseNumber, updateVoiceUrl } from '../services/twilio-provision.js';
import { getOAuthUrl } from '../services/google-calendar.js';
import { getContractHtml, saveContractPdf } from '../services/contract.js';
import { provisionDomain } from '../services/cloudflare-domains.js';
import { callLeadForDemo } from '../services/demo-caller.js';

export { callLeadForDemo };

export async function handleReceptionistInterested(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');

  const setupPrice = config.stripe.prices.receptionistSetup || 'price_receptionist_setup';

  const session = await createCheckoutSession({
    price: setupPrice,
    leadId,
    metadata: { product: 'receptionist', payment_stage: 'receptionist_setup' },
    customerEmail: lead.email || undefined,
    successUrl: `${config.bot.publicUrl}/receptionist/contract?leadId=${leadId}`,
  });

  updateLead(leadId, {
    status: LeadStatus.RECEPTIONIST_INTERESTED,
  });

  logger.info(`Receptionist setup link sent to ${lead.businessName}: ${session.url}`);
  return session.url;
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
