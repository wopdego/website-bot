import { logger } from '../utils/logger.js';
import { bookAppointment } from './google-calendar.js';

export function buildVoiceResponse(lead) {
  const biz = lead.businessName;
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';

  const greeting = lead.language === 'es'
    ? `¡Gracias por llamar a la recepcionista virtual de ${biz}! ¿Cómo puedo ayudarle hoy? Puede decir "quiero agendar una cita" o "tengo una pregunta".`
    : `Thank you for calling the virtual receptionist for ${biz}! How can I help you today? You can say "book an appointment" or "I have a question".`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${lang}">${escapeXml(greeting)}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="/voice/handle-input?leadId=${lead.id}" method="POST">
    <Say voice="Polly.Joanna" language="${lang}">${escapeXml(greeting)}</Say>
  </Gather>
</Response>`;
}

export function buildBookingPrompt(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const prompt = lead.language === 'es'
    ? 'Claro. ¿Qué día le gustaría agendar la cita?'
    : 'Sure. What day would you like to book the appointment?';
  return buildGatherXml(prompt, '/voice/handle-input?leadId=' + lead.id, lang);
}

export function buildTimePrompt(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const prompt = lead.language === 'es'
    ? '¿A qué hora le gustaría venir?'
    : 'What time would you like to come in?';
  return buildGatherXml(prompt, '/voice/handle-input?leadId=' + lead.id, lang);
}

export function buildNamePrompt(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const prompt = lead.language === 'es'
    ? '¿Me puede dar su nombre por favor?'
    : 'Can I get your name please?';
  return buildGatherXml(prompt, '/voice/handle-input?leadId=' + lead.id, lang);
}

export function buildPhonePrompt(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const prompt = lead.language === 'es'
    ? '¿Y su número de teléfono?'
    : 'And your phone number?';
  return buildGatherXml(prompt, '/voice/handle-input?leadId=' + lead.id, lang);
}

export function buildConfirmationXml(lead, summary) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const msg = lead.language === 'es'
    ? `Perfecto. Aquí tiene un resumen: ${summary}. ¿Está correcto? Diga "si" para confirmar o "no" para corregir.`
    : `Perfect. Here's a summary: ${summary}. Is this correct? Say "yes" to confirm or "no" to correct.`;
  return buildGatherXml(msg, '/voice/handle-input?leadId=' + lead.id, lang);
}

export function buildThankYouXml(lead) {
  const lang = lead.language === 'es' ? 'es-MX' : 'en-US';
  const msg = lead.language === 'es'
    ? `¡Excelente! Su cita ha sido agendada. Recibirá un recordatorio. ¡Gracias por llamar a ${lead.businessName}!`
    : `Excellent! Your appointment has been booked. You'll receive a reminder. Thank you for calling ${lead.businessName}!`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="${lang}">${escapeXml(msg)}</Say>
</Response>`;
}

function buildGatherXml(prompt, action, lang) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${action}" method="POST">
    <Say voice="Polly.Joanna" language="${lang}">${escapeXml(prompt)}</Say>
  </Gather>
</Response>`;
}

export async function handleConversationInput(lead, speechResult, session) {
  const lower = (speechResult || '').toLowerCase();
  const lang = lead.language || 'en';

  if (!session.step) session.step = 'greeting';

  switch (session.step) {
    case 'greeting':
      if (lower.includes('cita') || lower.includes('appointment') || lower.includes('book') || lower.includes('agendar') || lower.includes('schedule')) {
        session.step = 'ask_date';
        return buildBookingPrompt(lead);
      }
      if (lower.includes('pregunta') || lower.includes('question') || lower.includes('price') || lower.includes('precio') || lower.includes('cost') || lower.includes('costo') || lower.includes('cuanto')) {
        return buildGatherXml(
          lang === 'es' ? 'Le voy a pasar con el dueño. Un momento por favor.' : 'I\'ll connect you with the owner. One moment please.',
          '/voice/transfer?leadId=' + lead.id, lang
        );
      }
      return buildGatherXml(
        lang === 'es' ? 'Puede decir "agendar cita" o "tengo una pregunta". ¿Cómo puedo ayudarle?' : 'You can say "book appointment" or "I have a question". How can I help you?',
        '/voice/handle-input?leadId=' + lead.id, lang
      );

    case 'ask_date':
      session.appointmentDate = extractDate(lower, speechResult);
      if (!session.appointmentDate) {
        return buildGatherXml(
          lang === 'es' ? 'No entendí la fecha. Por ejemplo, diga "lunes que viene" o "mañana".' : 'I didn\'t catch the date. Try "next Monday" or "tomorrow".',
          '/voice/handle-input?leadId=' + lead.id, lang
        );
      }
      session.step = 'ask_time';
      return buildTimePrompt(lead);

    case 'ask_time':
      session.appointmentTime = extractTime(lower, speechResult);
      if (!session.appointmentTime) {
        return buildGatherXml(
          lang === 'es' ? 'No entendí la hora. Por ejemplo, diga "10 de la mañana" o "2 de la tarde".' : 'I didn\'t catch the time. Try "10am" or "2pm".',
          '/voice/handle-input?leadId=' + lead.id, lang
        );
      }
      session.step = 'ask_name';
      return buildNamePrompt(lead);

    case 'ask_name':
      session.customerName = speechResult;
      session.step = 'ask_phone';
      return buildPhonePrompt(lead);

    case 'ask_phone':
      session.customerPhone = speechResult.replace(/[^+\d]/g, '');
      if (session.customerPhone.length < 7) {
        return buildGatherXml(
          lang === 'es' ? 'No entendí el número. Por ejemplo, diga "703 555 1234".' : 'I didn\'t catch the number. Try "703 555 1234".',
          '/voice/handle-input?leadId=' + lead.id, lang
        );
      }
      session.step = 'confirm';
      const summary = lang === 'es'
        ? `Cita: ${session.appointmentDate} a las ${session.appointmentTime}. Nombre: ${session.customerName}. Teléfono: ${session.customerPhone}`
        : `Appointment: ${session.appointmentDate} at ${session.appointmentTime}. Name: ${session.customerName}. Phone: ${session.customerPhone}`;
      return buildConfirmationXml(lead, summary);

    case 'confirm':
      if (lower.includes('si') || lower.includes('yes') || lower.includes('correct') || lower.includes('ok')) {
        if (lead.googleRefreshToken) {
          try {
            await bookAppointment({
              refreshToken: lead.googleRefreshToken,
              businessName: lead.businessName,
              customerName: session.customerName,
              customerPhone: session.customerPhone || 'unknown',
              date: session.appointmentDate,
              time: session.appointmentTime,
            });
          } catch (err) {
            logger.error(`Failed to book calendar: ${err.message}`);
          }
        }
        session.completed = true;
        return buildThankYouXml(lead);
      }
      session.step = 'greeting';
      return buildBookingPrompt(lead);
  }

  return buildVoiceResponse(lead);
}

function extractDate(lower, raw) {
  const today = new Date();
  const dayMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
    lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };

  if (lower.includes('mañana') || lower.includes('tomorrow')) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
  }
  if (lower.includes('hoy') || lower.includes('today')) {
    return today.toISOString().split('T')[0];
  }

  for (const [name, dayNum] of Object.entries(dayMap)) {
    if (lower.includes(name)) {
      const d = new Date(today);
      d.setDate(d.getDate() + ((dayNum + 7 - d.getDay()) % 7 || 7));
      return d.toISOString().split('T')[0];
    }
  }

  const dateMatch = raw.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (dateMatch) {
    const m = dateMatch[1], d = dateMatch[2], y = dateMatch[3] || today.getFullYear();
    const fullYear = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

function extractTime(lower, raw) {
  const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|de la mañana|de la tarde|de la noche)?/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    let m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const suffix = (timeMatch[3] || '').toLowerCase();
    if (suffix.includes('pm') || suffix.includes('tarde') || suffix.includes('noche')) {
      if (h !== 12) h += 12;
    } else if (suffix.includes('am') || suffix.includes('mañana')) {
      if (h === 12) h = 0;
    } else if (h < 12) {
    } else if (h >= 12 && h < 18) {
    } else if (h >= 18) {
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return null;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
