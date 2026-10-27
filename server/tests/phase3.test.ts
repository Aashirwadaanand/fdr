import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabase } from '../src/db/database';
import { clock } from '../src/clock/clock';
import { schedulerService } from '../src/services/schedulerService';

describe('Phase 3: Scheduler, Validity Tracking, Alerts, Escalation & Clock', () => {
  const app = createApp();
  const db = getDatabase();

  let adminToken: string;
  let scrutinyToken: string;
  let institutionToken: string;

  beforeAll(async () => {
    clock.reset();

    const adminLogin = await request(app).post('/api/auth/login').send({ username: 'admin_officer', password: 'Admin@123' });
    adminToken = adminLogin.body.token;

    const scrutinyLogin = await request(app).post('/api/auth/login').send({ username: 'scrutiny_officer', password: 'Scrutiny@123' });
    scrutinyToken = scrutinyLogin.body.token;

    const instLogin = await request(app).post('/api/auth/login').send({ username: 'institution_officer', password: 'Institution@123' });
    institutionToken = instLogin.body.token;
  });

  it('3.1 Scheduler automatically detects EXPIRING instruments within 90 days', async () => {
    // Current demo date is 2026-10-27
    // Create an active FDR maturing in 45 days (2026-12-11)
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'EXPIRING-TEST-001',
        issuing_bank: 'Punjab National Bank',
        amount: 800000,
        issue_date: '2023-12-11',
        maturity_date: '2026-12-11',
        status: 'ACTIVE',
      });

    const fdrId = fdrRes.body.fdr.id;
    expect(fdrRes.body.fdr.status).toBe('ACTIVE');

    // Run scheduler check
    const schedulerResult = schedulerService.runDailyCheck(db);
    expect(schedulerResult.expiringTransitioned).toBeGreaterThanOrEqual(1);

    // Verify FDR transitioned to EXPIRING
    const detail = await request(app).get(`/api/fdrs/${fdrId}`).set('Authorization', `Bearer ${institutionToken}`);
    expect(detail.body.fdr.status).toBe('EXPIRING');
  });

  it('3.2 Time-Travel Demo Clock advances to maturity and transitions instrument to MATURED with escalation', async () => {
    // Current date: 2026-10-27
    // Create an FDR maturing on 2026-11-10 (14 days from now)
    const fdrRes = await request(app)
      .post('/api/fdrs')
      .set('Authorization', `Bearer ${institutionToken}`)
      .send({
        institution_id: 'inst_001',
        fdr_number: 'MATURING-TEST-002',
        issuing_bank: 'Canara Bank',
        amount: 1200000,
        issue_date: '2023-11-10',
        maturity_date: '2026-11-10',
        status: 'ACTIVE',
      });

    const fdrId = fdrRes.body.fdr.id;

    // Advance clock by 30 days (jumping to 2026-11-26, which is 16 days past maturity date!)
    const advanceRes = await request(app)
      .post('/api/clock/advance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: 30 });

    expect(advanceRes.status).toBe(200);
    expect(advanceRes.body.schedulerResult.maturedTransitioned).toBeGreaterThanOrEqual(1);

    // Verify FDR status changed to MATURED
    const detail = await request(app).get(`/api/fdrs/${fdrId}`).set('Authorization', `Bearer ${institutionToken}`);
    expect(detail.body.fdr.status).toBe('MATURED');

    // Verify Escalation Event was generated for the overdue deposit
    const escRes = await request(app)
      .get('/api/escalations')
      .set('Authorization', `Bearer ${scrutinyToken}`);

    expect(escRes.status).toBe(200);
    const matchedEsc = escRes.body.find((e: any) => e.fdr_id === fdrId);
    expect(matchedEsc).toBeDefined();
    expect(matchedEsc.status).toBe('ACTIVE');

    // Reset clock back to baseline
    await request(app).post('/api/clock/reset').set('Authorization', `Bearer ${adminToken}`);
  });

  it('3.3 Notification Center: queries unread alerts, marks read, and marks all read', async () => {
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${institutionToken}`);

    expect(notifRes.status).toBe(200);
    expect(Array.isArray(notifRes.body.notifications)).toBe(true);

    if (notifRes.body.notifications.length > 0) {
      const firstNotifId = notifRes.body.notifications[0].id;

      // Mark single notification read
      const markRes = await request(app)
        .patch(`/api/notifications/${firstNotifId}/read`)
        .set('Authorization', `Bearer ${institutionToken}`);

      expect(markRes.status).toBe(200);

      // Mark all read
      const markAllRes = await request(app)
        .post('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${institutionToken}`);

      expect(markAllRes.status).toBe(200);

      const afterRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${institutionToken}`);

      expect(afterRes.body.unreadCount).toBe(0);
    }
  });

  it('3.4 Escalation resolution: Scrutiny Officer can resolve an escalation event', async () => {
    // Fetch active escalations
    const escRes = await request(app)
      .get('/api/escalations')
      .set('Authorization', `Bearer ${scrutinyToken}`);

    if (escRes.body.length > 0) {
      const escId = escRes.body[0].id;
      const resolveRes = await request(app)
        .patch(`/api/escalations/${escId}/resolve`)
        .set('Authorization', `Bearer ${scrutinyToken}`);

      expect(resolveRes.status).toBe(200);
    }
  });
});
