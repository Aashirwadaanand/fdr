import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { clock } from '../clock/clock';
import { auditLogger } from '../audit/auditLogger';

export type UserRole = 
  | 'INSTITUTION_OFFICER'
  | 'SCRUTINY_OFFICER'
  | 'APPROVING_AUTHORITY'
  | 'ADMIN'
  | 'AUDITOR';

export interface User {
  id: string;
  institution_id: string | null;
  institution_name?: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  designation: string | null;
  is_active: number;
  created_at: string;
}

export interface AuthTokenPayload {
  id: string;
  username: string;
  role: UserRole;
  institution_id: string | null;
  full_name: string;
}

export const JWT_SECRET = process.env.JWT_SECRET || 'aicte-fdr-sentinel-secret-key-2026';

export class AuthService {
  private static instance: AuthService;
  private db: DatabaseSync | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public setDatabase(db: DatabaseSync) {
    this.db = db;
    this.seedDemoUsers();
  }

  public generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      institution_id: user.institution_id,
      full_name: user.full_name,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  }

  public verifyToken(token: string): AuthTokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    } catch {
      return null;
    }
  }

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  public hashPasswordSync(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  public async verifyPassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  public verifyPasswordSync(plain: string, hashed: string): boolean {
    return bcrypt.compareSync(plain, hashed);
  }

  public getUserByUsername(username: string): (User & { institution_name?: string }) | undefined {
    if (!this.db) return undefined;
    const row = this.db.prepare(`
      SELECT u.*, i.name as institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE u.username = ? AND u.is_active = 1
    `).get(username) as unknown as (User & { institution_name?: string }) | undefined;
    return row;
  }

  public getUserById(id: string): (User & { institution_name?: string }) | undefined {
    if (!this.db) return undefined;
    const row = this.db.prepare(`
      SELECT u.*, i.name as institution_name
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE u.id = ? AND u.is_active = 1
    `).get(id) as unknown as (User & { institution_name?: string }) | undefined;
    return row;
  }

  public seedDemoUsers() {
    if (!this.db) return;

    // First ensure baseline institution exists
    const instExists = this.db.prepare('SELECT id FROM institutions WHERE id = ?').get('inst_001');
    if (!instExists) {
      this.db.prepare(`
        INSERT INTO institutions (id, code, name, state, district, category, email, phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'inst_001',
        'AICTE-DL-ENG-001',
        'Delhi Institute of Technology & Advanced Studies',
        'Delhi',
        'South Delhi',
        'Engineering',
        'registrar@ditas.edu.in',
        '+91-11-26591000',
        clock.now().toISOString()
      );
    }

    const demoUsers = [
      {
        id: 'usr_inst_001',
        institution_id: 'inst_001',
        username: 'institution_officer',
        password_plain: 'Institution@123',
        email: 'registrar@ditas.edu.in',
        full_name: 'Dr. Ramesh Sharma',
        role: 'INSTITUTION_OFFICER',
        designation: 'Registrar & Authorized Signatory'
      },
      {
        id: 'usr_scrutiny_001',
        institution_id: null,
        username: 'scrutiny_officer',
        password_plain: 'Scrutiny@123',
        email: 'scrutiny.officer@aicte-india.org',
        full_name: 'Smt. Ananya Deshmukh',
        role: 'SCRUTINY_OFFICER',
        designation: 'Senior Scrutiny Officer - Regulation Bureau'
      },
      {
        id: 'usr_approver_001',
        institution_id: null,
        username: 'approving_officer',
        password_plain: 'Approver@123',
        email: 'director.regulation@aicte-india.org',
        full_name: 'Prof. K. V. Subramanian',
        role: 'APPROVING_AUTHORITY',
        designation: 'Advisor & Bureau Head - AICTE Regulation'
      },
      {
        id: 'usr_admin_001',
        institution_id: null,
        username: 'admin_officer',
        password_plain: 'Admin@123',
        email: 'sysadmin@aicte-india.org',
        full_name: 'Er. Sandeep Verma',
        role: 'ADMIN',
        designation: 'Chief Technology Administrator'
      },
      {
        id: 'usr_auditor_001',
        institution_id: null,
        username: 'auditor_officer',
        password_plain: 'Auditor@123',
        email: 'vigilance.audit@aicte-india.org',
        full_name: 'Shri Vikramaditya Roy',
        role: 'AUDITOR',
        designation: 'Vigilance & Statutory Compliance Auditor'
      }
    ];

    const insertOrIgnore = this.db.prepare(`
      INSERT INTO users (id, institution_id, username, email, password_hash, full_name, role, designation, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        full_name = excluded.full_name
    `);

    for (const u of demoUsers) {
      const hashed = this.hashPasswordSync(u.password_plain);
      insertOrIgnore.run(
        u.id,
        u.institution_id,
        u.username,
        u.email,
        hashed,
        u.full_name,
        u.role,
        u.designation,
        clock.now().toISOString()
      );
    }
  }
}

export const authService = AuthService.getInstance();
