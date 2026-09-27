import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  Report,
  getAllReports,
  getReportsHierarchy,
  getReportByTrackingCode,
  generateNextTrackingCode,
  insertReport,
  seedReports,
  findDuplicateReport,
} from './db';
import { classifyReportWithVLM, transcribeAudioFile } from './ai';
import { extractVideoFrame } from './video';
import { INITIAL_DEMO_REPORTS } from './seedData';

// Seed demo data if database is empty on start
if (getAllReports().length === 0) {
  seedReports(INITIAL_DEMO_REPORTS);
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export const apiRouter = express.Router();

export const apiApp = express();
apiApp.use(apiRouter);

// Parse json and urlencoded
apiRouter.use(express.json({ limit: '20mb' }));
apiRouter.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded media
apiRouter.use('/uploads', express.static(UPLOADS_DIR));

/**
 * POST /reports
 * Accepts multipart/form-data:
 * - reporter_name (string, required)
 * - reporter_phone (string, required)
 * - location (string, required)
 * - text_description (string, optional)
 * - photo (file, optional)
 * - video (file, optional)
 * - audio / voice (file, optional)
 * - browser_transcript (string, optional)
 */
apiRouter.post(
  '/reports',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'voice', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const reporter_name = (req.body.reporter_name || '').trim();
      const reporter_phone = (req.body.reporter_phone || '').trim();
      const location = (req.body.location || '').trim();
      const text_description = (req.body.text_description || '').trim();
      const browser_transcript = (req.body.browser_transcript || '').trim();

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const photoFile = files?.photo?.[0];
      const videoFile = files?.video?.[0];
      const audioFile = files?.audio?.[0] || files?.voice?.[0];

      // Validate required identity fields
      if (!reporter_name) {
        res.status(400).json({ error: 'Reporter name is required.' });
        return;
      }
      if (!reporter_phone) {
        res.status(400).json({ error: 'Reporter phone number is required.' });
        return;
      }
      if (!location) {
        res.status(400).json({ error: 'Location is required.' });
        return;
      }

      // Validate at least one evidence field
      const hasPhoto = Boolean(photoFile);
      const hasVideo = Boolean(videoFile);
      const hasAudio = Boolean(audioFile);
      const hasText = Boolean(text_description);

      if (!hasPhoto && !hasVideo && !hasAudio && !hasText) {
        res.status(400).json({
          error: 'At least one evidence field (photo, video, voice note, or written description) must be provided so the AI model has evidence to analyze.',
        });
        return;
      }

      let photo_url: string | null = null;
      let photo_local_path: string | null = null;
      let video_url: string | null = null;

      // 1. If photo file is present, save it and get photo_url
      if (photoFile) {
        photo_url = `/uploads/${photoFile.filename}`;
        photo_local_path = photoFile.path;
      }

      // 2. If video file is present
      if (videoFile) {
        video_url = `/uploads/${videoFile.filename}`;
        // If no photo was provided, extract a single representative frame
        if (!photo_url) {
          const frameFilename = await extractVideoFrame(videoFile.path, UPLOADS_DIR);
          if (frameFilename) {
            photo_url = `/uploads/${frameFilename}`;
            photo_local_path = path.join(UPLOADS_DIR, frameFilename);
          }
        }
      }

      // 3. Audio voice note transcription
      let voice_transcript = '';
      if (audioFile) {
        voice_transcript = await transcribeAudioFile(audioFile.path, audioFile.mimetype);
      }
      if (!voice_transcript && browser_transcript) {
        voice_transcript = browser_transcript;
      }

      // 4. Combine transcript and text_description per spec:
      // "If a text description is present, append it to transcript.
      //  If both a voice note and a text description are present, combine them,
      //  for example 'Voice note: {transcript}. Written note: {text_description}.'"
      let combinedTranscript = '';
      if (voice_transcript && text_description) {
        combinedTranscript = `Voice note: ${voice_transcript}. Written note: ${text_description}.`;
      } else if (voice_transcript) {
        combinedTranscript = voice_transcript;
      } else if (text_description) {
        combinedTranscript = text_description;
      }

      // 5. Send combination of photo_url and transcript to Brev model endpoint
      const classification = await classifyReportWithVLM({
        photoPath: photo_local_path,
        transcript: combinedTranscript,
        location,
      });

      // 6. Duplicate check against existing reports
      const matchedDuplicate = findDuplicateReport(combinedTranscript, location);
      const duplicate_of = matchedDuplicate ? matchedDuplicate.id : null;

      // 8. Generate tracking code CFX-2026-XXXX
      const tracking_code = generateNextTrackingCode();

      // Assemble new report record
      const newReport: Report = {
        id: crypto.randomUUID(),
        tracking_code,
        reporter_name,
        reporter_phone,
        photo_url,
        video_url,
        text_description: text_description || null,
        transcript: combinedTranscript || null,
        location,
        category: classification.category,
        severity_score: classification.severity_score,
        confidence_score: classification.confidence_score,
        duplicate_of,
        model_name: classification.model_name,
        gpu_type: classification.gpu_type,
        latency_ms: classification.latency_ms,
        status: 'reported',
        created_at: new Date().toISOString(),
        recommended_action: classification.recommended_action,
        mock: classification.mock,
      };

      // 9. Insert row and return it
      insertReport(newReport);

      res.status(201).json({
        ...newReport,
        duplicate_matched_code: matchedDuplicate ? matchedDuplicate.tracking_code : null,
        duplicate_matched_category: matchedDuplicate ? matchedDuplicate.category : null,
      });
    } catch (err: any) {
      console.error('Error in POST /reports:', err);
      res.status(500).json({ error: err.message || 'Internal server error processing report.' });
    }
  }
);

/**
 * GET /reports
 * Returns all reports ordered by severity_score descending,
 * with duplicate reports nested under the original report they match
 */
apiRouter.get('/reports', (_req: Request, res: Response) => {
  try {
    const hierarchicalReports = getReportsHierarchy();
    res.json(hierarchicalReports);
  } catch (err: any) {
    console.error('Error in GET /reports:', err);
    res.status(500).json({ error: 'Failed to retrieve reports priority queue.' });
  }
});

/**
 * GET /reports/track/:tracking_code
 * Returns the single report matching that tracking code
 */
apiRouter.get('/reports/track/:tracking_code', (req: Request, res: Response): void => {
  try {
    const { tracking_code } = req.params;
    const report = getReportByTrackingCode(tracking_code);
    if (!report) {
      res.status(404).json({ error: `Report with tracking code "${tracking_code}" was not found.` });
      return;
    }

    let parentReport: Report | null = null;
    if (report.duplicate_of) {
      const all = getAllReports();
      parentReport = all.find(r => r.id === report.duplicate_of) || null;
    }

    res.json({
      ...report,
      parent_report: parentReport
        ? {
            tracking_code: parentReport.tracking_code,
            category: parentReport.category,
            severity_score: parentReport.severity_score,
            status: parentReport.status,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error in GET /reports/track:', err);
    res.status(500).json({ error: 'Failed to look up tracking code.' });
  }
});

/**
 * POST /reports/seed
 * Seed the database with demo reports
 */
apiRouter.post('/reports/seed', (req: Request, res: Response): void => {
  try {
    let reportsToSeed = INITIAL_DEMO_REPORTS;

    if (Array.isArray(req.body) && req.body.length > 0) {
      reportsToSeed = req.body;
    } else if (req.body && Array.isArray(req.body.reports)) {
      reportsToSeed = req.body.reports;
    }

    const count = seedReports(reportsToSeed);
    res.json({
      message: `Successfully seeded ${count} reports into database.`,
      seeded_count: count,
      total_reports: getAllReports().length,
    });
  } catch (err: any) {
    console.error('Error in POST /reports/seed:', err);
    res.status(500).json({ error: 'Failed to seed reports.' });
  }
});
