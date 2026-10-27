import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { getDatabase } from './db/database';
import { clock } from './clock/clock';
import { authService } from './auth/authService';
import { auditLogger } from './audit/auditLogger';
import { openApiSpec } from './swagger/openapi';

// Route imports
import authRoutes from './routes/authRoutes';
import clockRoutes from './routes/clockRoutes';
import auditRoutes from './routes/auditRoutes';
import fdrRoutes from './routes/fdrRoutes';
import verificationRoutes from './routes/verificationRoutes';
import ruleRoutes from './routes/ruleRoutes';
import notificationRoutes from './routes/notificationRoutes';
import escalationRoutes from './routes/escalationRoutes';
import releaseRoutes from './routes/releaseRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import reportRoutes from './routes/reportRoutes';
import benchmarkRoutes from './routes/benchmarkRoutes';
import importRoutes from './routes/importRoutes';

export function createApp(): Express {
  const app = express();

  // Core database and clock initialization
  const db = getDatabase();
  clock.setDatabase(db);
  authService.setDatabase(db);
  auditLogger.setDatabase(db);

  // Auto-seed initial synthetic dataset if database is empty
  try {
    const fdrCount = (db.prepare('SELECT COUNT(*) as cnt FROM fdrs').get() as { cnt: number })?.cnt || 0;
    if (fdrCount === 0) {
      const { SeedService } = require('./services/seedService');
      SeedService.getInstance().seedAll(db);
      console.log('🌱 Empty database detected: auto-seeded 200 synthetic FDRs with 30 deliberate errors.');
    }
  } catch (seedErr) {
    console.error('Error during auto-seed check:', seedErr);
  }

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static directory for uploaded certificate documents
  const uploadsDir = path.join(__dirname, '../../uploads');
  app.use('/uploads', express.static(uploadsDir));

  // Serve Swagger UI documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // API Health Check
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      portal: 'AICTE FDR-Sentinel',
      version: '1.0.0',
      clock: clock.getStatus(),
      simulation_notice: 'Synthetic data & simulated bank verification active.',
    });
  };
  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  // Mount routes on both /api/* and /* (handles both local standalone Express and Vercel stripped rewrites)
  const routeConfigs = [
    { path: '/auth', router: authRoutes },
    { path: '/clock', router: clockRoutes },
    { path: '/audit', router: auditRoutes },
    { path: '/fdrs', router: fdrRoutes },
    { path: '/verification', router: verificationRoutes },
    { path: '/rules', router: ruleRoutes },
    { path: '/notifications', router: notificationRoutes },
    { path: '/escalations', router: escalationRoutes },
    { path: '/release', router: releaseRoutes },
    { path: '/dashboard', router: dashboardRoutes },
    { path: '/reports', router: reportRoutes },
    { path: '/benchmark', router: benchmarkRoutes },
    { path: '/import', router: importRoutes },
  ];

  for (const { path: routePath, router } of routeConfigs) {
    app.use(`/api${routePath}`, router);
    app.use(routePath, router);
  }

  // Serve client static files if built
  const possiblePaths = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../../server/public'),
    path.join(__dirname, '../../client/dist'),
  ];
  const clientStaticDir = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possiblePaths[0];

  app.use(express.static(clientStaticDir));

  // Fallback for SPA routing
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(clientStaticDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>AICTE FDR-Sentinel</title></head>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
              <h1>AICTE FDR-Sentinel Portal API</h1>
              <p>Backend API is active. Access documentation at <a href="/api/docs">/api/docs</a></p>
              <p>Development client runs on port 3000.</p>
            </body>
          </html>
        `);
      }
    });
  });

  return app;
}
