import Stripe from 'stripe';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(config.stripe.secretKey);

export async function createCheckoutSession({ price, leadId, metadata = {}, customerEmail, customerId, successUrl, cancelUrl }) {
  const sessionParams = {
    mode: 'payment',
    line_items: [{ price, quantity: 1 }],
    metadata: { ...metadata, leadId },
    success_url: successUrl || `${config.bot.publicUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${config.bot.publicUrl}/payment-cancelled`,
  };
  if (customerEmail) sessionParams.customer_email = customerEmail;
  if (customerId) sessionParams.customer = customerId;

  const session = await stripe.checkout.sessions.create(sessionParams);
  logger.info(`Checkout session created: ${session.id} (price: ${price})`);
  return session;
}

export async function createUpfrontPaymentLink(clientEmail, metadata = {}) {
  const session = await createCheckoutSession({
    price: config.stripe.prices.upfront,
    customerEmail: clientEmail,
    metadata: { ...metadata, payment_stage: 'upfront' },
  });
  return session.url;
}

export async function createFinalPaymentLink(customerId, metadata = {}) {
  const session = await createCheckoutSession({
    price: config.stripe.prices.final,
    customerId,
    metadata: { ...metadata, payment_stage: 'final' },
  });
  return session.url;
}

export async function createMonthlySubscription(customerId) {
  logger.info(`Creating monthly subscription for customer ${customerId}`);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: config.stripe.prices.monthly }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}

export async function createSubscription(customerId, priceId) {
  logger.info(`Creating subscription for customer ${customerId} (price: ${priceId})`);
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });
  return subscription;
}

export async function createInvoice({ customerId, priceId, leadId, description, daysUntilDue = 15 }) {
  logger.info(`Creating invoice for customer ${customerId} (price: ${priceId})`);

  const invoiceItem = await stripe.invoiceItems.create({
    customer: customerId,
    price: priceId,
    description: description || '',
    metadata: { leadId },
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    days_until_due: daysUntilDue,
    collection_method: 'send_invoice',
    metadata: { leadId },
    pending_invoice_items_behavior: 'include',
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  const sent = await stripe.invoices.sendInvoice(invoice.id);

  logger.info(`Invoice created & sent: ${sent.id} ($${(sent.amount_due / 100).toFixed(2)}, due in ${daysUntilDue} days)`);
  return sent;
}

export async function getCustomerByEmail(email) {
  const customers = await stripe.customers.list({ email, limit: 1 });
  return customers.data[0] || null;
}

export async function createCustomer({ email, name, phone }) {
  const params = { email, name };
  if (phone) params.phone = phone;
  return await stripe.customers.create(params);
}

export function constructWebhookEvent(body, signature) {
  return stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
}

export function getStripe() {
  return stripe;
}
