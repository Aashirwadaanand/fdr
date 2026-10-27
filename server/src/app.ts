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
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      portal: 'AICTE FDR-Sentinel',
      version: '1.0.0',
      clock: clock.getStatus(),
      simulation_notice: 'Synthetic data & simulated bank verification active.',
    });
  });

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/clock', clockRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/fdrs', fdrRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/rules', ruleRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/escalations', escalationRoutes);
  app.use('/api/release', releaseRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/benchmark', benchmarkRoutes);
  app.use('/api/import', importRoutes);

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
