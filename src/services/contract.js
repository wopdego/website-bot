import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts');

function ensureDir() {
  if (!fs.existsSync(CONTRACTS_DIR)) {
    fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
  }
}

const TERMS = {
  website: {
    en: {
      title: 'Website Development & Hosting Agreement',
      terms: [
        'Services: Custom website development (up to 5 pages), hosting, and monthly maintenance.',
        'Payment: $500 upfront deposit, $500 upon final approval. $99/month recurring hosting fee.',
        'Timeline: Initial preview delivered within 48 hours of upfront payment.',
        'Revisions: One round of revisions included. Additional revisions billed at $50/hour.',
        'Domain: Client is responsible for domain registration costs ($9-15/yr) or a custom domain can be provided.',
        'Cancellation: Month-to-month hosting. Cancel anytime with 30 days notice. Website files belong to client upon full payment.',
        'Content: Client provides all text, images, and branding. Bot will generate placeholder content as needed.',
      ],
      acceptanceLabel: 'I agree to the terms above and authorize the $500 upfront payment.',
    },
    es: {
      title: 'Acuerdo de Desarrollo y Hospedaje de Sitio Web',
      terms: [
        'Servicios: Desarrollo de sitio web personalizado (hasta 5 páginas), hospedaje y mantenimiento mensual.',
        'Pago: $500 depósito inicial, $500 al aprobar el sitio. $99/mes por hospedaje.',
        'Tiempo: Vista previa inicial entregada dentro de 48 horas del pago inicial.',
        'Revisiones: Una ronda de revisiones incluida. Revisiones adicionales a $50/hora.',
        'Dominio: El cliente es responsable del costo del dominio ($9-15/año) o podemos proveer uno.',
        'Cancelación: Mensual. Cancele con 30 días de aviso. Los archivos del sitio pertenecen al cliente tras pago completo.',
        'Contenido: El cliente provee textos, imágenes y marca. El bot generará contenido preliminar si es necesario.',
      ],
      acceptanceLabel: 'Acepto los términos arriba y autorizo el pago inicial de $500.',
    },
  },
  receptionist: {
    en: {
      title: 'AI Virtual Receptionist Service Agreement',
      terms: [
        'Services: AI-powered virtual receptionist that answers calls, schedules appointments, and integrates with Google Calendar.',
        'Phone Number: A dedicated local phone number is provisioned and included.',
        'Payment: $2,995 one-time setup fee. $299/month recurring service fee.',
        'Setup: Includes number provisioning, calendar integration, and AI voice customization.',
        'Appointments: AI books appointments directly to client Google Calendar. Client is responsible for maintaining calendar availability.',
        'Cancellation: Month-to-month. Cancel anytime with 30 days notice. Phone number can be ported upon request.',
        'Limitations: AI handles appointment booking and basic Q&A. Complex calls can be forwarded to client phone.',
      ],
      acceptanceLabel: 'I agree to the terms above and authorize the $2,995 setup payment.',
    },
    es: {
      title: 'Acuerdo de Servicio de Recepcionista Virtual AI',
      terms: [
        'Servicios: Recepcionista virtual con IA que contesta llamadas, agenda citas y se integra con Google Calendar.',
        'Número Telefónico: Se incluye un número local dedicado.',
        'Pago: $2,995 por configuración única. $299/mes por servicio recurrente.',
        'Configuración: Incluye provisioning del número, integración de calendario y personalización de la voz AI.',
        'Citas: La IA agenda citas directamente al calendario de Google del cliente. El cliente es responsable de mantener la disponibilidad.',
        'Cancelación: Mensual. Cancele con 30 días de aviso. El número puede transferirse si se solicita.',
        'Limitaciones: La IA maneja agenda de citas y preguntas básicas. Llamadas complejas pueden reenviarse al cliente.',
      ],
      acceptanceLabel: 'Acepto los términos arriba y autorizo el pago de configuración de $2,995.',
    },
  },
};

export function getContractHtml({ product, language, businessName, date }) {
  const lang = language || 'en';
  const productConfig = TERMS[product];
  if (!productConfig) throw new Error(`Unknown product: ${product}`);

  const terms = productConfig[lang] || productConfig.en;
  const dateStr = date || new Date().toLocaleDateString();

  const termsList = terms.terms.map(t => `<li>${t}</li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><title>${terms.title}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; line-height: 1.6; }
  h1 { color: #1a56db; border-bottom: 2px solid #1a56db; padding-bottom: 10px; }
  .business { font-size: 1.2em; font-weight: bold; margin: 20px 0; }
  .date { color: #666; margin-bottom: 20px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 10px; }
  .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px; font-size: 0.9em; color: #666; }
</style></head>
<body>
  <h1>${terms.title}</h1>
  <div class="business">${businessName}</div>
  <div class="date">${dateStr}</div>
  <ul>${termsList}</ul>
  <div class="footer">
    <p>By completing payment, you acknowledge that you have read, understood, and agree to these terms.</p>
    <p>This agreement was generated electronically and is legally binding.</p>
  </div>
</body></html>`;
}

export function saveContractPdf(leadId, html) {
  ensureDir();
  const filePath = path.join(CONTRACTS_DIR, `${leadId}.html`);
  fs.writeFileSync(filePath, html, 'utf-8');
  logger.info(`Contract saved: ${filePath}`);
  return filePath;
}
