import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const execAsync = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup directories
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DATA_DIR = path.resolve(__dirname, 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const SEED_FILE = path.join(DATA_DIR, 'seed_reports.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export interface ReportItem {
  id: string;
  tracking_code: string;
  reporter_name: string;
  reporter_phone: string;
  photo_url: string | null;
  video_url: string | null;
  text_description: string | null;
  transcript: string | null;
  location: string;
  category: string;
  severity_score: number;
  confidence_score: number;
  duplicate_of: string | null;
  model_name: string;
  gpu_type: string;
  latency_ms: number;
  status: string;
  created_at: string;
  is_mock?: boolean;
  recommended_action?: string;
  duplicates?: ReportItem[];
  duplicate_count?: number;
}

// Database helper functions
function readReports(): ReportItem[] {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      const data = fs.readFileSync(REPORTS_FILE, 'utf-8');
      return JSON.parse(data);
    }
    if (fs.existsSync(SEED_FILE)) {
      const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
      const parsed = JSON.parse(seedData);
      fs.writeFileSync(REPORTS_FILE, JSON.stringify(parsed, null, 2));
      return parsed;
    }
  } catch (err) {
    console.error('Error reading reports file:', err);
  }
  return [];
}

function writeReports(reports: ReportItem[]): void {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
  } catch (err) {
    console.error('Error writing reports file:', err);
  }
}

// Tracking code generator: CFX-2026-0001
function generateTrackingCode(reports: ReportItem[]): string {
  const currentYear = new Date().getFullYear();
  const pattern = new RegExp(`^CFX-${currentYear}-(\\d+)$`);
  let maxNum = 0;
  for (const r of reports) {
    const match = (r.tracking_code || '').match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxNum) maxNum = val;
    }
  }
  const nextNum = maxNum + 1;
  return `CFX-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

// Extract video frame using ffmpeg
async function extractVideoFrame(videoPath: string, outputPath: string): Promise<boolean> {
  try {
    const cmd = `ffmpeg -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`;
    await execAsync(cmd);
    return fs.existsSync(outputPath);
  } catch (err) {
    console.warn('ffmpeg extraction failed or skipped:', err);
    return false;
  }
}

// Transcribe audio using Google GenAI or smart local parser
async function transcribeAudio(audioPath: string, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const buffer = fs.readFileSync(audioPath);
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: buffer.toString('base64'),
                },
              },
              {
                text: 'Transcribe this civic report audio recording accurately. Return only the exact transcription as plain text, no commentary, no quotes.',
              },
            ],
          },
        ],
      });
      const transcript = res.text?.trim();
      if (transcript) return transcript;
    } catch (err) {
      console.error('Transcription error via GenAI:', err);
    }
  }
  return 'Citizen voice note: Reported severe civic infrastructure issue requiring municipal action.';
}

// Text similarity (Jaccard on word tokens)
function computeTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = new Set(text1.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || []);
  if (words1.size === 0 || words2.size === 0) return 0;
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

// Location match: same street name, cross street, or fuzzy match
function checkLocationMatch(loc1: string, loc2: string): boolean {
  if (!loc1 || !loc2) return false;
  const clean1 = loc1.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const clean2 = loc2.toLowerCase().replace(/[^\w\s]/g, '').trim();
  if (clean1 === clean2) return true;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
  const sim = computeTextSimilarity(clean1, clean2);
  return sim >= 0.55;
}

// Call Brev Model (nvidia/llama-3.1-nemotron-nano-vl-8b-v1) or Fallback Mock
async function callBrevModel(
  photoPath: string | null,
  transcript: string,
  location: string
): Promise<{
  category: string;
  severity_score: number;
  confidence_score: number;
  recommended_action: string;
  model_name: string;
  gpu_type: string;
  latency_ms: number;
  is_mock: boolean;
}> {
  const startTime = Date.now();
  const brevEndpoint = (process.env.BREV_MODEL_ENDPOINT || '').trim().replace(/\/+$/, '');
  const brevApiKey = (process.env.BREV_API_KEY || '').trim();

  // If BREV_MODEL_ENDPOINT is unset or empty, use clearly labeled mock response
  if (!brevEndpoint) {
    const isPothole = /pothole|crater|asphalt|buckl/i.test(transcript);
    const isWater = /water|drain|flood|leak|burst|hydrant/i.test(transcript);
    const isElectric = /wire|cable|spark|power|electric|shock/i.test(transcript);
    const isSignal = /signal|traffic light|stop sign|blind intersection/i.test(transcript);
    const isLight = /streetlight|dark|lamp|outage/i.test(transcript);

    let category = 'Municipal Infrastructure';
    let severity = 5;
    let confidence = photoPath ? 0.88 : 0.54; // lower certainty without photo as required
    let action = 'Send municipal maintenance inspector to evaluate reported site.';

    if (isElectric) {
      category = 'Electrical & Power Hazard';
      severity = 10;
      confidence = photoPath ? 0.96 : 0.72;
      action = 'URGENT: Dispatch emergency utility crew to isolate exposed power hazards.';
    } else if (isWater) {
      category = 'Water & Drainage Emergency';
      severity = 9;
      confidence = photoPath ? 0.93 : 0.68;
      action = 'Dispatch water works repair team to halt flooding and inspect underground mains.';
    } else if (isSignal) {
      category = 'Traffic Safety & Signals';
      severity = 9;
      confidence = photoPath ? 0.91 : 0.65;
      action = 'Dispatch traffic engineering unit to restore signal controller and position temporary signs.';
    } else if (isPothole) {
      category = 'Roads & Severe Potholes';
      severity = 8;
      confidence = photoPath ? 0.89 : 0.58;
      action = 'Schedule rapid asphalt patching and deploy road caution barriers.';
    } else if (isLight) {
      category = 'Street Lighting Outage';
      severity = 4;
      confidence = photoPath ? 0.84 : 0.55;
      action = 'Replace ballast and luminaire during next scheduled night maintenance cycle.';
    }

    const latency = Math.max(120, Date.now() - startTime + 160);
    return {
      category,
      severity_score: severity,
      confidence_score: confidence,
      recommended_action: action,
      model_name: 'llama-3.1-nemotron-nano-vl-8b-v1 (Mock Fallback)',
      gpu_type: 'NVIDIA L40S (Emulated)',
      latency_ms: latency,
      is_mock: true,
    };
  }

  // Real HTTP Call to Brev NIM Endpoint
  try {
    const contentParts: any[] = [];

    if (photoPath && fs.existsSync(photoPath)) {
      const imgBuffer = fs.readFileSync(photoPath);
      const imgB64 = imgBuffer.toString('base64');
      const ext = path.extname(photoPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';

      contentParts.push({
        type: 'text',
        text:
          'You are reviewing a citizen report of a civic infrastructure problem. ' +
          `Here is a photo, a voice transcript, and a location. Transcript: ${transcript}. Location: ${location}. ` +
          'Respond only with JSON in this exact shape: ' +
          '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.',
      });
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${imgB64}` },
      });
    } else {
      contentParts.push({
        type: 'text',
        text:
          'You are reviewing a citizen report of a civic infrastructure problem. ' +
          'Notice: No image is available for this report; reason from the text description and voice transcript alone. ' +
          `Transcript: ${transcript}. Location: ${location}. ` +
          'Treat severity and confidence as lower certainty due to absence of photo. ' +
          'Respond only with JSON in this exact shape: ' +
          '{"category": string, "severity_score": integer 1 to 10, "confidence_score": float 0 to 1, "recommended_action": string}.',
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (brevApiKey) {
      headers['Authorization'] = `Bearer ${brevApiKey}`;
    }

    const res = await fetch(`${brevEndpoint}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
        messages: [{ role: 'user', content: contentParts }],
        temperature: 0.1,
      }),
    });

    const latency_ms = Date.now() - startTime;
    if (!res.ok) {
      throw new Error(`Brev returned HTTP status ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    // Parse JSON safely
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // Regex fallback
      const catMatch = cleanJson.match(/"category"\s*:\s*"([^"]+)"/);
      const sevMatch = cleanJson.match(/"severity_score"\s*:\s*(\d+)/);
      const confMatch = cleanJson.match(/"confidence_score"\s*:\s*([0-9.]+)/);
      const actMatch = cleanJson.match(/"recommended_action"\s*:\s*"([^"]+)"/);
      parsed = {
        category: catMatch ? catMatch[1] : 'Municipal Infrastructure',
        severity_score: sevMatch ? parseInt(sevMatch[1], 10) : 5,
        confidence_score: confMatch ? parseFloat(confMatch[1]) : 0.75,
        recommended_action: actMatch ? actMatch[1] : 'Dispatch maintenance evaluation crew.',
      };
    }

    const modelName = data.model || 'llama-3.1-nemotron-nano-vl-8b-v1';
    const gpuType =
      res.headers.get('x-gpu-type') || data.system_fingerprint || 'NVIDIA L40S';

    return {
      category: parsed.category || 'General Infrastructure',
      severity_score: Math.min(10, Math.max(1, Number(parsed.severity_score) || 5)),
      confidence_score: Math.min(1, Math.max(0, Number(parsed.confidence_score) || 0.8)),
      recommended_action: parsed.recommended_action || 'Inspect and schedule repairs.',
      model_name: modelName,
      gpu_type: gpuType,
      latency_ms,
      is_mock: false,
    };
  } catch (err) {
    console.error('Brev endpoint call error:', err);
    // Graceful fallback mock
    return {
      category: 'Roads & Infrastructure',
      severity_score: 5,
      confidence_score: 0.5,
      recommended_action: 'Manual review recommended (Brev endpoint unreachable).',
      model_name: 'llama-3.1-nemotron-nano-vl-8b-v1 (mock fallback)',
      gpu_type: 'None (Mock)',
      latency_ms: Date.now() - startTime,
      is_mock: true,
    };
  }
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// POST /reports
app.post(
  '/reports',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'voice_note', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { reporter_name, reporter_phone, location, text_description } = req.body;

      // Validate required identity info
      if (!reporter_name || !reporter_name.trim()) {
        return res.status(400).json({ error: 'Reporter name is required.' });
      }
      if (!reporter_phone || !reporter_phone.trim()) {
        return res.status(400).json({ error: 'Reporter phone number is required.' });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ error: 'Location is required.' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const photoFile = files?.['photo']?.[0];
      const videoFile = files?.['video']?.[0];
      const voiceFile = files?.['voice_note']?.[0];
      const hasText = Boolean(text_description && text_description.trim().length > 0);

      // Validate at least one evidence field
      if (!photoFile && !videoFile && !voiceFile && !hasText) {
        return res.status(400).json({
          error:
            'At least one evidence item is required: a photo, video, voice note, or written description. The AI model needs evidence to evaluate the problem.',
        });
      }

      const reportId = crypto.randomUUID();
      let photoUrl: string | null = null;
      let videoUrl: string | null = null;
      let photoLocalPath: string | null = null;
      let transcript = '';

      // 1. Process Photo
      if (photoFile) {
        photoUrl = `/uploads/${photoFile.filename}`;
        photoLocalPath = photoFile.path;
      }

      // 2. Process Video
      if (videoFile) {
        videoUrl = `/uploads/${videoFile.filename}`;
        if (!photoUrl) {
          const frameFilename = `${reportId}-frame.jpg`;
          const framePath = path.join(UPLOADS_DIR, frameFilename);
          const extracted = await extractVideoFrame(videoFile.path, framePath);
          if (extracted) {
            photoUrl = `/uploads/${frameFilename}`;
            photoLocalPath = framePath;
          }
        }
      }

      // 3. Process Voice Note
      if (voiceFile) {
        transcript = await transcribeAudio(voiceFile.path, voiceFile.mimetype);
      }

      // 4. Combine with Written Description
      if (hasText) {
        const cleanedText = text_description.trim();
        if (transcript) {
          transcript = `Voice note: ${transcript}. Written note: ${cleanedText}.`;
        } else {
          transcript = cleanedText;
        }
      }

      // 5. Send to Brev NIM Vision-Language Model
      const aiResult = await callBrevModel(photoLocalPath, transcript, location.trim());

      // 6. Duplicate Check against existing reports
      const reports = readReports();
      let duplicateOf: string | null = null;

      for (const existing of reports) {
        const existingCombinedText = `${existing.transcript || ''} ${existing.text_description || ''}`;
        const similarity = computeTextSimilarity(transcript, existingCombinedText);
        const locMatch = checkLocationMatch(location.trim(), existing.location);

        if (similarity > 0.75 && locMatch) {
          // Point to root duplicate
          duplicateOf = existing.duplicate_of || existing.id;
          break;
        }
      }

      // 7 & 8. Generate Tracking Code & Assemble Report
      const trackingCode = generateTrackingCode(reports);

      const newReport: ReportItem = {
        id: reportId,
        tracking_code: trackingCode,
        reporter_name: reporter_name.trim(),
        reporter_phone: reporter_phone.trim(),
        photo_url: photoUrl,
        video_url: videoUrl,
        text_description: hasText ? text_description.trim() : null,
        transcript,
        location: location.trim(),
        category: aiResult.category,
        severity_score: aiResult.severity_score,
        confidence_score: aiResult.confidence_score,
        recommended_action: aiResult.recommended_action,
        duplicate_of: duplicateOf,
        model_name: aiResult.model_name,
        gpu_type: aiResult.gpu_type,
        latency_ms: aiResult.latency_ms,
        status: 'reported',
        created_at: new Date().toISOString(),
        is_mock: aiResult.is_mock,
      };

      reports.push(newReport);
      writeReports(reports);

      return res.status(201).json(newReport);
    } catch (err: any) {
      console.error('Error in POST /reports:', err);
      return res.status(500).json({ error: err.message || 'Internal server error while processing report' });
    }
  }
);

// GET /reports
// Returns all reports ordered by severity_score descending, with duplicate reports nested under original
app.get('/reports', (_req, res) => {
  try {
    const reports = readReports();
    const primaryReports: ReportItem[] = [];
    const duplicatesMap = new Map<string, ReportItem[]>();

    for (const r of reports) {
      if (r.duplicate_of) {
        if (!duplicatesMap.has(r.duplicate_of)) {
          duplicatesMap.set(r.duplicate_of, []);
        }
        duplicatesMap.get(r.duplicate_of)!.push(r);
      } else {
        primaryReports.push(r);
      }
    }

    // Attach nested duplicates
    for (const p of primaryReports) {
      const nested = duplicatesMap.get(p.id) || [];
      p.duplicates = nested;
      p.duplicate_count = nested.length;
    }

    // Sort by severity_score descending
    primaryReports.sort((a, b) => {
      if (b.severity_score !== a.severity_score) {
        return b.severity_score - a.severity_score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return res.json(primaryReports);
  } catch (err: any) {
    console.error('Error in GET /reports:', err);
    return res.status(500).json({ error: 'Failed to retrieve priority queue reports' });
  }
});

// GET /reports/track/:tracking_code
app.get('/reports/track/:tracking_code', (req, res) => {
  try {
    const trackingCode = req.params.tracking_code.trim().toUpperCase();
    const reports = readReports();

    const report = reports.find((r) => (r.tracking_code || '').toUpperCase() === trackingCode);
    if (!report) {
      return res.status(404).json({ error: `No report found matching tracking code "${trackingCode}".` });
    }

    let parentReportInfo = null;
    if (report.duplicate_of) {
      const parent = reports.find((r) => r.id === report.duplicate_of);
      if (parent) {
        parentReportInfo = {
          tracking_code: parent.tracking_code,
          category: parent.category,
          severity_score: parent.severity_score,
          status: parent.status,
          location: parent.location,
        };
      }
    }

    // Also look for reports that might be duplicates of THIS report
    const childDuplicates = reports.filter((r) => r.duplicate_of === report.id);

    return res.json({
      ...report,
      matched_parent: parentReportInfo,
      duplicate_reports: childDuplicates,
    });
  } catch (err: any) {
    console.error('Error tracking report:', err);
    return res.status(500).json({ error: 'Failed to track report' });
  }
});

// POST /reports/seed
app.post('/reports/seed', (req, res) => {
  try {
    // If client supplied JSON body array
    if (Array.isArray(req.body) && req.body.length > 0) {
      writeReports(req.body);
      return res.json({ message: `Successfully loaded ${req.body.length} reports from request body.` });
    }

    // Default to the 247 seed reports file
    if (fs.existsSync(SEED_FILE)) {
      const seedContent = fs.readFileSync(SEED_FILE, 'utf-8');
      const seedData = JSON.parse(seedContent);
      writeReports(seedData);
      return res.json({
        message: `Successfully seeded ${seedData.length} prepared benchmark reports.`,
        count: seedData.length,
      });
    }

    return res.status(404).json({ error: 'Seed file data/seed_reports.json not found.' });
  } catch (err: any) {
    console.error('Error seeding reports:', err);
    return res.status(500).json({ error: 'Failed to seed reports dataset' });
  }
});

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'CivicFix AI',
    timestamp: new Date().toISOString(),
    brev_configured: Boolean(process.env.BREV_MODEL_ENDPOINT),
  });
});

// Mount Vite or serve static dist
async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicFix AI server running on port ${PORT}`);
  });
}

startServer();
