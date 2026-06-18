import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { addLead, getAllLeads } from './leads.js';

const CHAINS_TO_SKIP = [
  'roto-rooter', 'mr. rooter', 'mr rooter',
  'the rooter guy', 'rooter guy',
  'drain blaster', 'blue frog',
];

const SPANISH_INDICATORS = [
  'ñ', 'á', 'é', 'í', 'ó', 'ú',
  'plomería', 'plomeria', 'jardinería', 'jardineria',
  'limpieza', 'construcción', 'construccion',
  'servicios', 'mantenimiento', 'reparación', 'reparacion',
  'electricista', 'pintura', 'techado', 'techos',
  'transporte', 'mudanza', 'carpintería', 'carpinteria',
  'gonzález', 'garcia', 'martínez', 'martinez', 'perez', 'pérez',
  'lopez', 'lópez', 'rodriguez', 'rodríguez', 'sanchez', 'sánchez',
  'ramirez', 'ramírez', 'torres', 'flores', 'rivera',
  'gomez', 'gómez', 'diaz', 'díaz', 'cruz', 'morales',
  'ortiz', 'ortíz', 'gutierrez', 'gutiérrez',
  'los', 'las', 'el', 'la', 'san', 'santa',
];

function detectLanguage(name, location) {
  const lower = (name + ' ' + location).toLowerCase();
  const matchCount = SPANISH_INDICATORS.filter(w => lower.includes(w)).length;
  return matchCount >= 2 ? 'es' : 'en';
}

function hasNoWebsite(place) {
  return !place.website && (!place.types || !place.types.includes('website'));
}

export async function scrapePlumbers(city, radius = 20000) {
  const apiKey = config.google?.mapsApiKey;
  if (!apiKey) {
    logger.warn('No GOOGLE_MAPS_API_KEY set. Skipping auto-scrape.');
    return [];
  }

  logger.info(`Scraping plumbers in ${city}...`);

  const textSearchUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
  const detailsUrl = 'https://maps.googleapis.com/maps/api/place/details/json';

  let allResults = [];
  let nextPageToken = null;

  for (let page = 0; page < 3; page++) {
    const params = {
      query: `plumber in ${city}`,
      key: apiKey,
    };
    if (nextPageToken) params.pagetoken = nextPageToken;

    const searchResp = await axios.get(textSearchUrl, { params });
    const searchData = searchResp.data;

    if (!searchData.results?.length) break;

    for (const result of searchData.results) {
      const detailParams = {
        place_id: result.place_id,
        fields: 'name,formatted_phone_number,formatted_address,website,types,rating',
        key: apiKey,
      };

      const detailResp = await axios.get(detailsUrl, { params: detailParams });
      const detailData = detailResp.data;
      const place = detailData.result || result;

      if (place.permanently_closed) continue;

      const businessName = place.name;
      const isChain = CHAINS_TO_SKIP.some(c => businessName.toLowerCase().includes(c));
      if (isChain) continue;

      if (!place.website && place.formatted_phone_number) {
        const exists = getAllLeads().some(l =>
          l.businessName?.toLowerCase() === businessName.toLowerCase()
        );

        if (!exists) {
          const language = detectLanguage(businessName, place.formatted_address || city);

          addLead({
            businessName,
            phone: place.formatted_phone_number,
            location: place.formatted_address || city,
            industry: 'Plumbing',
            language,
            notes: `Auto-scraped from Google Maps. Rating: ${place.rating || 'N/A'}`,
          });

          logger.info(`Auto-added: ${businessName} (${language === 'es' ? 'Spanish' : 'English'})`);
          allResults.push({ businessName, language });
        }
      }
    }

    nextPageToken = searchData.next_page_token;
    if (nextPageToken) await new Promise(r => setTimeout(r, 2000));
  }

  logger.info(`Scrape complete for ${city}. Found ${allResults.length} new leads.`);
  return allResults;
}

export async function scrapeAllCities() {
  const cities = [
    'Manassas VA', 'Manassas Park VA',
    'Woodbridge VA', 'Gainesville VA',
    'Haymarket VA', 'Bristow VA',
    'Centreville VA', 'Chantilly VA',
    'Dumfries VA', 'Dale City VA',
    'Warrenton VA', 'Culpeper VA',
    'Fredericksburg VA',
  ];

  let total = 0;
  for (const city of cities) {
    try {
      const results = await scrapePlumbers(city);
      total += results.length;
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      logger.error(`Failed scraping ${city}: ${err.message}`);
    }
  }

  logger.info(`Auto-scrape finished. Total new leads: ${total}`);
  return total;
}
