import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  uploadAndAnalyze,
  getAnalysis,
  chatAboutScan,
  getHistory,
} from '../controllers/analysisController';
import { listModels, listActiveModels, getModel } from '../controllers/modelsController';

const router = Router();

// ── File Upload Config ─────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.dicom', '.dcm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  },
});

// ── Analysis Routes ────────────────────────────────────────────────────
router.get('/analysis/history', getHistory);
router.post('/analysis/upload', upload.single('image'), uploadAndAnalyze);

router.get('/analysis/:sessionId', getAnalysis);
router.post('/analysis/:sessionId/chat', chatAboutScan);

// ── Model Registry Routes ──────────────────────────────────────────────
router.get('/models', listModels);
router.get('/models/active', listActiveModels);
router.get('/models/:modelId', getModel);

// ── Health ─────────────────────────────────────────────────────────────
router.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default router;
