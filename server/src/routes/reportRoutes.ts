import { Router, Response } from 'express';
import { getDatabase } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';
import { clock } from '../clock/clock';

const router = Router();

function convertToCsv(data: Record<string, any>[], fields: string[]): string {
  if (data.length === 0) return fields.join(',') + '\n';
  const header = fields.join(',');
  const rows = data.map(item =>
    fields.map(field => {
      const val = item[field] === null || item[field] === undefined ? '' : String(item[field]);
      // Escape commas, quotes and newlines
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

// 1. Pending verifications report
router.get('/pending-verifications', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      f.id,
      f.fdr_number,
      f.issuing_bank,
      f.amount,
      f.status,
      f.trust_level,
      f.created_at,
      i.name as institution_name,
      i.code as institution_code,
      i.state as institution_state
    FROM fdrs f
    JOIN institutions i ON f.institution_id = i.id
    WHERE f.status IN ('SUBMITTED', 'UNDER_SCRUTINY')
    ORDER BY f.created_at ASC
  `).all() as any[];

  if (req.query.format === 'csv') {
    const csv = convertToCsv(rows, ['id', 'fdr_number', 'issuing_bank', 'amount', 'status', 'trust_level', 'institution_name', 'institution_code', 'created_at']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pending-verifications-report.csv"');
    return res.send(csv);
  }

  res.json({ report: 'Pending Verifications', count: rows.length, data: rows });
});

// 2. Upcoming maturities report
router.get('/upcoming-maturities', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const today = clock.today();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 90);
  const futureIso = futureDate.toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT 
      f.id,
      f.fdr_number,
      f.issuing_bank,
      f.amount,
      f.maturity_date,
      f.status,
      f.trust_level,
      i.name as institution_name,
      i.code as institution_code
    FROM fdrs f
    JOIN institutions i ON f.institution_id = i.id
    WHERE f.status IN ('ACTIVE', 'EXPIRING', 'VERIFIED')
      AND f.maturity_date >= ? AND f.maturity_date <= ?
    ORDER BY f.maturity_date ASC
  `).all(today, futureIso) as any[];

  if (req.query.format === 'csv') {
    const csv = convertToCsv(rows, ['id', 'fdr_number', 'issuing_bank', 'amount', 'maturity_date', 'status', 'institution_name', 'institution_code']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="upcoming-maturities-report.csv"');
    return res.send(csv);
  }

  res.json({ report: 'Upcoming Maturities (Next 90 Days)', count: rows.length, data: rows });
});

// 3. Missing documents report
router.get('/missing-documents', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      f.id,
      f.fdr_number,
      f.issuing_bank,
      f.amount,
      f.status,
      f.trust_level,
      i.name as institution_name,
      i.code as institution_code
    FROM fdrs f
    JOIN institutions i ON f.institution_id = i.id
    WHERE (SELECT COUNT(*) FROM fdr_documents d WHERE d.fdr_id = f.id) = 0
    ORDER BY f.created_at DESC
  `).all() as any[];

  if (req.query.format === 'csv') {
    const csv = convertToCsv(rows, ['id', 'fdr_number', 'issuing_bank', 'amount', 'status', 'institution_name', 'institution_code']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="missing-documents-report.csv"');
    return res.send(csv);
  }

  res.json({ report: 'Missing Supporting Documents', count: rows.length, data: rows });
});

// 4. Cases needing intervention
router.get('/cases-needing-intervention', authenticateToken, requireRole('SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN', 'AUDITOR'), (req: AuthenticatedRequest, res: Response) => {
  const db = getDatabase();
  const today = clock.today();

  const rows = db.prepare(`
    SELECT 
      f.id,
      f.fdr_number,
      f.issuing_bank,
      f.amount,
      f.maturity_date,
      f.status,
      i.name as institution_name,
      i.code as institution_code,
      (SELECT COUNT(*) FROM fdr_flags flg WHERE flg.fdr_id = f.id AND flg.severity IN ('HIGH', 'CRITICAL') AND flg.is_resolved = 0) as high_risk_flags,
      (SELECT COUNT(*) FROM observations o WHERE o.fdr_id = f.id AND o.is_resolved = 0) as open_observations
    FROM fdrs f
    JOIN institutions i ON f.institution_id = i.id
    WHERE f.status = 'MATURED'
       OR (SELECT COUNT(*) FROM fdr_flags flg WHERE flg.fdr_id = f.id AND flg.severity IN ('HIGH', 'CRITICAL') AND flg.is_resolved = 0) > 0
       OR (SELECT COUNT(*) FROM observations o WHERE o.fdr_id = f.id AND o.is_resolved = 0) > 0
    ORDER BY high_risk_flags DESC, open_observations DESC
  `).all() as any[];

  if (req.query.format === 'csv') {
    const csv = convertToCsv(rows, ['id', 'fdr_number', 'issuing_bank', 'amount', 'maturity_date', 'status', 'institution_name', 'high_risk_flags', 'open_observations']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="intervention-cases-report.csv"');
    return res.send(csv);
  }

  res.json({ report: 'Cases Needing Regulatory Intervention', count: rows.length, data: rows });
});

export default router;
