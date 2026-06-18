import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

export function getOAuthUrl(leadId) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: leadId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleOAuthCallback(code) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await resp.json();
  if (!data.refresh_token) throw new Error('No refresh_token returned');
  return data.refresh_token;
}

async function refreshAccessToken(refreshToken) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  return data.access_token;
}

export async function bookAppointment({ refreshToken, businessName, customerName, customerPhone, date, time, durationMin = 60 }) {
  const accessToken = await refreshAccessToken(refreshToken);

  const startTime = new Date(`${date}T${time}:00`);
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

  const event = {
    summary: `Plumbing appointment - ${customerName}`,
    description: `Booked by AI Receptionist for ${businessName}\nCustomer: ${customerName}\nPhone: ${customerPhone}`,
    start: { dateTime: startTime.toISOString(), timeZone: 'America/New_York' },
    end: { dateTime: endTime.toISOString(), timeZone: 'America/New_York' },
    reminders: { useDefault: true },
  };

  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google Calendar API error: ${err}`);
  }

  const result = await resp.json();
  logger.info(`Appointment booked for ${businessName}: ${customerName} on ${date} at ${time}`);
  return { eventId: result.id, htmlLink: result.htmlLink };
}
