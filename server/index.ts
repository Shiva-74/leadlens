
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, checkDbHealth } from './db/index.js';
import { sessionMiddleware } from './lib/session.js';
import { apiRouter } from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await initDb();

  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  // Health endpoint — returns boolean status only, never exposes API keys
  app.get('/api/health', async (req, res) => {
    const dbConnected = await checkDbHealth();
    res.json({
      status: dbConnected ? 'ok' : 'degraded',
      database: dbConnected,
      sessionId: req.sessionId,
      providers: {
        nvidia: Boolean(process.env.NVIDIA_API_KEY),
        groq: Boolean(process.env.GROQ_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
      },
      models: {
        primaryText: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
        primaryVoice: 'whisper-large-v3-turbo',
      },
    });
  });

  // Mount all /api routes
  app.use('/api', apiRouter);

  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, () => {
    console.log(`LeadLens server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Set generous timeouts so AI & transcription calls are never cut off prematurely
  server.setTimeout(120000);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
