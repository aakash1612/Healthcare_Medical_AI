import express from 'express';
import http from 'http'; // Cleaned up redundant { Server } import
import { Server as SocketServer } from 'socket.io'; // Using this clear alias below
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import apiRouter from './routes';
import { setSocketIO } from './services/analysisService';
import { seedMedicalKnowledge } from './services/ragService';
import { answerFollowUp } from './services/llmService';
import { AnalysisSession } from './models/AnalysisSession';
import { getModelById } from './models/modelRegistry';
import { AnalysisResult, ChatMessage } from './types';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Express App ────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io ──────────────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'] 
});

setSocketIO(io);

io.on('connection', (socket) => {
  logger.info(`[Socket] Client connected: ${socket.id}`);

  // Client joins a session room to receive targeted updates
  socket.on('join:session', (sessionId: string) => {
    socket.join(sessionId);
    logger.info(`[Socket] ${socket.id} joined session ${sessionId}`);
  });

  // Real-time chat over socket
  socket.on('chat:message', async ({ sessionId, question }: { sessionId: string; question: string }) => {
    try {
      socket.emit('chat:thinking', { sessionId });

      const session = await AnalysisSession.findOne({ sessionId });
      if (!session || session.status !== 'complete') {
        socket.emit('chat:error', { error: 'Session not found or incomplete' });
        return;
      }

      const modelDef = getModelById(session.modelId)!;

      // 🌟 FIXED: Convert the strict Mongoose Document to a plain object.
      // This stops TypeScript from breaking over nested schema typings!
      const sessionObj = session.toObject();

      const analysisContext = {
        prediction: {
          predictedClass: sessionObj.prediction?.predictedClass || 'Unknown',
          confidence: sessionObj.prediction?.confidence || 0,
          classScores: sessionObj.prediction?.classScores || {},
        },
        gradcam: {
          // Extracts visual mappings dynamically from the object base layers
          heatmapBase64: (sessionObj as any).gradcamHeatmapPath || '',
          overlayBase64: (sessionObj as any).gradcamOverlayPath || '',
        },
        report: { 
          summary: sessionObj.report?.summary || '',
          findings: sessionObj.report?.findings || '',
          recommendations: sessionObj.report?.recommendations || '',
          differentialDiagnosis: sessionObj.report?.differentialDiagnosis || '',
          confidenceNarrative: sessionObj.report?.confidenceNarrative || '',
          disclaimer: sessionObj.report?.disclaimer || '',
          retrievedSources: [] 
        } as unknown as AnalysisResult['report'],
        modelDef,
      };

      const chatHistory = session.chatHistory.map<ChatMessage>((m) => ({
        id: '',
        sessionId,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

      const { answer, sources } = await answerFollowUp(question, analysisContext as any, chatHistory);

      await session.updateOne({
        $push: {
          chatHistory: [
            { role: 'user', content: question, timestamp: new Date() },
            { role: 'assistant', content: answer, timestamp: new Date() },
          ],
        },
      });

      socket.emit('chat:response', { sessionId, answer, sources });
    } catch (err) {
      logger.error('[Socket] Chat error:', err);
      socket.emit('chat:error', { error: 'Failed to generate response' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Middleware ─────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images & heatmaps as static files
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// ── API Routes ─────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Error Handler ──────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// ── Startup ────────────────────────────────────────────────────────────
async function bootstrap() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-ai';

  try {
    await mongoose.connect(MONGO_URI);
    logger.info(`[MongoDB] Connected: ${MONGO_URI}`);
  } catch (err) {
    logger.error('[MongoDB] Connection failed:', err);
    process.exit(1);
  }

  try {
    await seedMedicalKnowledge();
  } catch (err) {
    logger.warn('[RAG] ChromaDB seeding skipped (service may not be running):', err);
  }

  server.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════╗
║   Explainable Medical AI — Backend               ║
║   HTTP → http://localhost:${PORT}                ║
║   WS   → ws://localhost:${PORT}                  ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

bootstrap();