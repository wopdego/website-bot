import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

let leads = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLeads() {
  ensureDataDir();
  try {
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    }
  } catch (err) {
    logger.error('Failed to load leads:', err.message);
    leads = [];
  }
}

function saveLeads() {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

loadLeads();

export const LeadStatus = {
  NEW: 'new',
  CONTACTED: 'contacted',
  INTERESTED: 'interested',
  UPFRONT_PAID: 'upfront_paid',
  SITE_BUILDING: 'site_building',
  PREVIEW_SENT: 'preview_sent',
  REVISIONS: 'revisions',
  FINAL_PAID: 'final_paid',
  LIVE: 'live',
  DECLINED: 'declined',
  UNRESPONSIVE: 'unresponsive',
  RECEPTIONIST_INTERESTED: 'receptionist_interested',
  RECEPTIONIST_SETUP_PAID: 'receptionist_setup_paid',
  RECEPTIONIST_CALENDAR_LINKED: 'receptionist_calendar_linked',
  RECEPTIONIST_PROVISIONED: 'receptionist_provisioned',
  RECEPTIONIST_LIVE: 'receptionist_live',
};

export function addLead({ businessName, email, phone, website, industry, location, notes, language }) {
  const dupCheck = leads.find(l =>
    (email && l.email === email) ||
    (phone && l.phone === phone) ||
    (businessName && l.businessName?.toLowerCase() === businessName.toLowerCase())
  );
  if (dupCheck) {
    logger.warn(`Lead already exists: ${businessName} (${email || phone})`);
    return dupCheck;
  }

  const lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    businessName: businessName || 'Unknown Business',
    email: email || '',
    phone,
    website: website || '',
    industry: industry || 'Unknown',
    location: location || '',
    notes: notes || '',
    language: language || 'en',
    status: LeadStatus.NEW,
    createdAt: new Date().toISOString(),
    contactedAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    lindoWebsiteId: null,
    workflowId: null,
    previewUrl: null,
    liveUrl: null,
    outreachCount: 0,
    lastOutreachAt: null,
    offerStage: 'website',
    offerBundle: false,
    phoneNumberSid: null,
    twilioPhoneNumber: null,
    googleRefreshToken: null,
    agentPrompt: null,
    callCount: 0,
    appointmentsBooked: 0,
  };

  leads.push(lead);
  saveLeads();
  logger.info(`Added lead: ${businessName} (${email})`);
  return lead;
}

export function getLeadsByStatus(status) {
  return leads.filter(l => l.status === status);
}

export function getLead(id) {
  return leads.find(l => l.id === id);
}

export function getLeadByEmail(email) {
  return leads.find(l => l.email === email);
}

export function getLeadByPhone(phone) {
  const normalized = phone.replace(/[^+\d]/g, '');
  return leads.find(l => l.phone?.replace(/[^+\d]/g, '') === normalized);
}

export function updateLead(id, updates) {
  const idx = leads.findIndex(l => l.id === id);
  if (idx === -1) return null;

  leads[idx] = { ...leads[idx], ...updates, updatedAt: new Date().toISOString() };
  saveLeads();
  return leads[idx];
}

export function getNewLeads() {
  return leads.filter(l => l.status === LeadStatus.NEW);
}

export function getLeadsReadyForOutreach() {
  const now = Date.now();
  const cooldown = 7 * 24 * 60 * 60 * 1000;

  return leads.filter(l => {
    if (l.status !== LeadStatus.NEW && l.status !== LeadStatus.UNRESPONSIVE) return false;
    if (!l.lastOutreachAt) return true;
    return (now - new Date(l.lastOutreachAt).getTime()) > cooldown;
  });
}

export function getAllLeads() {
  return [...leads];
}

export function deleteLead(id) {
  leads = leads.filter(l => l.id !== id);
  saveLeads();
}
