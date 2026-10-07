import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createRouter } from './routes/index.js';
import { errorHandler } from './lib/errors.js';
import { workspaceId, gameVersion } from '../../scripts/game-identity.js';

export function createApp({ db, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'X-Save-Id'] }));
  app.use('/assets', express.static(fileURLToPath(new URL('../public', import.meta.url)), {
    maxAge: '1d', setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  }));
  app.use((req, res, next) => express.json({ limit: req.path === '/api/jogador/saves/importar' ? '32mb' : '32kb' })(req, res, next));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Pokemon-Workspace', workspaceId);
    res.set('X-Pokemon-Version', gameVersion);
    next();
  });
  app.use('/api', createRouter(db, config));
  const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  if (process.env.POKEMON_SIMULATOR_PORTABLE === '1' && existsSync(path.join(frontend, 'index.html'))) {
    app.use((req, res, next) => { res.set('X-Pokemon-Workspace', workspaceId); next(); });
    app.use(express.static(frontend));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/assets')) return next();
      res.sendFile(path.join(frontend, 'index.html'));
    });
  }
  app.use((req, res) => res.status(404).json({ success: false, error: 'Rota nao encontrada.' }));
  app.use(errorHandler);
  return app;
}
