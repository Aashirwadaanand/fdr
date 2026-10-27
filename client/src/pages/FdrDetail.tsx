import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { TrustBadge } from '../components/TrustBadge';
import { StatusBadge } from '../components/StatusBadge';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  FileCheck, 
  Clock, 
  Send,
  Building,
  RefreshCw,
  Info,
  Calendar,
  DollarSign
} from 'lucide-react';

interface FdrDetailProps {
  fdrId: string;
  onBack: () => void;
  onNavigateToRelease: () => void;
}

export const FdrDetail: React.FC<FdrDetailProps> = ({ fdrId, onBack, onNavigateToRelease }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Verification state
  const [adapters, setAdapters] = useState<any[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState('mock_bank_api');
  const [verifying, setVerifying] = useState(false);

  // Observation state
  const [obsNote, setObsNote] = useState('');
  const [obsSeverity, setObsSeverity] = useState('MEDIUM');
  const [addingObs, setAddingObs] = useState(false);

  // Document upload state
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await api.getFdrById(fdrId);
      setData(res);
      const adapterList = await api.getVerificationAdapters();
      setAdapters(adapterList);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [fdrId]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)' }}>
        <RefreshCw size={28} className="spin" style={{ marginBottom: 12 }} />
        <p>Loading security deposit record...</p>
      </div>
    );
  }

  const fdr = data?.fdr;

  const handleTriggerVerification = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyFdr(fdrId, selectedAdapter);
      if (res.result.status === 'MATCH') {
        showToast('Bank verification successful! Trust status promoted to BANK_CONFIRMED.', 'success');
      } else if (res.result.status === 'MISMATCH') {
        showToast('Discrepancy detected: Fictional bank ledger values do not match submitted values.', 'error');
      } else {
        showToast(`Verification completed: ${res.result.status}`, 'info');
      }
      await fetchDetail();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsNote.trim()) return;
    setAddingObs(true);
    try {
      await api.addObservation(fdrId, obsNote, obsSeverity);
      showToast('Scrutiny observation logged to case history', 'success');
      setObsNote('');
      await fetchDetail();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setAddingObs(false);
    }
  };

  const handleResolveObservation = async (obsId: string) => {
    try {
      await api.resolveObservation(fdrId, obsId);
      showToast('Observation marked resolved', 'success');
      await fetchDetail();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.uploadDocument(fdrId, formData);
      showToast(`Certificate uploaded (Version ${res.version}). SHA-256 generated.`, 'success');
      await fetchDetail();
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      {/* Header Back & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Repository
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={onNavigateToRelease}>
            Initiate / View Release Request
          </button>
        </div>
      </div>

      {/* Main Banner Title */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>
                {fdr?.fdr_number || '<MISSING REFERENCE NUMBER>'}
              </h1>
              <StatusBadge status={fdr?.status} />
              <TrustBadge level={fdr?.trust_level} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--slate-600)', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600 }}>{fdr?.institution_name}</span>
              <span>•</span>
              <span>Code: <strong>{fdr?.institution_code}</strong></span>
              <span>•</span>
              <span>State: <strong>{fdr?.institution_state}</strong></span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              Registered Deposit Sum
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              ₹ {fdr?.amount?.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Triage Flags */}
      {data?.flags && data.flags.length > 0 && (
        <div className="card" style={{ background: '#FEF2F2', borderColor: '#FECACA', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertCircle size={20} style={{ color: '#DC2626' }} />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991B1B', margin: 0 }}>
                Compliance Triage Flags ({data.flags.length})
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#B91C1C', fontWeight: 500 }}>
                Notice: Flags are automated triage aids to guide scrutiny officers, not fraud verdicts.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.flags.map((flag: any) => (
              <div
                key={flag.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #FCA5A5',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: '0.82rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <strong style={{ color: '#991B1B' }}>{flag.rule_name} ({flag.rule_code})</strong>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: '#FEE2E2',
                    color: '#991B1B'
                  }}>
                    {flag.severity}
                  </span>
                </div>
                <div style={{ color: 'var(--slate-700)' }}>{flag.message}</div>
                {flag.trigger_values && (
                  <pre style={{
                    background: '#F8FAFC',
                    padding: '4px 8px',
                    borderRadius: 4,
                    marginTop: 4,
                    fontSize: '0.72rem',
                    color: 'var(--slate-600)',
                    overflowX: 'auto'
                  }}>
                    Values: {flag.trigger_values}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Instrument Details & Linked Renewal History */}
      <div className="grid-2">
        {/* Core Instrument Details */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Certificate & Bank Details</h2>
          </div>
          <table className="table" style={{ border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: '40%', color: 'var(--slate-500)' }}>Issuing Bank</td>
                <td style={{ fontWeight: 600 }}>{fdr?.issuing_bank}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Branch Name</td>
                <td>{fdr?.branch_name || 'Main Commercial Branch'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Account No. (Masked)</td>
                <td style={{ fontFamily: 'monospace' }}>{fdr?.account_number_masked || 'XXXX-XXXX-9901'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Date of Issue</td>
                <td>{fdr?.issue_date}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Maturity Date</td>
                <td style={{ fontWeight: 700 }}>{fdr?.maturity_date}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Statutory Purpose</td>
                <td>{fdr?.purpose || 'AICTE Mandatory Institutional Security Deposit'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--slate-500)' }}>Registered At</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{fdr?.created_at}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Linked Renewal History & Gap Detection */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Renewal Chain & Coverage Continuity</h2>
          </div>

          {data?.renewalChain?.replacesFdr ? (
            <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid var(--slate-200)', marginBottom: 14 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: 6 }}>
                Predecessor Instrument:
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                {data.renewalChain.replacesFdr.fdr_number} (₹ {data.renewalChain.replacesFdr.amount?.toLocaleString('en-IN')})
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: 4 }}>
                Matured on: {data.renewalChain.replacesFdr.maturity_date} • Prior Status: {data.renewalChain.replacesFdr.status}
              </div>

              {data.renewalChain.coverageGapDays > 0 ? (
                <div style={{
                  marginTop: 10,
                  padding: 8,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 6,
                  color: '#991B1B',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  ⚠️ Statutory Coverage Gap Detected: {data.renewalChain.coverageGapDays} days between old maturity ({data.renewalChain.replacesFdr.maturity_date}) and renewal issue date ({fdr?.issue_date}).
                </div>
              ) : (
                <div style={{
                  marginTop: 10,
                  padding: 8,
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 6,
                  color: '#065F46',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  ✅ Continuous Coverage: No gap detected between predecessor maturity and renewal issue.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.85rem' }}>
              This instrument is an initial security deposit (not linked to an earlier renewal).
            </div>
          )}

          {data?.renewalChain?.replacedByFdr && (
            <div style={{ background: '#F0FDF4', padding: 14, borderRadius: 8, border: '1px solid #BBF7D0', marginTop: 10 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                Successor Renewal Instrument:
              </div>
              <div style={{ fontWeight: 700, color: '#15803D' }}>
                {data.renewalChain.replacedByFdr.fdr_number} (₹ {data.renewalChain.replacedByFdr.amount?.toLocaleString('en-IN')})
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Bank Verification Panel & Scrutiny Observations */}
      <div className="grid-2">
        {/* Verification Panel */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bank Verification Adapters</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Simulated Pluggable Gateway</span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginBottom: 14 }}>
            Only a successful verification adapter match can elevate instrument trust level to <strong>BANK_CONFIRMED</strong>.
          </p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <select
              value={selectedAdapter}
              onChange={e => setSelectedAdapter(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--slate-300)',
                fontSize: '0.85rem'
              }}
            >
              {adapters.map(a => (
                <option key={a.id} value={a.id} disabled={!a.isEnabled}>
                  {a.name} {!a.isEnabled ? '(Disabled)' : ''}
                </option>
              ))}
            </select>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleTriggerVerification}
              disabled={verifying}
            >
              <ShieldCheck size={14} />
              {verifying ? 'Inquiring...' : 'Run Verification'}
            </button>
          </div>

          {/* Verification History */}
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: 8 }}>
            Verification Records & Evidence Logs ({data?.verifications?.length || 0})
          </div>

          {data?.verifications?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--slate-400)', fontSize: '0.8rem' }}>
              No bank verifications recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data?.verifications?.map((v: any) => (
                <div
                  key={v.id}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 6,
                    padding: 10,
                    fontSize: '0.78rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{v.adapter_name}</span>
                    <span style={{
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: v.result === 'MATCH' ? '#D1FAE5' : '#FEE2E2',
                      color: v.result === 'MATCH' ? '#065F46' : '#991B1B'
                    }}>
                      {v.result}
                    </span>
                  </div>
                  <div style={{ color: 'var(--slate-600)', marginBottom: 4 }}>{v.notes}</div>
                  <pre style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    padding: 6,
                    borderRadius: 4,
                    fontSize: '0.7rem',
                    color: 'var(--slate-500)',
                    overflowX: 'auto'
                  }}>
                    Evidence: {v.evidence_payload}
                  </pre>
                  <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginTop: 4 }}>
                    Verified by: {v.verified_by_name || 'System Officer'} • {new Date(v.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scrutiny Observations */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Scrutiny Observations & Notes</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Officer Audit Notes</span>
          </div>

          {/* Add Observation Form */}
          <form onSubmit={handleAddObservation} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Enter observation note, discrepancy query, or verification memo..."
                value={obsNote}
                onChange={e => setObsNote(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.85rem'
                }}
              />
              <select
                value={obsSeverity}
                onChange={e => setObsSeverity(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.85rem' }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <button className="btn btn-primary btn-sm" type="submit" disabled={addingObs}>
                <Send size={13} /> Add
              </button>
            </div>
          </form>

          {/* Observations List */}
          {data?.observations?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--slate-400)', fontSize: '0.8rem' }}>
              No scrutiny observations logged.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.observations.map((obs: any) => (
                <div
                  key={obs.id}
                  style={{
                    background: obs.is_resolved ? '#F8FAFC' : '#FFFBEB',
                    border: `1px solid ${obs.is_resolved ? 'var(--slate-200)' : '#FDE68A'}`,
                    borderRadius: 6,
                    padding: 10,
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                      {obs.author_name} ({obs.author_role.replace(/_/g, ' ')})
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: obs.is_resolved ? '#E2E8F0' : '#FEF3C7',
                        color: obs.is_resolved ? '#475569' : '#92400E'
                      }}>
                        {obs.is_resolved ? 'RESOLVED' : `OPEN (${obs.severity})`}
                      </span>
                      {!obs.is_resolved && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                          onClick={() => handleResolveObservation(obs.id)}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: '4px 0', color: 'var(--slate-700)' }}>{obs.note}</p>
                  <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)' }}>
                    {new Date(obs.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document Management Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Document Management & Certificate Versions</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', margin: 0 }}>
              Physical certificate PDF / scans stored with cryptographic SHA-256 fingerprinting.
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleDocumentUpload}
              style={{ display: 'none' }}
              accept=".pdf,.png,.jpg,.jpeg"
            />
            <button
              className="btn btn-accent btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
            >
              <Upload size={14} />
              {uploadingDoc ? 'Uploading & Extracting...' : 'Upload New Certificate (PDF/Scan)'}
            </button>
          </div>
        </div>

        {data?.documents?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--slate-400)', fontSize: '0.85rem' }}>
            No certificate documents uploaded yet. Deposit flagged as MISSING_SUPPORTING_DOCUMENT.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Original Filename</th>
                  <th>SHA-256 Checksum Fingerprint</th>
                  <th>Uploaded By</th>
                  <th>Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {data.documents.map((doc: any) => (
                  <tr key={doc.id}>
                    <td>
                      <span style={{ fontWeight: 800, background: '#E0F2FE', color: '#0369A1', padding: '2px 8px', borderRadius: 4 }}>
                        v{doc.version}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{doc.original_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                      {doc.sha256_hash}
                    </td>
                    <td>{doc.uploaded_by_name || 'Officer'}</td>
                    <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
