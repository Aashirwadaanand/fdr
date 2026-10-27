import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload, UserRole } from './authService';
import { auditLogger } from '../audit/auditLogger';
import { getDatabase } from '../db/database';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

// In-memory sliding window rate limiter for login
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const loginRateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 20;

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const record = loginRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    loginRateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingSecs = Math.ceil((record.resetTime - now) / 1000);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Login rate limit exceeded. Please wait ${remainingSecs} seconds before trying again.`,
    });
  }

  record.count += 1;
  next();
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please log in.',
    });
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.',
    });
  }

  req.user = payload;
  next();
}

/**
 * Enforces role-based permissions on the server.
 * If blocked: returns 403 with clear message and writes immediately to the audit log.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      const db = getDatabase();
      auditLogger.log(
        db,
        { id: req.user.id, name: req.user.full_name, role: req.user.role },
        'ACCESS_DENIED_RBAC',
        { type: 'HTTP_ENDPOINT', id: req.originalUrl },
        {
          attempted_role: req.user.role,
          required_roles: allowedRoles,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip || 'unknown'
        }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role '${req.user.role}' is not authorized to perform this action. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
}

/**
 * Enforces that INSTITUTION_OFFICER can only access records belonging to their own institution.
 */
export function enforceInstitutionScope(targetInstitutionId: string, req: AuthenticatedRequest, res: Response): boolean {
  if (!req.user) return false;

  // AICTE regulatory roles can view across all institutions
  if (['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'].includes(req.user.role)) {
    return true;
  }

  // INSTITUTION_OFFICER can strictly only access own institution
  if (req.user.role === 'INSTITUTION_OFFICER') {
    if (req.user.institution_id === targetInstitutionId) {
      return true;
    }

    const db = getDatabase();
    auditLogger.log(
      db,
      { id: req.user.id, name: req.user.full_name, role: req.user.role },
      'ACCESS_DENIED_CROSS_INSTITUTION',
      { type: 'INSTITUTION', id: targetInstitutionId },
      {
        user_institution_id: req.user.institution_id,
        target_institution_id: targetInstitutionId,
        action: req.method + ' ' + req.originalUrl
      }
    );

    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied: Institution Officers can strictly only view and manage records of their own institution.',
    });
    return false;
  }

  return false;
}
