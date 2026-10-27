import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  FileKey, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw,
  Bug
} from 'lucide-react';

export const AuditTrail: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [entries, setEntries] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [action, setAction] = useState('');

  // Integrity Check State
  const [verifying, setVerifying] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);

  // Tamper Demo State
  const [tampering, setTampering] = useState(false);

  const fetchEntries = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getAuditEntries({
        page,
        limit: 30,
        search,
        actor_role: actorRole,
        action,
      });
      setEntries(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditIntegrity();
      setIntegrityResult(res);
      if (res.valid) {
        showToast(`Chain integrity verified across ${res.totalEntries} records!`, 'success');
      } else {
        showToast(`Audit tamper detected at sequence #${res.brokenSequence}!`, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleTamperDemo = async () => {
    setTampering(true);
    try {
      const res = await api.tamperAuditDemo();
      showToast(res.message, 'info');
      // Automatically run verification to show the red failure!
      await handleVerifyIntegrity();
      await fetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTampering(false);
    }
  };

  const handleRestoreDemo = async () => {
    setTampering(true);
    try {
      const res = await api.restoreAuditDemo();
      showToast(res.message, 'success');
      await handleVerifyIntegrity();
      await fetchEntries();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTampering(false);
    }
  };

  useEffect(() => {
    fetchEntries(1);
    handleVerifyIntegrity();
  }, [actorRole, action]);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tamper-Evident Hash-Chained Audit Trail</h1>
          <p className="page-subtitle">
            Cryptographically linked immutable activity log. Each record embeds SHA-256(prev_hash + canonical_json) and SQLite triggers prevent unauthorized update or deletion.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleVerifyIntegrity}
            disabled={verifying}
          >
            <ShieldCheck size={14} />
            {verifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}
          </button>

          {isAdmin && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleTamperDemo}
                disabled={tampering}
                title="Deliberately tamper with one audit record to demonstrate fraud detection"
                style={{ borderColor: '#FCA5A5', color: '#DC2626' }}
              >
                <Bug size={14} />
                Tamper Demo
              </button>

              <button
                className="btn btn-outline btn-sm"
                onClick={handleRestoreDemo}
                disabled={tampering}
                title="Restore tampered audit record"
              >
                <RotateCcw size={14} />
                Restore Record
              </button>
            </>
          )}
        </div>
      </div>

      {/* Integrity Banner */}
      {integrityResult && (
        <div style={{
          background: integrityResult.valid ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${integrityResult.valid ? '#A7F3D0' : '#FECACA'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {integrityResult.valid ? (
              <CheckCircle2 size={32} style={{ color: '#059669', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={32} style={{ color: '#DC2626', flexShrink: 0 }} />
            )}

            <div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: integrityResult.valid ? '#065F46' : '#991B1B'
              }}>
                {integrityResult.valid 
                  ? `Cryptographic Chain Integrity Verified (${integrityResult.totalEntries} entries)`
                  : `Cryptographic Chain Breach Detected at Sequence #${integrityResult.brokenSequence}!`}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: integrityResult.valid ? '#047857' : '#B91C1C',
                marginTop: 2
              }}>
                {integrityResult.valid 
                  ? 'All sequential SHA-256 hash pointers and canonical JSON hashes are cryptographically unbroken.'
                  : integrityResult.reason}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: integrityResult.valid ? '#065F46' : '#991B1B', fontWeight: 600 }}>
            Scanned at: {new Date(integrityResult.verifiedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
              Filter by Actor Role
            </label>
            <select
              value={actorRole}
              onChange={e => setActorRole(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
            >
              <option value="">All Roles</option>
              <option value="INSTITUTION_OFFICER">INSTITUTION_OFFICER</option>
              <option value="SCRUTINY_OFFICER">SCRUTINY_OFFICER</option>
              <option value="APPROVING_AUTHORITY">APPROVING_AUTHORITY</option>
              <option value="ADMIN">ADMIN</option>
              <option value="AUDITOR">AUDITOR</option>
              <option value="SYSTEM_SCHEDULER">SYSTEM_SCHEDULER</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
              Filter by Action Type
            </label>
            <input
              type="text"
              placeholder="e.g. LOGIN, FDR_CREATED, CLOCK..."
              value={action}
              onChange={e => setAction(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setActorRole(''); setAction(''); setSearch(''); }}
              style={{ width: '100%' }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Audit Entries Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Seq #</th>
                <th>Actor Details</th>
                <th>Action Recorded</th>
                <th>Entity Type & ID</th>
                <th>Canonical Payload Preview</th>
                <th>Previous Hash Link</th>
                <th>Cryptographic SHA-256 Hash</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                entries.map(e => (
                  <tr key={e.id}>
                    <td>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--slate-700)' }}>
                        #{e.sequence}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{e.actor_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>{e.actor_role}</div>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: e.action.includes('DENIED') || e.action.includes('VIOLATION') ? '#FEE2E2' : '#F1F5F9',
                        color: e.action.includes('DENIED') || e.action.includes('VIOLATION') ? '#991B1B' : '#0F172A'
                      }}>
                        {e.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>{e.entity_type}</span>
                      <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--slate-400)' }}>
                        {e.entity_id?.substring(0, 16)}...
                      </div>
                    </td>
                    <td>
                      <pre style={{
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: '#F8FAFC',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.7rem',
                        color: 'var(--slate-600)'
                      }}>
                        {e.payload_canonical}
                      </pre>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--slate-400)' }}>
                      {e.prev_hash?.substring(0, 12)}...
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#0369A1', fontWeight: 600 }}>
                      {e.hash?.substring(0, 12)}...
                    </td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--slate-500)', whiteSpace: 'nowrap' }}>
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
