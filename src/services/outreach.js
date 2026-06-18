import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const SMS_TEMPLATES = {
  en: {
    initial: (biz) => `⚠️ ${biz} losing customers without a website. 78% search online before hiring. I'll build you one in 48hrs — net-15 terms, $500 start. Reply YES for a free preview. ~Kevin, 240-270-2646`,
    followUp: (biz) => `${biz} — still thinking? Every day without a site = missed jobs. $500 start on net-15 terms, preview ready today. Reply YES. ~Kevin, 240-270-2646`,
    receptionist: (biz) => `${biz} misses 1 in 3 calls = $10k+/yr lost. AI receptionist answers 24/7, books jobs to your calendar. $299/mo. Net-15 terms on setup. Want a live demo? Reply YES. ~Kevin, 240-270-2646`,
    paymentReceived: (biz) => `🚀 ${biz} — payment received! We're building your site now. Preview in 24-48hrs. Get ready for more calls.`,
    previewReady: (biz, url) => `🔥 ${biz} — your site preview is ready! See it here: ${url}. Want changes? Reply. Happy? Type APPROVE and we go live today.`,
    siteLive: (biz, url) => `🎉 ${biz} is LIVE at ${url}! Your $99/mo plan is active. Now every online search finds you. Welcome!`,
  },
  es: {
    initial: (biz) => `⚠️ ${biz} pierde clientes sin web. 78% busca antes de contratar. Se la hago en 48hrs — términos net-15, $500 inicio. ¿Vista previa? Responda SI. ~Kevin, 240-270-2646`,
    followUp: (biz) => `${biz} — cada día sin web = trabajos perdidos. $500 inicio en net-15, preview hoy. Responda SI. ~Kevin, 240-270-2646`,
    receptionist: (biz) => `${biz} pierde 1 de 3 llamadas = $10k+/año perdidos. Recepcionista AI contesta 24/7, agenda citas. $299/mes. Net-15 en setup. ¿Demo? Responda SI. ~Kevin, 240-270-2646`,
    paymentReceived: (biz) => `🚀 ${biz} — ¡pago recibido! Ya construimos su sitio. Vista previa en 24-48hrs. Prepárese para más llamadas.`,
    previewReady: (biz, url) => `🔥 ${biz} — ¡vista previa lista! Véala aquí: ${url}. ¿Cambios? Responda. ¿Feliz? Escriba APROBAR y publicamos hoy.`,
    siteLive: (biz, url) => `🎉 ¡${biz} ya está EN VIVO en ${url}! Su plan de $99/mes está activo. Ahora cada búsqueda en línea lo encuentra. ¡Bienvenido!`,
  },
};

const EMAIL_TEMPLATES = {
  en: {
    receptionist: (biz) => ({
      subject: `${biz} is losing 1 in 3 calls to voicemail. That's $40k+/yr.`,
      body: `${biz} — I'll keep this short.

Every day, you're on a job. And every time you're on a job, calls go to voicemail. Voicemail doesn't book appointments. Voicemail doesn't send the caller to your Google Calendar. Voicemail loses you jobs.

Our AI Receptionist:
• Answers every call — even when you're working
• Asks the right questions: name, phone, what's the issue, when do they need you
• Books the appointment directly into YOUR Google Calendar
• Sends you an instant notification with all the details
• Works 24/7 — nights, weekends, holidays
• You choose: Male voice or Female voice

One-time setup: $2,997
Monthly: $299/mo

Want to hear it? I'll call you right now and let the AI handle your call so you can hear it live. No sales pitch — just the product.

Reply "CALL ME" and I'll put you through in 30 seconds.

Or reply "MORE INFO" and I'll send over a demo video.

Don't let another job go to voicemail.`,
    }),
    initial: (biz) => ({
      subject: `Is a missing website costing ${biz} $50k+ a year?`,
      body: `${biz} — this one hurts to see.

You're one of the best plumbers in your area. Great service. Happy customers. But here's the brutal truth:

🔴 78% of people search online before hiring a plumber.
🔴 If ${biz} doesn't show up on Google, you don't exist to them.
🔴 Your competitors WITH websites are stealing your customers every single day.

Let me fix this.

I build professional websites for plumbers — designed to get you calls. Complete site in 48 hours. Looks great on phone + desktop.

The investment:
• $500 to start (net-15 invoicing — pay in 15 days)
• $500 when you love it
• $99/month hosting (updates, security, 24/7 monitoring)

You literally cannot afford NOT to have this.

Reply to this email and I'll send you a custom preview of ${biz}'s new site in 24 hours — no charge, no obligation.

P.S. I also offer something else — our AI Receptionist that answers every incoming call 24/7 and books jobs directly into your Google Calendar. Never miss another $500 job again. Details when you reply.`,
    }),
    followUp: (biz) => ({
      subject: `${biz} — you're losing money every day without this`,
      body: `${biz},

I'm going to be straight with you.

Every day ${biz} is without a website, you're leaving money on the table. Real money. Here's what I mean:

→ A homeowner's water heater bursts. They Google "plumber near me". Your competitor's site pops up. They call. That $850 job? Gone.

→ That happens 3, 5, maybe 10 times a month. Do the math.

My websites get plumbers calls. Period.

$500 start, $500 finish, $99/mo. Site goes live in 48 hours.

———————————————

ALSO available (and this one is BIG):

Our AI Receptionist.

Here's what it does:
📞 Answers every call — 24 hours a day, 7 days a week, 365 days a year
📅 Books appointments directly into your Google Calendar — automatically
💬 Asks the caller: name, phone, what they need, when they want it — then sends you a notification
🎤 Choose your voice: Male or Female?

One-time setup: $2,997
Monthly: $299/mo

This alone can double your booked jobs. No exaggeration.

Want a demo? I'll CALL YOU right now so you can hear it live. Reply "CALL ME" and I'll put you on the line with the AI in 30 seconds.

Or reply "WEBSITE" for your free site preview.

Don't wait. Your competitors aren't.`,
    }),
    paymentReceived: (biz) => ({
      subject: `🚀 ${biz} — let's build this thing!`,
      body: `${biz} — let's go! 🚀

Your payment is confirmed and we're already working on your site. Here's what happens next:

✅ We build your site in the next 24-48 hours
✅ You'll get a preview link by email + text
✅ You tell us what you want changed (1 round of revisions on us)
✅ You approve → we publish it LIVE → every search finds you

Also — while you're thinking about growth, want to add our AI Receptionist? It's cheaper to add now than later. I'll give you a bundled deal if you lock in both today. Reply and ask about it.

Talk soon!
Kevin Regan
240-270-2646`,
    }),
    previewReady: (biz, url) => ({
      subject: `🔥 ${biz} — your new website is ready to preview!`,
      body: `${biz} — check it out! 🔥

Your professional website is built and ready for review:

👉 ${url}

Take a look. Does it represent you? Does it make you look like the pro you are?

Here's what to do next:
• Like it? Reply APPROVE and we publish today
• Want changes? Reply with what you want tweaked (1 round free)
• Want to talk? I'll call you

One more thing — this is the perfect time to add our AI Receptionist. While you're getting setup, we can bundle it and save you on the installation.

Check your preview and let me know!

Kevin Regan
240-270-2646`,
    }),
    siteLive: (biz, url, price) => ({
      subject: `🎉 ${biz} is NOW LIVE! The internet finds you now.`,
      body: `🚨 ${biz} IS OFFICIALLY LIVE ON THE INTERNET 🚨

View it at: ${url}

Here's what just happened:
✅ Your professional website is online
✅ You're now discoverable on Google searches
✅ Customers can find you, see your services, call you
✅ Your $${price}/mo plan is active (hosting, updates, security)

You're officially in the game now.

But here's the missing piece — our AI Receptionist.

While customers CAN find you online now, what happens when they call and you're on another job?

📉 You miss the call. You lose the job. They call your competitor.

Our AI receptionist:
→ Answers every single call
→ Books appointments to your calendar AUTOMATICALLY
→ Never forgets to call back
→ Never has a bad day
→ Choose Male or Female voice

$2,997 setup → $299/mo.
Reply "RECEPTIONIST" and I'll set up a live demo call.

Welcome to 2026, ${biz}. Let's dominate.

Kevin Regan
240-270-2646`,
    }),
  },
  es: {
    receptionist: (biz) => ({
      subject: `${biz} pierde 1 de cada 3 llamadas en el buzón de voz. Eso es $40k+/año.`,
      body: `${biz} — seré breve.

Todos los días, usted está trabajando. Y cada vez que está trabajando, las llamadas van al buzón de voz. El buzón de voz no agenda citas. El buzón de voz no envía al cliente a su calendario. El buzón de voz le pierde trabajos.

Nuestra Recepcionista AI:
• Contesta cada llamada — incluso cuando está trabajando
• Hace las preguntas correctas: nombre, teléfono, ¿qué necesita?, ¿cuándo le necesita?
• Agenda la cita directamente en SU calendario de Google
• Le envía una notificación instantánea con todos los detalles
• Trabaja 24/7 — noches, fines de semana, días festivos
• Usted elige: voz de Hombre o voz de Mujer

Configuración única: $2,997
Mensual: $299/mes

¿Quiere escucharla? Le llamo ahora mismo y dejo que la AI maneje su llamada para que la escuche en vivo. Sin discurso de ventas — solo el producto.

Responda "LLÁMEME" y lo conecto en 30 segundos.

O responda "MÁS INFO" y le envío un video de demostración.

No deje que otro trabajo se pierda en el buzón de voz.`,
    }),
    initial: (biz) => ({
      subject: `¿Un sitio web perdido le está costando a ${biz} $50k+ al año?`,
      body: `${biz} — esto duele verlo.

Usted es de los mejores plomeros en su área. Buen servicio. Clientes felices. Pero aquí está la verdad brutal:

🔴 El 78% de la gente busca en línea antes de contratar un plomero.
🔴 Si ${biz} no aparece en Google, usted no existe para ellos.
🔴 Sus competidores CON sitios web le están robando clientes todos los días.

Déjeme arreglar esto.

Creo sitios web profesionales para plomeros — diseñados para recibir llamadas. Sitio completo en 48 horas. Se ve bien en teléfono y computadora.

La inversión:
• $500 para empezar (factura net-15 — pague en 15 días)
• $500 cuando le encante
• $99/mes de hospedaje (actualizaciones, seguridad, monitoreo 24/7)

Literalmente no puede darse el lujo de NO tener esto.

Responda a este correo y le enviaré una vista previa personalizada del nuevo sitio de ${biz} en 24 horas — sin cargo, sin compromiso.

P.D. También ofrezco nuestra Recepcionista AI que contesta cada llamada 24/7 y agenda trabajos directamente a su calendario de Google. Nunca pierda otro trabajo de $500. Detalles cuando responda.`,
    }),
    followUp: (biz) => ({
      subject: `${biz} — está perdiendo dinero cada día sin esto`,
      body: `${biz},

Voy a ser directo con usted.

Cada día que ${biz} no tiene sitio web, está dejando dinero en la mesa. Dinero real. Le explico:

→ A un dueño de casa le explota el calentador. Busca en Google "plomero cerca de mí". El sitio de su competidor aparece. Lo llaman. Ese trabajo de $850? Perdido.

→ Eso pasa 3, 5, tal vez 10 veces al mes. Haga la cuenta.

Mis sitios web les consiguen llamadas a los plomeros. Punto.

$500 inicio, $500 final, $99/mes. Sitio en vivo en 48 horas.

———————————————

TAMBIÉN disponible (y esto es GRANDE):

Nuestra Recepcionista AI.

Lo que hace:
📞 Contesta cada llamada — 24 horas al día, 7 días a la semana, 365 días al año
📅 Agenda citas directamente a su calendario de Google — automáticamente
💬 Pregunta al cliente: nombre, teléfono, qué necesita, cuándo — luego le envía notificación
🎤 Elija su voz: ¿Hombre o Mujer?

Configuración única: $2,997
Mensual: $299/mes

Esto solo puede duplicar sus trabajos reservados. Sin exagerar.

¿Quiere una demo? ¡Le LLAMO ahora mismo para que la escuche en vivo! Responda "LLÁMEME" y lo pongo en línea con la AI en 30 segundos.

O responda "SITIO WEB" para su vista previa gratis.

No espere. Sus competidores no lo hacen.`,
    }),
    paymentReceived: (biz) => ({
      subject: `🚀 ${biz} — ¡vamos a construir esto!`,
      body: `${biz} — ¡vamos! 🚀

Su pago está confirmado y ya estamos trabajando en su sitio. Esto es lo que sigue:

✅ Construimos su sitio en las próximas 24-48 horas
✅ Le enviaremos un enlace de vista previa por correo y texto
✅ Usted nos dice qué quiere cambiar (1 ronda de revisiones por nuestra cuenta)
✅ Usted aprueba → lo publicamos EN VIVO → cada búsqueda lo encuentra

También — mientras piensa en crecimiento, ¿quiere agregar nuestra Recepcionista AI? Es más barato agregarlo ahora que después. Le doy un precio especial si asegura ambos hoy. Responda y pregunte.

¡Hablamos pronto!
Kevin Regan
240-270-2646`,
    }),
    previewReady: (biz, url) => ({
      subject: `🔥 ${biz} — ¡su nuevo sitio web está listo para ver!`,
      body: `${biz} — ¡mire esto! 🔥

Su sitio web profesional está construido y listo para revisión:

👉 ${url}

Échele un vistazo. ¿Lo representa? ¿Lo hace ver como el profesional que es?

Esto es lo que sigue:
• ¿Le gusta? Responda APROBAR y publicamos hoy
• ¿Quiere cambios? Responda con lo que quiere ajustar (1 ronda gratis)
• ¿Quiere hablar? Lo llamo

Una cosa más — este es el momento perfecto para agregar nuestra Recepcionista AI. Mientras estamos en la configuración, podemos incluirla y ahorrarle en la instalación.

¡Revise su vista previa y avíseme!

Kevin Regan
240-270-2646`,
    }),
    siteLive: (biz, url, price) => ({
      subject: `🎉 ¡${biz} ya está EN VIVO! El internet lo encuentra ahora.`,
      body: `🚨 ${biz} YA ESTÁ OFICIALMENTE EN VIVO EN EL INTERNET 🚨

Véalo en: ${url}}

Esto acaba de pasar:
✅ Su sitio web profesional está en línea
✅ Ahora es visible en búsquedas de Google
✅ Los clientes pueden encontrarlo, ver sus servicios, llamarlo
✅ Su plan de $${price}/mes está activo (hospedaje, actualizaciones, seguridad)

Ya está en el juego oficialmente.

Pero aquí está la pieza que falta — nuestra Recepcionista AI.

Ahora que los clientes PUEDEN encontrarlo en línea, ¿qué pasa cuando llaman y usted está en otro trabajo?

📉 Pierde la llamada. Pierde el trabajo. Llaman a su competidor.

Nuestra recepcionista AI:
→ Contesta cada llamada
→ Agenda citas a su calendario AUTOMÁTICAMENTE
→ Nunca olvida devolver una llamada
→ Nunca tiene un mal día
→ Elija voz de Hombre o Mujer

$2,997 setup → $299/mes.
Responda "RECEPCIONISTA" y le configuro una demo en vivo.

Bienvenido a 2026, ${biz}. Vamos a dominar.

Kevin Regan
240-270-2646`,
    }),
  },
};

let sendgridClient = null;

function getSendgrid() {
  if (!sendgridClient && config.outreach.sendgridKey) {
    import('@sendgrid/mail').then(sg => {
      sg.setApiKey(config.outreach.sendgridKey);
      sendgridClient = sg;
    }).catch(() => {});
  }
  return sendgridClient;
}

export async function sendEmail(to, template, templateData, lang = 'en') {
  const langTemplates = EMAIL_TEMPLATES[lang] || EMAIL_TEMPLATES.en;
  const tpl = langTemplates[template];
  if (!tpl) throw new Error(`Unknown template: ${template} for lang: ${lang}`);

  const { subject, body } = tpl(templateData);

  logger.info(`Sending email to ${to}: ${subject}`);

  try {
    if (config.outreach.sendgridKey) {
      const sg = getSendgrid();
      if (sg) {
        await sg.send({ to, from: config.outreach.fromEmail, subject, text: body });
        return { sent: true, channel: 'email', lang };
      }
    }

    logger.warn(`SendGrid not configured. Would send:\nTo: ${to}\nSubject: ${subject}\nBody: ${body}`);
    return { sent: false, channel: 'email', dryRun: true, lang };
  } catch (err) {
    logger.error(`Failed to send email to ${to}:`, err.message);
    throw err;
  }
}

export async function sendBoth(email, phone, template, templateData, lang = 'en') {
  const results = [];

  if (email && email.includes('@')) {
    const emailResult = await sendEmail(email, template, templateData, lang);
    results.push(emailResult);
  }

  if (phone) {
    const smsLang = SMS_TEMPLATES[lang] || SMS_TEMPLATES.en;
    const smsBody = smsLang[template];
    if (smsBody) {
      try {
        const biz = templateData.businessName;
        const url = templateData.previewUrl || templateData.liveUrl || '';
        const body = smsBody(biz, url);
        const smsResult = await sendSMS(phone, body);
        results.push(smsResult);
      } catch (err) {
        logger.warn(`SMS failed for ${phone}, email sent OK: ${err.message}`);
      }
    }
  }

  return results;
}

export async function sendSMS(to, message) {
  if (!config.outreach.twilio.accountSid) {
    logger.warn(`Twilio not configured. Would send SMS:\nTo: ${to}\nBody: ${message}`);
    return { sent: false, channel: 'sms', dryRun: true };
  }

  logger.info(`Sending SMS to ${to}`);

  try {
    const twilio = await import('twilio');
    const client = twilio(config.outreach.twilio.accountSid, config.outreach.twilio.authToken);
    await client.messages.create({ body: message, to, from: config.outreach.twilio.fromNumber });
    return { sent: true, channel: 'sms' };
  } catch (err) {
    logger.error(`Failed to send SMS to ${to}:`, err.message);
    throw err;
  }
}
