import { logger } from '../utils/logger.js';
import { generateAndSaveSite, deployToVercel } from '../services/deploy.js';
import { createInvoice, createUpfrontPaymentLink, createFinalPaymentLink, createMonthlySubscription, createCustomer, getCustomerByEmail } from '../services/stripe.js';
import { sendBoth } from '../services/outreach.js';
import { config } from '../config.js';
import { LeadStatus, updateLead, getLead } from '../services/leads.js';
import { getContractHtml, saveContractPdf } from '../services/contract.js';

export async function handleLeadInterested(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  logger.info(`Handling interested lead: ${lead.businessName}`);

  let customer = await getCustomerByEmail(lead.email);
  if (!customer) {
    customer = await createCustomer({ email: lead.email, name: lead.businessName });
  }

  const html = getContractHtml({
    product: 'website',
    language: lead.language || 'en',
    businessName: lead.businessName,
  });
  saveContractPdf(leadId, html);

  const invoice = await createInvoice({
    customerId: customer.id,
    priceId: config.stripe.prices.upfront,
    leadId,
    description: 'Website Upfront Deposit — 50% due to start',
    daysUntilDue: 15,
  });

  updateLead(leadId, {
    status: LeadStatus.INTERESTED,
    stripeCustomerId: customer.id,
  });

  const invoiceUrl = invoice.hosted_invoice_url;
  logger.info(`Invoice sent to ${lead.businessName}: ${invoiceUrl}`);
  return invoiceUrl;
}

export async function handleUpfrontPayment(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  logger.info(`Upfront payment received for: ${lead.businessName}`);
  updateLead(leadId, { status: LeadStatus.UPFRONT_PAID });

  await sendBoth(lead.email, lead.phone, 'paymentReceived', { businessName: lead.businessName }, lead.language || 'en');

  updateLead(leadId, { status: LeadStatus.SITE_BUILDING });

  try {
    const { html, previewUrl } = await generateAndSaveSite(lead);

    let vercelInfo = {};
    try {
      vercelInfo = await deployToVercel(lead, html);
    } catch (deployErr) {
      logger.warn(`Vercel deploy failed, using local preview: ${deployErr.message}`);
    }

    updateLead(leadId, {
      status: LeadStatus.PREVIEW_SENT,
      previewUrl,
      liveUrl: vercelInfo.liveUrl || null,
    });

    await sendBoth(lead.email, lead.phone, 'previewReady', {
      businessName: lead.businessName,
      previewUrl: vercelInfo.liveUrl || previewUrl,
    }, lead.language || 'en');

    logger.info(`Preview sent to ${lead.businessName}: ${vercelInfo.liveUrl || previewUrl}`);
  } catch (err) {
    logger.error(`Site creation failed for ${lead.businessName}:`, err.message);
    updateLead(leadId, { status: LeadStatus.DECLINED });
  }
}

export async function handleApproval(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  logger.info(`Client approved: ${lead.businessName}`);

  const invoice = await createInvoice({
    customerId: lead.stripeCustomerId,
    priceId: config.stripe.prices.final,
    leadId,
    description: 'Website Final Payment — 50% due on approval',
    daysUntilDue: 0,
  });

  const invoiceUrl = invoice.hosted_invoice_url;
  logger.info(`Final invoice sent to ${lead.businessName}: ${invoiceUrl}`);
  return invoiceUrl;
}

export async function handleFinalPayment(leadId) {
  const lead = getLead(leadId);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  logger.info(`Final payment received for: ${lead.businessName}`);

  const subscription = await createMonthlySubscription(lead.stripeCustomerId);

  const liveUrl = lead.liveUrl || lead.previewUrl || `https://${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.example.com`;

  updateLead(leadId, {
    status: LeadStatus.LIVE,
    stripeSubscriptionId: subscription.id,
    liveUrl,
  });

  await sendBoth(lead.email, lead.phone, 'siteLive', {
    businessName: lead.businessName,
    liveUrl,
    monthlyPrice: 99,
  }, lead.language || 'en');

  logger.info(`Site is LIVE for ${lead.businessName}: ${liveUrl}`);
}

export async function handleDecline(leadId) {
  const lead = getLead(leadId);
  if (!lead) return;
  updateLead(leadId, { status: LeadStatus.DECLINED });
  logger.info(`Lead declined: ${lead.businessName}`);
}
