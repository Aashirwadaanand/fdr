import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

let dbInstance: DatabaseSync | null = null;

export interface DBConfig {
  dbPath?: string;
}

export function getDatabase(config?: DBConfig): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbFile = config?.dbPath || process.env.DATABASE_PATH || path.join(__dirname, '../../../fdr_sentinel.db');
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbFile);

  // Enable foreign keys, WAL mode, and busy timeout for concurrent safety
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  // Run migrations
  initializeSchema(dbInstance);

  return dbInstance;
}

export function createTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  initializeSchema(db);
  return db;
}

export function initializeSchema(db: DatabaseSync) {
  // 1. Institutions
  db.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT,
      category TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_institutions_code ON institutions(code);
    CREATE INDEX IF NOT EXISTS idx_institutions_state ON institutions(state);
  `);

  // 2. Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      institution_id TEXT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      designation TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);
  `);

  // 3. FDRs
  db.exec(`
    CREATE TABLE IF NOT EXISTS fdrs (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      fdr_number TEXT NOT NULL,
      issuing_bank TEXT NOT NULL,
      branch_name TEXT,
      ifsc_code TEXT,
      account_number_masked TEXT,
      amount REAL NOT NULL,
      issue_date TEXT NOT NULL,
      maturity_date TEXT NOT NULL,
      interest_rate REAL DEFAULT 0.0,
      status TEXT NOT NULL,
      trust_level TEXT NOT NULL,
      replaces_fdr_id TEXT,
      purpose TEXT DEFAULT 'AICTE Security Deposit',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
      FOREIGN KEY (replaces_fdr_id) REFERENCES fdrs(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fdrs_institution ON fdrs(institution_id);
    CREATE INDEX IF NOT EXISTS idx_fdrs_number ON fdrs(fdr_number);
    CREATE INDEX IF NOT EXISTS idx_fdrs_status ON fdrs(status);
    CREATE INDEX IF NOT EXISTS idx_fdrs_trust_level ON fdrs(trust_level);
    CREATE INDEX IF NOT EXISTS idx_fdrs_maturity_date ON fdrs(maturity_date);
    CREATE INDEX IF NOT EXISTS idx_fdrs_issuing_bank ON fdrs(issuing_bank);
  `);

  // 4. FDR Documents
  db.exec(`
    CREATE TABLE IF NOT EXISTS fdr_documents (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      extracted_data TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fdr_documents_fdr ON fdr_documents(fdr_id);
    CREATE INDEX IF NOT EXISTS idx_fdr_documents_hash ON fdr_documents(sha256_hash);
  `);

  // 5. Verification Records
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      adapter_name TEXT NOT NULL,
      verification_type TEXT NOT NULL,
      result TEXT NOT NULL,
      evidence_payload TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_verification_fdr ON verification_records(fdr_id);
    CREATE INDEX IF NOT EXISTS idx_verification_result ON verification_records(result);
  `);

  // 6. Observations (Scrutiny notes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      note TEXT NOT NULL,
      severity TEXT NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_observations_fdr ON observations(fdr_id);
  `);

  // 7. Release Requests
  db.exec(`
    CREATE TABLE IF NOT EXISTS release_requests (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      checklist_results TEXT,
      recommended_by TEXT,
      recommended_at TEXT,
      recommendation_notes TEXT,
      approved_by TEXT,
      approved_at TEXT,
      decision_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
      FOREIGN KEY (recommended_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_release_fdr ON release_requests(fdr_id);
    CREATE INDEX IF NOT EXISTS idx_release_status ON release_requests(status);
  `);

  // 8. Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
  `);

  // 9. Escalation Events
  db.exec(`
    CREATE TABLE IF NOT EXISTS escalation_events (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      escalation_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      sla_breached INTEGER DEFAULT 0,
      escalated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_escalation_fdr ON escalation_events(fdr_id);
    CREATE INDEX IF NOT EXISTS idx_escalation_level ON escalation_events(escalation_level);
  `);

  // 10. Rule Configs
  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_configs (
      id TEXT PRIMARY KEY,
      rule_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      severity TEXT NOT NULL,
      parameters TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
  `);

  // 11. Rule Evaluation Flags (Triage aids, not fraud verdicts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS fdr_flags (
      id TEXT PRIMARY KEY,
      fdr_id TEXT NOT NULL,
      rule_code TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      message TEXT NOT NULL,
      trigger_values TEXT NOT NULL,
      severity TEXT NOT NULL,
      is_resolved INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (fdr_id) REFERENCES fdrs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_fdr_flags_fdr ON fdr_flags(fdr_id);
    CREATE INDEX IF NOT EXISTS idx_fdr_flags_rule ON fdr_flags(rule_code);
  `);

  // 12. Tamper-Evident Audit Trail (append-only)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT UNIQUE NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_canonical TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_entries(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_entries(created_at);
  `);

  // 13. Demo Clock State
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_clock (
      id INTEGER PRIMARY KEY,
      current_date TEXT NOT NULL,
      offset_days INTEGER NOT NULL DEFAULT 0,
      is_advanced INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  // 14. Setting up DB triggers for Audit Log Immutability
  // Note: we can drop/recreate trigger if needed for intentional demo tampering by ADMIN
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS audit_no_update
    BEFORE UPDATE ON audit_entries
    BEGIN
      SELECT RAISE(FAIL, 'Audit entries are strictly append-only and cannot be updated');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_no_delete
    BEFORE DELETE ON audit_entries
    BEGIN
      SELECT RAISE(FAIL, 'Audit entries are strictly append-only and cannot be deleted');
    END;
  `);

  // Seed default rule configurations if not existing
  seedDefaultRuleConfigs(db);
}

function seedDefaultRuleConfigs(db: DatabaseSync) {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM rule_configs').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const defaultRules = [
    {
      id: 'rule_1',
      rule_code: 'MISSING_REQUIRED_FIELD',
      name: 'Missing Required Field',
      description: 'Flags records lacking mandatory details (reference number, amount, or dates).',
      category: 'COMPLIANCE',
      severity: 'HIGH',
      parameters: JSON.stringify({ fields: ['fdr_number', 'amount', 'issue_date', 'maturity_date', 'issuing_bank'] })
    },
    {
      id: 'rule_2',
      rule_code: 'DUPLICATE_REFERENCE',
      name: 'Duplicate FDR Reference',
      description: 'Flags FDR reference numbers already registered in the system under another record.',
      category: 'FRAUD_PREVENTION',
      severity: 'HIGH',
      parameters: JSON.stringify({})
    },
    {
      id: 'rule_3',
      rule_code: 'INVALID_DATE_SEQUENCE',
      name: 'Issue Date on or After Maturity',
      description: 'Flags instruments where the issue date is greater than or equal to the maturity date.',
      category: 'VALIDITY',
      severity: 'HIGH',
      parameters: JSON.stringify({})
    },
    {
      id: 'rule_4',
      rule_code: 'NON_POSITIVE_AMOUNT',
      name: 'Zero or Negative Amount',
      description: 'Flags instruments registered with zero or negative deposit values.',
      category: 'FINANCIAL',
      severity: 'HIGH',
      parameters: JSON.stringify({ min_amount: 1.0 })
    },
    {
      id: 'rule_5',
      rule_code: 'EXTRACTED_VS_SUBMITTED_MISMATCH',
      name: 'Extracted vs Submitted Discrepancy',
      description: 'Flags discrepancies between OCR extracted candidate fields and officer submitted values.',
      category: 'VERIFICATION',
      severity: 'MEDIUM',
      parameters: JSON.stringify({ tolerance_amount: 0.01 })
    },
    {
      id: 'rule_6',
      rule_code: 'OVERDUE_BUT_ACTIVE',
      name: 'Matured/Overdue Instrument Still Active',
      description: 'Flags instruments past their maturity date that are still marked Active without renewal or release.',
      category: 'LIFECYCLE',
      severity: 'MEDIUM',
      parameters: JSON.stringify({})
    },
    {
      id: 'rule_7',
      rule_code: 'MISSING_SUPPORTING_DOCUMENT',
      name: 'Missing Supporting Document',
      description: 'Flags FDR records that have no physical certificate copy or PDF uploaded.',
      category: 'DOCUMENTATION',
      severity: 'MEDIUM',
      parameters: JSON.stringify({})
    },
    {
      id: 'rule_8',
      rule_code: 'REUSED_DOCUMENT_HASH',
      name: 'Reused Document Hash',
      description: 'Flags uploaded certificate documents whose SHA-256 hash matches a document uploaded to a different FDR.',
      category: 'AUTHENTICITY',
      severity: 'HIGH',
      parameters: JSON.stringify({})
    }
  ];

  const insert = db.prepare(`
    INSERT INTO rule_configs (id, rule_code, name, description, category, is_enabled, severity, parameters, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  for (const r of defaultRules) {
    insert.run(r.id, r.rule_code, r.name, r.description, r.category, r.severity, r.parameters, new Date().toISOString());
  }
}
