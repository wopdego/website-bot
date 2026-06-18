import { config } from '../config.js';
import { logger } from '../utils/logger.js';

async function getTwilioClient() {
  const twilio = await import('twilio');
  return twilio(config.outreach.twilio.accountSid, config.outreach.twilio.authToken);
}

export async function findAvailableNumber(areaCode = '571') {
  const client = await getTwilioClient();
  const numbers = await client.availablePhoneNumbers('US').local.list({
    areaCode,
    limit: 20,
  });
  if (!numbers.length) throw new Error(`No available numbers in area ${areaCode}`);
  logger.info(`Found ${numbers.length} available numbers in ${areaCode} area`);
  const medium = numbers.find(n => containsPattern(n.phoneNumber));
  return (medium || numbers[0]).phoneNumber;
}

function containsPattern(str) {
  const patterns = ['77', '88', '99', '55', '33', '22', '00',  '78', '87'];
  const cleaned = str.replace(/[^\d]/g, '');
  return patterns.some(p => cleaned.includes(p));
}

export async function purchaseNumber(phoneNumber, voiceUrl) {
  const client = await getTwilioClient();
  const incoming = await client.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl,
    voiceMethod: 'POST',
    smsUrl: config.bot.publicUrl + '/webhooks/twilio',
    smsMethod: 'POST',
  });
  logger.info(`Purchased and configured ${phoneNumber} (SID: ${incoming.sid})`);
  return { sid: incoming.sid, phoneNumber: incoming.phoneNumber };
}

export async function releaseNumber(phoneNumberSid) {
  const client = await getTwilioClient();
  await client.incomingPhoneNumbers(phoneNumberSid).remove();
  logger.info(`Released phone number SID: ${phoneNumberSid}`);
}

export async function updateVoiceUrl(phoneNumberSid, voiceUrl) {
  const client = await getTwilioClient();
  await client.incomingPhoneNumbers(phoneNumberSid).update({
    voiceUrl,
    voiceMethod: 'POST',
  });
  logger.info(`Updated voice URL for SID ${phoneNumberSid}`);
}
