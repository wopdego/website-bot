import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { getLead, updateLead, LeadStatus } from './leads.js';

export async function callLeadForDemo(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error('Lead not found');
  if (!lead.phone) throw new Error('Lead has no phone number');

  const twilio = await import('twilio');
  const client = twilio(config.outreach.twilio.accountSid, config.outreach.twilio.authToken);

  const demoWebhook = `${config.bot.publicUrl}/voice/demo?leadId=${leadId}`;

  const call = await client.calls.create({
    to: lead.phone,
    from: config.outreach.twilio.fromNumber,
    url: demoWebhook,
    machineDetection: 'DetectMessageEnd',
    asyncAmd: true,
    asyncAmdStatusCallback: `${config.bot.publicUrl}/voice/demo-voicemail?leadId=${leadId}`,
  });

  updateLead(leadId, { status: LeadStatus.RECEPTIONIST_INTERESTED });

  logger.info(`Demo call initiated to ${lead.businessName} (${lead.phone}) — Call SID: ${call.sid}`);
  return call.sid;
}

export function buildDemoVoiceResponse(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const biz = lead.businessName;

  const intro = lead.language === 'es'
    ? `Hola, soy la recepcionista virtual de ${biz}. Le estoy llamando para mostrarle cómo puedo contestar sus llamadas y agendar citas automáticamente. Diga "si" o haga una pregunta.`
    : `Hello, I'm the virtual receptionist for ${biz}. I'm calling to show you how I can answer your calls and book appointments automatically. Say "yes" or ask a question.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${lang}">${intro}</Say>
  <Gather input="speech" timeout="8" speechTimeout="auto" action="/voice/demo-input?leadId=${lead.id}" method="POST">
    <Say voice="Polly.Joanna" language="${lang}">${intro}</Say>
  </Gather>
</Response>`;
}

export function buildDemoFollowUpTwiML(lead, speechResult) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const lower = (speechResult || '').toLowerCase();

  if (lower.includes('si') || lower.includes('yes') || lower.includes('like') || lower.includes('me gusta') || lower.includes('quiero')) {
    const outro = lead.language === 'es'
      ? `¡Excelente! Le voy a enviar un enlace por mensaje de texto para que pueda empezar. Tiene un equipo dedicado esperando su confirmación. ¡Gracias por su tiempo!`
      : `Excellent! I'll send you a link by text message to get started. Our team is ready to help. Thank you for your time!`;
    return {
      twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna" language="${lang}">${outro}</Say></Response>`,
      interested: true,
    };
  }

  if (lower.includes('no') || lower.includes('not interested') || lower.includes('stop')) {
    const outro = lead.language === 'es'
      ? `Entendido. Si cambia de opinión, solo responda "SI" a nuestro mensaje. ¡Gracias!`
      : `Understood. If you change your mind, just reply "YES" to our message. Thank you!`;
    return {
      twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna" language="${lang}">${outro}</Say></Response>`,
      interested: false,
    };
  }

  const demo = lead.language === 'es'
    ? `Puedo agendar citas, responder preguntas sobre horarios y servicios, y nunca pierdo una llamada. ¿Le gustaría probarlo? Diga "si" o "no".`
    : `I can book appointments, answer questions about hours and services, and I never miss a call. Would you like to give it a try? Say "yes" or "no".`;
  return {
    twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${lang}">${demo}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/voice/demo-input?leadId=${lead.id}" method="POST">
    <Say voice="Polly.Joanna" language="${lang}">${demo}</Say>
  </Gather>
</Response>`,
    interested: null,
  };
}
