import { addLead, getAllLeads } from '../services/leads.js';
import { logger } from '../utils/logger.js';

const sampleLeads = [
  { businessName: "Joe's Pizza", email: "joe@joespizza.com", phone: "+12125551001", industry: "Restaurant", location: "Brooklyn, NY" },
  { businessName: "Sunshine Cleaning Co", email: "info@sunshineclean.com", phone: "+12125551002", industry: "Cleaning Services", location: "Austin, TX" },
  { businessName: "Precision Auto Repair", email: "service@precisionauto.com", phone: "+12125551003", industry: "Automotive", location: "Denver, CO" },
  { businessName: "Green Leaf Landscaping", email: "contact@greenleaflandscape.com", phone: "+12125551004", industry: "Landscaping", location: "Portland, OR" },
  { businessName: "Happy Paws Vet", email: "info@happypawsvet.com", phone: "+12125551005", industry: "Veterinary", location: "Seattle, WA" },
  { businessName: "Bright Smile Dental", email: "hello@brightsmiledental.com", phone: "+12125551006", industry: "Dental", location: "Miami, FL" },
  { businessName: "FitZone Gym", email: "info@fitzonegym.com", phone: "+12125551008", industry: "Fitness", location: "San Diego, CA" },
  { businessName: "Little Stars Daycare", email: "director@littlestars.com", phone: "+12125551009", industry: "Childcare", location: "Nashville, TN" },

  { businessName: "Plomería González", email: "juan@plomeria-gonzalez.com", phone: "+15715551001", industry: "Plumbing", location: "Manassas, VA", language: "es" },
  { businessName: "Limpieza Express", email: "info@limpiezaexpress.com", phone: "+15715551002", industry: "Cleaning Services", location: "Woodbridge, VA", language: "es" },
  { businessName: "Jardinería Martínez", email: "carlos@jardineriamartinez.com", phone: "+15715551003", industry: "Landscaping", location: "Manassas, VA", language: "es" },
  { businessName: "Construcción Pérez", email: "info@construccionperez.com", phone: "+15715551004", industry: "Construction", location: "Gainesville, VA", language: "es" },
];

logger.info(`Seeding ${sampleLeads.length} sample leads...`);

for (const lead of sampleLeads) {
  addLead(lead);
}

const all = getAllLeads();
logger.info(`Total leads: ${all.length}`);

const cmd = process.platform === 'win32' ? 'copy .env.example .env' : 'cp .env.example .env';
logger.info(`\nNext steps:\n  1. ${cmd}\n  2. Fill in your API keys in .env\n  3. npm start`);
