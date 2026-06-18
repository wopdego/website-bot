import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const CF_API = 'https://api.cloudflare.com/client/v4';

function headers() {
  return {
    'Authorization': `Bearer ${config.cloudflare.apiToken}`,
    'Content-Type': 'application/json',
  };
}

export async function searchDomain(domain) {
  const resp = await fetch(`${CF_API}/accounts/${config.cloudflare.accountId}/domain-search`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ domain, exact: true }),
  });
  return resp.json();
}

export async function registerDomain(domain) {
  logger.info(`Registering domain: ${domain}`);

  const resp = await fetch(`${CF_API}/accounts/${config.cloudflare.accountId}/domains/register`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      domain,
      contact: {
        first_name: config.cloudflare.registrantFirstName || 'Website',
        last_name: config.cloudflare.registrantLastName || 'Bot',
        email: config.cloudflare.registrantEmail || 'domains@yourbot.com',
        phone: config.cloudflare.registrantPhone || '+17035551234',
        address: config.cloudflare.registrantAddress || '123 Main St',
        city: config.cloudflare.registrantCity || 'Manassas',
        state: config.cloudflare.registrantState || 'VA',
        zip: config.cloudflare.registrantZip || '20109',
        country: 'US',
      },
    }),
  });

  const data = await resp.json();
  if (!data.success) throw new Error(`Domain registration failed: ${JSON.stringify(data.errors)}`);

  logger.info(`Domain registered: ${domain}`);
  return data.result;
}

export async function getOrCreateZone(domain) {
  const listResp = await fetch(`${CF_API}/zones?name=${domain}`, { headers: headers() });
  const listData = await listResp.json();
  if (listData.success && listData.result.length > 0) {
    return listData.result[0];
  }

  const createResp = await fetch(`${CF_API}/zones`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name: domain,
      account: { id: config.cloudflare.accountId },
      jump_start: true,
    }),
  });
  const createData = await createResp.json();
  if (!createData.success) throw new Error(`Zone creation failed: ${JSON.stringify(createData.errors)}`);
  logger.info(`Zone created for ${domain}: ${createData.result.id}`);
  return createData.result;
}

export async function setDnsRecord(zoneId, name, target) {
  const resp = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'CNAME',
      name,
      content: target,
      ttl: 120,
      proxied: true,
    }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(`DNS record creation failed: ${JSON.stringify(data.errors)}`);
  logger.info(`DNS record set: ${name}.${zoneId} -> ${target}`);
  return data.result;
}

export async function provisionDomain(domain, vercelTarget) {
  const zone = await getOrCreateZone(domain);
  await setDnsRecord(zone.id, '@', vercelTarget);
  await setDnsRecord(zone.id, 'www', vercelTarget);
  return {
    zoneId: zone.id,
    nameServers: zone.name_servers,
  };
}
