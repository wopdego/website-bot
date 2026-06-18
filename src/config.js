import dotenv from 'dotenv';
dotenv.config();

export const config = {
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  },
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    registrantFirstName: process.env.CF_REGISTRANT_FIRST_NAME,
    registrantLastName: process.env.CF_REGISTRANT_LAST_NAME,
    registrantEmail: process.env.CF_REGISTRANT_EMAIL,
    registrantPhone: process.env.CF_REGISTRANT_PHONE,
    registrantAddress: process.env.CF_REGISTRANT_ADDRESS,
    registrantCity: process.env.CF_REGISTRANT_CITY,
    registrantState: process.env.CF_REGISTRANT_STATE,
    registrantZip: process.env.CF_REGISTRANT_ZIP,
  },
  vercel: {
    token: process.env.VERCEL_TOKEN,
    teamId: process.env.VERCEL_TEAM_ID || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    prices: {
      upfront: process.env.STRIPE_PRICE_UPFRONT,
      final: process.env.STRIPE_PRICE_FINAL,
      monthly: process.env.STRIPE_PRICE_MONTHLY,
      receptionistSetup: process.env.STRIPE_PRICE_RECEPTIONIST_SETUP,
      receptionistMonthly: process.env.STRIPE_PRICE_RECEPTIONIST_MONTHLY,
      bundleSetup: process.env.STRIPE_PRICE_BUNDLE_SETUP,
    },
  },
  outreach: {
    sendgridKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
  },
  bot: {
    port: parseInt(process.env.PORT || '3000'),
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
    maxDailyOutreach: parseInt(process.env.MAX_DAILY_OUTREACH || '50'),
    cooldownDays: parseInt(process.env.COOLDOWN_DAYS || '7'),
  },
};
