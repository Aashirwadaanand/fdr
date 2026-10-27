import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { clock } from '../clock/clock';

export interface AuditRecord {
  sequence?: number;
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  payload_canonical: string;
  prev_hash: string;
  hash: string;
  created_at: string;
}

export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(',') + '}';
}

const GENESIS_HASH = '0'.repeat(64);

// Temporary memory store for original uncorrupted records so demo can restore
const demoBackupMap = new Map<number, { payload: string; hash: string }>();

export class AuditLogger {
  private static instance: AuditLogger;
  private db: DatabaseSync | null = null;

  private constructor() {}

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public setDatabase(db: DatabaseSync) {
    this.db = db;
  }

  public log(
    db: DatabaseSync,
    actor: { id: string; name: string; role: string },
    action: string,
    entity: { type: string; id: string },
    payload: Record<string, any>
  ): AuditRecord {
    // Get the latest audit record to establish hash chain link
    const lastRow = db.prepare('SELECT sequence, hash FROM audit_entries ORDER BY sequence DESC LIMIT 1').get() as { sequence: number; hash: string } | undefined;
    const prevHash = lastRow ? lastRow.hash : GENESIS_HASH;

    const id = 'aud_' + crypto.randomUUID();
    const createdAt = clock.now().toISOString();
    const payloadCanonical = canonicalizeJson(payload);

    // Compute tamper-evident hash: SHA-256(prev_hash + canonical_json)
    const contentToHash = prevHash + '|' + id + '|' + actor.id + '|' + action + '|' + entity.type + '|' + entity.id + '|' + payloadCanonical + '|' + createdAt;
    const hash = crypto.createHash('sha256').update(contentToHash).digest('hex');

    const insert = db.prepare(`
      INSERT INTO audit_entries (id, actor_id, actor_name, actor_role, action, entity_type, entity_id, payload_canonical, prev_hash, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(id, actor.id, actor.name, actor.role, action, entity.type, entity.id, payloadCanonical, prevHash, hash, createdAt);

    return {
      id,
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action,
      entity_type: entity.type,
      entity_id: entity.id,
      payload_canonical: payloadCanonical,
      prev_hash: prevHash,
      hash,
      created_at: createdAt,
    };
  }

  public verifyIntegrity(db: DatabaseSync): {
    valid: boolean;
    totalEntries: number;
    brokenSequence?: number;
    brokenId?: string;
    reason?: string;
    verifiedAt: string;
  } {
    const entries = db.prepare('SELECT * FROM audit_entries ORDER BY sequence ASC').all() as unknown as AuditRecord[];
    const verifiedAt = clock.now().toISOString();

    if (entries.length === 0) {
      return { valid: true, totalEntries: 0, verifiedAt };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // 1. Verify prev_hash matches previous link in the chain
      if (entry.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenSequence: entry.sequence,
          brokenId: entry.id,
          reason: `Chain broken at sequence #${entry.sequence}: prev_hash does not match preceding record's cryptographic hash. (Expected: ${expectedPrevHash.substring(0, 16)}..., Found: ${entry.prev_hash.substring(0, 16)}...)`,
          verifiedAt
        };
      }

      // 2. Re-compute payload and record hash
      const contentToHash = entry.prev_hash + '|' + entry.id + '|' + entry.actor_id + '|' + entry.action + '|' + entry.entity_type + '|' + entry.entity_id + '|' + entry.payload_canonical + '|' + entry.created_at;
      const recomputedHash = crypto.createHash('sha256').update(contentToHash).digest('hex');

      if (recomputedHash !== entry.hash) {
        return {
          valid: false,
          totalEntries: entries.length,
          brokenSequence: entry.sequence,
          brokenId: entry.id,
          reason: `Payload tamper detected at sequence #${entry.sequence}: computed hash ${recomputedHash.substring(0, 16)}... does not match recorded hash ${entry.hash.substring(0, 16)}...`,
          verifiedAt
        };
      }

      expectedPrevHash = entry.hash;
    }

    return {
      valid: true,
      totalEntries: entries.length,
      verifiedAt
    };
  }

  /**
   * ADMIN-only demo action that deliberately corrupts one audit entry
   * to prove cryptographically that the portal detects unauthorized DB tampering.
   */
  public deliberateTamper(db: DatabaseSync, sequence?: number): {
    success: boolean;
    tamperedSequence: number;
    originalValue: string;
    tamperedValue: string;
  } {
    let targetRow: AuditRecord;
    if (sequence) {
      targetRow = db.prepare('SELECT * FROM audit_entries WHERE sequence = ?').get(sequence) as unknown as AuditRecord;
    } else {
      targetRow = db.prepare('SELECT * FROM audit_entries ORDER BY sequence DESC LIMIT 1').get() as unknown as AuditRecord;
    }

    if (!targetRow) {
      throw new Error('No audit record found to tamper with');
    }

    // Save backup so user can restore
    demoBackupMap.set(targetRow.sequence!, {
      payload: targetRow.payload_canonical,
      hash: targetRow.hash
    });

    const tamperedPayload = JSON.stringify({
      tampered_by: 'DIRECT_SQL_INJECTION_OR_DBA_BYPASS',
      original_content: targetRow.payload_canonical,
      unauthorized_flag: 'MALICIOUS_RECORD_ALTERATION'
    });

    // Temporarily bypass trigger for this intentional test demo
    db.exec('DROP TRIGGER IF EXISTS audit_no_update;');
    db.prepare('UPDATE audit_entries SET payload_canonical = ? WHERE sequence = ?').run(tamperedPayload, targetRow.sequence!);
    // Re-enable immutability trigger immediately
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_no_update
      BEFORE UPDATE ON audit_entries
      BEGIN
        SELECT RAISE(FAIL, 'Audit entries are strictly append-only and cannot be updated');
      END;
    `);

    return {
      success: true,
      tamperedSequence: targetRow.sequence!,
      originalValue: targetRow.payload_canonical,
      tamperedValue: tamperedPayload
    };
  }

  /**
   * Restore the tampered demo record to bring the chain back to valid state.
   */
  public restoreTamperedRecord(db: DatabaseSync, sequence?: number): {
    success: boolean;
    restoredSequence: number;
  } {
    let targetSeq = sequence;
    if (targetSeq === undefined) {
      const keys = Array.from(demoBackupMap.keys());
      if (keys.length === 0) {
        throw new Error('No tampered records available in demo backup to restore');
      }
      targetSeq = keys[keys.length - 1];
    }

    const seqToRestore: number = targetSeq;
    const backup = demoBackupMap.get(seqToRestore);
    if (!backup) {
      throw new Error(`No backup found for sequence #${seqToRestore}`);
    }

    db.exec('DROP TRIGGER IF EXISTS audit_no_update;');
    db.prepare('UPDATE audit_entries SET payload_canonical = ?, hash = ? WHERE sequence = ?').run(backup.payload, backup.hash, seqToRestore);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS audit_no_update
      BEFORE UPDATE ON audit_entries
      BEGIN
        SELECT RAISE(FAIL, 'Audit entries are strictly append-only and cannot be updated');
      END;
    `);

    demoBackupMap.delete(seqToRestore);
    return {
      success: true,
      restoredSequence: seqToRestore
    };
  }
}

export const auditLogger = AuditLogger.getInstance();
