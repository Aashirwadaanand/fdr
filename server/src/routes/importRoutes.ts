import { Router, Response } from 'express';
import multer from 'multer';
import { getDatabase } from '../db/database';
import { importService } from '../services/importService';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Bulk CSV import with row-level validation and error reporting
router.post('/bulk', authenticateToken, requireRole('INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN'), upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  let csvText = '';
  if (req.file) {
    csvText = req.file.buffer.toString('utf-8');
  } else if (req.body.csv_content) {
    csvText = req.body.csv_content;
  } else {
    return res.status(400).json({ error: 'Please provide CSV file or csv_content string' });
  }

  const db = getDatabase();
  const actor = { id: req.user!.id, name: req.user!.full_name, role: req.user!.role };

  try {
    const result = importService.importFdrs(db, csvText, actor);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process bulk import', details: err.message });
  }
});

// Download sample CSV template
router.get('/sample-template', authenticateToken, (_req: AuthenticatedRequest, res: Response) => {
  const sampleCsv = `institution_code,fdr_number,issuing_bank,branch_name,amount,issue_date,maturity_date,purpose
AICTE-DL-ENG-001,FDR-APEX-2024-9901,Apex National Commercial Bank,South Delhi Branch,1500000,2024-01-15,2027-01-15,AICTE Security Deposit
AICTE-DL-ENG-001,FDR-FED-2024-9902,Federal Trust Bank of India,Hauz Khas Branch,2000000,2024-02-10,2027-02-10,AICTE Security Deposit
`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="fdr_sentinel_bulk_import_template.csv"');
  res.send(sampleCsv);
});

export default router;
