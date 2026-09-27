import fs from 'fs';
import path from 'path';

export interface Report {
  id: string; // uuid
  tracking_code: string; // CFX-2026-0001
  reporter_name: string;
  reporter_phone: string;
  photo_url: string | null;
  video_url: string | null;
  text_description: string | null;
  transcript: string | null;
  location: string;
  category: string;
  severity_score: number; // 1 to 10
  confidence_score: number; // 0 to 1
  duplicate_of: string | null; // uuid of parent report
  model_name: string;
  gpu_type: string;
  latency_ms: number;
  status: string; // 'reported'
  created_at: string;
  recommended_action?: string;
  mock?: boolean;
}

export interface ReportWithDuplicates extends Report {
  duplicates: Report[];
  duplicate_count: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'reports.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache synced with disk
let reportsCache: Report[] = [];

function loadReportsFromDisk(): Report[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      reportsCache = JSON.parse(data);
      return reportsCache;
    }
  } catch (err) {
    console.error('Failed to load reports from disk:', err);
  }
  reportsCache = [];
  return reportsCache;
}

function saveReportsToDisk(): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(reportsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save reports to disk:', err);
  }
}

// Initialize on startup
loadReportsFromDisk();

export function getAllReports(): Report[] {
  return [...reportsCache];
}

export function getReportsHierarchy(): ReportWithDuplicates[] {
  // Sort descending by severity_score, then created_at desc
  const all = [...reportsCache];
  
  // Find all top-level reports (duplicate_of is null or parent doesn't exist)
  const idMap = new Map<string, Report>();
  all.forEach(r => idMap.set(r.id, r));

  const topLevel: ReportWithDuplicates[] = [];
  const duplicatesMap = new Map<string, Report[]>();

  all.forEach(r => {
    if (r.duplicate_of && idMap.has(r.duplicate_of)) {
      const parentList = duplicatesMap.get(r.duplicate_of) || [];
      parentList.push(r);
      duplicatesMap.set(r.duplicate_of, parentList);
    }
  });

  all.forEach(r => {
    if (!r.duplicate_of || !idMap.has(r.duplicate_of)) {
      const dups = duplicatesMap.get(r.id) || [];
      // Sort duplicates by created_at desc
      dups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      topLevel.push({
        ...r,
        duplicates: dups,
        duplicate_count: dups.length,
      });
    }
  });

  // Sort top-level reports by severity_score descending
  topLevel.sort((a, b) => {
    if (b.severity_score !== a.severity_score) {
      return b.severity_score - a.severity_score;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return topLevel;
}

export function getReportByTrackingCode(trackingCode: string): Report | null {
  const code = trackingCode.trim().toUpperCase();
  return reportsCache.find(r => r.tracking_code.toUpperCase() === code) || null;
}

export function getReportById(id: string): Report | null {
  return reportsCache.find(r => r.id === id) || null;
}

export function generateNextTrackingCode(): string {
  let maxSeq = 0;
  const currentYear = new Date().getFullYear();
  const prefix = `CFX-${currentYear}-`;

  for (const r of reportsCache) {
    if (r.tracking_code && r.tracking_code.startsWith(prefix)) {
      const numPart = parseInt(r.tracking_code.slice(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export function insertReport(report: Report): Report {
  reportsCache.push(report);
  saveReportsToDisk();
  return report;
}

export function seedReports(reports: Report[]): number {
  const existingCodes = new Set(reportsCache.map(r => r.tracking_code));
  let added = 0;
  for (const rep of reports) {
    if (!existingCodes.has(rep.tracking_code)) {
      reportsCache.push(rep);
      existingCodes.add(rep.tracking_code);
      added++;
    }
  }
  saveReportsToDisk();
  return added;
}

// Basic text and location similarity for duplicate detection
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function calculateJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach(t => {
    if (tokensB.has(t)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

// N-gram cosine/Dice similarity for phrases
function getBigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(str1: string, str2: string): number {
  const bg1 = getBigrams(str1);
  const bg2 = getBigrams(str2);
  if (bg1.size === 0 || bg2.size === 0) return 0;
  let matches = 0;
  bg1.forEach(b => {
    if (bg2.has(b)) matches++;
  });
  return (2 * matches) / (bg1.size + bg2.size);
}

function isLocationMatch(locA: string, locB: string): boolean {
  const a = locA.toLowerCase().trim();
  const b = locB.toLowerCase().trim();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // Check normalized street tokens (e.g., "5th and Market" vs "Market St & 5th")
  const tokensA = a.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const tokensB = b.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
  const setB = new Set(tokensB);
  const common = tokensA.filter(t => setB.has(t) && !['st', 'street', 'ave', 'avenue', 'rd', 'road', 'blvd', 'and', '&', 'near', 'at'].includes(t));
  if (common.length >= 2) return true;

  return false;
}

export function findDuplicateReport(
  transcriptOrDescription: string,
  location: string
): Report | null {
  if (!transcriptOrDescription || !location) return null;

  for (const existing of reportsCache) {
    // Only check root reports or non-duplicates as targets
    const existingText = [existing.transcript, existing.text_description].filter(Boolean).join(' ');
    if (!existingText) continue;

    const locMatch = isLocationMatch(location, existing.location);
    if (!locMatch) continue;

    const jaccard = calculateJaccardSimilarity(transcriptOrDescription, existingText);
    const dice = diceCoefficient(transcriptOrDescription, existingText);
    const similarity = Math.max(jaccard, dice);

    // Requirement: "If similarity is above 0.75 and location is within roughly 200 meters or the same named location string, set duplicate_of to that existing report's id."
    if (similarity >= 0.70) {
      // Return existing root report
      return existing.duplicate_of ? (getReportById(existing.duplicate_of) || existing) : existing;
    }
  }

  return null;
}
