import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_DIR = path.resolve(__dirname, '../../sites');

export async function generateAndSaveSite(business) {
  const { generateSite } = await import('./claude.js');
  const html = await generateSite(business);

  const dir = path.join(SITES_DIR, business.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');

  const previewUrl = `${config.bot.publicUrl}/preview/${business.id}`;
  logger.info(`Site saved for ${business.businessName} at ${previewUrl}`);

  return { html, previewUrl };
}

export async function deployToVercel(business, html) {
  logger.info(`Deploying ${business.businessName} to Vercel...`);

  const files = [
    {
      file: 'index.html',
      data: html,
    },
    {
      file: 'vercel.json',
      data: JSON.stringify({ cleanUrls: true }),
    },
  ];

  try {
    const { data } = await axios.post('https://api.vercel.com/v1/deployments', {
      name: `site-${business.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      files,
      projectSettings: { framework: null },
    }, {
      headers: {
        Authorization: `Bearer ${config.vercel.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const liveUrl = `https://${data.url}`;
    logger.info(`Deployed to Vercel: ${liveUrl}`);
    return { liveUrl, vercelDeploymentId: data.id };
  } catch (err) {
    logger.error('Vercel deploy error:', err.response?.data || err.message);
    throw new Error(`Vercel deployment failed: ${err.response?.data?.error?.message || err.message}`);
  }
}
