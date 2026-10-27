import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabase } from '../src/db/database';
import { clock } from '../src/clock/clock';
import { auditLogger } from '../src/audit/auditLogger';

describe('Phase 1: Backend Core, Schema, Auth, Clock & Audit Verification', () => {
  const app = createApp();
  const db = getDatabase();

  beforeAll(() => {
    clock.reset();
  });

  it('1.1 Health endpoint responds with portal status and clock', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.portal).toContain('AICTE FDR-Sentinel');
    expect(res.body.clock.currentDate).toBe('2026-10-27');
  });

  it('1.2 Demo users list returns all 5 required roles', async () => {
    const res = await request(app).get('/api/auth/demo-users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    const roles = res.body.map((u: any) => u.role);
    expect(roles).toContain('INSTITUTION_OFFICER');
    expect(roles).toContain('SCRUTINY_OFFICER');
    expect(roles).toContain('APPROVING_AUTHORITY');
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('AUDITOR');
  });

  it('1.3 Authentication succeeds for demo users with correct JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'institution_officer', password: 'Institution@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('INSTITUTION_OFFICER');
    expect(res.body.user.institution_id).toBe('inst_001');

    // Verify /me with token
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe('institution_officer');
  });

  it('1.4 Authentication fails on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'institution_officer', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
  });

  it('1.5 Role-Based Access Control: Non-admin calling admin endpoint returns 403 and writes to audit log', async () => {
    // Login as institution officer (non-admin)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'institution_officer', password: 'Institution@123' });
    const token = loginRes.body.token;

    // Try to advance clock (admin-only)
    const res = await request(app)
      .post('/api/clock/advance')
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 30 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('INSTITUTION_OFFICER');

    // Verify that the 403 was recorded in the audit trail
    const auditEntries = db.prepare('SELECT * FROM audit_entries WHERE action = ? ORDER BY sequence DESC LIMIT 1')
      .get('ACCESS_DENIED_RBAC') as any;

    expect(auditEntries).toBeDefined();
    expect(auditEntries.actor_role).toBe('INSTITUTION_OFFICER');
    expect(auditEntries.action).toBe('ACCESS_DENIED_RBAC');
  });

  it('1.6 Demo Clock time travel works for Admin and advances date', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin_officer', password: 'Admin@123' });
    const adminToken = adminLogin.body.token;

    // Advance by 15 days
    const advanceRes = await request(app)
      .post('/api/clock/advance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: 15 });

    expect(advanceRes.status).toBe(200);
    expect(advanceRes.body.status.currentDate).toBe('2026-11-11');

    // Reset clock
    const resetRes = await request(app)
      .post('/api/clock/reset')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.status.currentDate).toBe('2026-10-27');
  });

  it('1.7 Tamper-evident Audit Trail: Hash chain verification passes on normal entries', async () => {
    const auditorLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor_officer', password: 'Auditor@123' });
    const auditorToken = auditorLogin.body.token;

    const verifyRes = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.totalEntries).toBeGreaterThan(0);
  });

  it('1.8 Tamper-evident Audit Trail: Deliberate tamper simulation breaks chain and restore fixes it', async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin_officer', password: 'Admin@123' });
    const adminToken = adminLogin.body.token;

    // Execute deliberate tamper
    const tamperRes = await request(app)
      .post('/api/audit/tamper-demo')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(tamperRes.status).toBe(200);
    const tamperedSeq = tamperRes.body.result.tamperedSequence;

    // Now verify integrity - must report invalid and flag the broken sequence!
    const verifyRes = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(false);
    expect(verifyRes.body.brokenSequence).toBe(tamperedSeq);
    expect(verifyRes.body.reason).toBeDefined();

    // Now restore
    const restoreRes = await request(app)
      .post('/api/audit/restore-demo')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(restoreRes.status).toBe(200);

    // Verify again - chain must be valid now!
    const verifyResAfter = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(verifyResAfter.body.valid).toBe(true);
  });

  it('1.9 Database Level Immutability: SQLite trigger aborts direct UPDATE on audit entries', () => {
    expect(() => {
      db.prepare('UPDATE audit_entries SET action = ? WHERE sequence = 1').run('ILLEGAL_UPDATE');
    }).toThrow(/Audit entries are strictly append-only/);
  });
});
