import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../auth/authService';
import { authenticateToken, AuthenticatedRequest, loginRateLimiter } from '../auth/middleware';
import { auditLogger } from '../audit/auditLogger';
import { getDatabase } from '../db/database';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation Error', details: result.error.errors });
  }

  const { username, password } = result.data;
  const user = authService.getUserByUsername(username);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
  }

  const isValid = authService.verifyPasswordSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
  }

  const token = authService.generateToken(user);

  // Write login action to audit log
  const db = getDatabase();
  auditLogger.log(
    db,
    { id: user.id, name: user.full_name, role: user.role },
    'USER_LOGIN',
    { type: 'USER', id: user.id },
    { username: user.username, role: user.role }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      designation: user.designation,
      institution_id: user.institution_id,
      institution_name: user.institution_name,
    },
  });
});

router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = authService.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    designation: user.designation,
    institution_id: user.institution_id,
    institution_name: user.institution_name,
  });
});

// Demo accounts for quick role-switching in the UI and test documentation
router.get('/demo-users', (_req: Request, res: Response) => {
  res.json([
    {
      role: 'INSTITUTION_OFFICER',
      username: 'institution_officer',
      password: 'Institution@123',
      name: 'Dr. Ramesh Sharma',
      designation: 'Registrar, Delhi Institute of Tech',
      institution: 'Delhi Institute of Technology & Advanced Studies',
      description: 'Can manage and submit FDRs for their own institution only'
    },
    {
      role: 'SCRUTINY_OFFICER',
      username: 'scrutiny_officer',
      password: 'Scrutiny@123',
      name: 'Smt. Ananya Deshmukh',
      designation: 'Senior Scrutiny Officer',
      description: 'Scrutinizes deposits, triggers bank verifications, and makes release recommendations'
    },
    {
      role: 'APPROVING_AUTHORITY',
      username: 'approving_officer',
      password: 'Approver@123',
      name: 'Prof. K. V. Subramanian',
      designation: 'Advisor & Bureau Head',
      description: 'Approves or rejects release requests (enforcing Maker-Checker separation)'
    },
    {
      role: 'ADMIN',
      username: 'admin_officer',
      password: 'Admin@123',
      name: 'Er. Sandeep Verma',
      designation: 'Chief Technology Administrator',
      description: 'System configuration, rule toggles, SLA values, and demo time-travel clock'
    },
    {
      role: 'AUDITOR',
      username: 'auditor_officer',
      password: 'Auditor@123',
      name: 'Shri Vikramaditya Roy',
      designation: 'Vigilance & Statutory Auditor',
      description: 'Read-only access across all records including the cryptographic audit trail'
    }
  ]);
});

export default router;
