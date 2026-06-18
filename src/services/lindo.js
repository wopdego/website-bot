import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const client = axios.create({
  baseURL: config.lindo.baseUrl,
  headers: { Authorization: `Bearer ${config.lindo.apiKey}`, 'Content-Type': 'application/json' },
});

export async function createWebsite({ businessName, description, industry, style }) {
  const prompt = `Create a professional multi-page website for ${businessName}, a ${industry} business. ${description}. Style: ${style || 'modern'}. Include: Home, About, Services, Contact pages. Use professional stock images.`;

  logger.info(`Creating Lindo website for: ${businessName}`);

  const { data } = await client.post('/ai/workspace/website', {
    prompt,
    client: { name: businessName },
  });

  const workflowId = data.data?.workflow_id || data.workflow_id;
  logger.info(`Website creation started, workflow_id: ${workflowId}`);
  return workflowId;
}

export async function getWebsiteStatus(workflowId) {
  const { data } = await client.get(`/ai/workspace/website/status/${workflowId}`);
  return data;
}

export async function waitForWebsite(workflowId, maxRetries = 30, intervalMs = 10000) {
  for (let i = 0; i < maxRetries; i++) {
    const status = await getWebsiteStatus(workflowId);
    logger.debug(`Website status [${i + 1}/${maxRetries}]: ${status.data?.status || status.status}`);

    if (status.data?.status === 'completed' || status.status === 'completed') {
      const websiteId = status.data?.website_id || status.website_id;
      const websiteUrl = status.data?.url || status.url;
      logger.info(`Website ready! ID: ${websiteId}, URL: ${websiteUrl}`);
      return { websiteId, websiteUrl, status: 'completed' };
    }

    if (status.data?.status === 'failed' || status.status === 'failed') {
      logger.error(`Website creation failed: ${status.data?.error || status.error}`);
      return { status: 'failed', error: status.data?.error || status.error };
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { status: 'timeout', error: 'Website creation timed out' };
}

export async function assignCustomDomain(websiteId, domain) {
  logger.info(`Assigning domain ${domain} to website ${websiteId}`);
  const { data } = await client.post(`/workspace/website/${websiteId}/domain`, {
    domain,
  });
  return data;
}

export async function listWebsites() {
  const { data } = await client.get('/websites');
  return data.data || data;
}

export async function deleteWebsite(websiteId) {
  const { data } = await client.delete(`/websites/${websiteId}`);
  return data;
}
