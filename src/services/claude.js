import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export async function generateSite(business) {
  const lang = business.language || 'en';
  const langInstruction = lang === 'es'
    ? 'ALL content must be in Spanish. Use Spanish headings, Spanish body text, Spanish navigation labels. The business name stays in its original form.'
    : 'ALL content must be in English.';

  const prompt = `You are a professional web designer. Generate a complete, single-file HTML website for a business. ${langInstruction}

BUSINESS DETAILS:
- Name: ${business.businessName}
- Industry: ${business.industry || 'General'}
- Location: ${business.location || 'United States'}
- Description: ${business.notes || `Professional ${business.industry || 'business'} serving ${business.location || 'the local community'}.`}

REQUIREMENTS:
- Single self-contained HTML file (no external dependencies except Google Fonts/Font Awesome CDN)
- Responsive design (mobile-first)
- Modern, professional styling
- Include these sections: Header/Nav, Hero, About, Services/Offerings, Contact Form, Footer
- Clean, semantic HTML5
- Inline CSS in <style> tag
- Use a professional color scheme appropriate for the industry
- Include placeholder text where needed (lorem ipsum or industry-appropriate)
- The page should look like a real, complete website

OUTPUT ONLY the raw HTML. No markdown wrapping, no explanation. Start with <!DOCTYPE html> and end with </html>.`;

  logger.info(`Generating site for ${business.businessName} via Claude...`);

  try {
    const { data } = await axios.post(ANTHROPIC_URL, {
      model: config.claude.model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'x-api-key': config.claude.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 120000,
    });

    const html = data.content[0].text;

    const cleanHtml = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

    logger.info(`Site generated: ${cleanHtml.length} chars`);
    return cleanHtml;
  } catch (err) {
    logger.error('Claude API error:', err.response?.data || err.message);
    throw new Error(`Claude generation failed: ${err.response?.data?.error?.message || err.message}`);
  }
}
