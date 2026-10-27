import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  CheckSquare, 
  ShieldAlert, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  FileText,
  Building,
  RefreshCw
} from 'lucide-react';

export const ReleaseRequests: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Action state
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [recommendNotes, setRecommendNotes] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getReleaseRequests();
      setRequests(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleRecommend = async (reqId: string) => {
    if (!recommendNotes.trim()) {
      showToast('Please provide scrutiny recommendation notes', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.recommendReleaseRequest(reqId, recommendNotes);
      showToast('Release request recommended for bureau approval', 'success');
      setSelectedReq(null);
      setRecommendNotes('');
      await fetchRequests();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecide = async (reqId: string, decision: 'APPROVED' | 'REJECTED') => {
    if (!decisionNotes.trim()) {
      showToast('Please provide decision rationale notes', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.decideReleaseRequest(reqId, decision, decisionNotes);
      showToast(`Release request ${decision.toLowerCase()} successfully`, 'success');
      setSelectedReq(null);
      setDecisionNotes('');
      await fetchRequests();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const canRecommend = ['SCRUTINY_OFFICER', 'ADMIN'].includes(user?.role || '');
  const canApprove = ['APPROVING_AUTHORITY', 'ADMIN'].includes(user?.role || '');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Release & Discharge Workflow</h1>
          <p className="page-subtitle">
            Formal lien discharge and deposit refund authorization with automated compliance eligibility check and server-enforced Maker-Checker segregation.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchRequests}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Maker-Checker Notice Banner */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <UserCheck size={22} style={{ color: '#2563EB', flexShrink: 0 }} />
        <div style={{ fontSize: '0.82rem', color: '#1E40AF' }}>
          <strong>Statutory Maker-Checker Separation:</strong> In compliance with AICTE financial regulations, an officer who performed bank verification or submitted a scrutiny recommendation is strictly prohibited by server-side constraints from acting as the final Approving Authority.
        </div>
      </div>

      {/* Requests Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Type</th>
                <th>FDR Reference</th>
                <th>Institution</th>
                <th>Deposit Sum</th>
                <th>Status</th>
                <th>Eligibility Checklist</th>
                <th>Recommended By</th>
                <th>Decided By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    Loading release requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    No release requests found in registry.
                  </td>
                </tr>
              ) : (
                requests.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.id.substring(0, 12)}...</td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: '#F1F5F9' }}>
                        {r.request_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.fdr_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.institution_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>{r.institution_code}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹ {r.amount?.toLocaleString('en-IN')}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: r.status === 'APPROVED' ? '#D1FAE5' : (r.status === 'REJECTED' ? '#FEE2E2' : (r.status === 'RECOMMENDED' ? '#FEF3C7' : '#EFF6FF')),
                        color: r.status === 'APPROVED' ? '#065F46' : (r.status === 'REJECTED' ? '#991B1B' : (r.status === 'RECOMMENDED' ? '#92400E' : '#1D4ED8'))
                      }}>
                        {r.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {r.checklist_results?.overallEligible ? (
                        <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> Eligible (4/4 Passed)
                        </span>
                      ) : (
                        <span style={{ color: '#DC2626', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={13} /> Incomplete Criteria
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {r.recommended_by_name ? (
                        <div>
                          <strong>{r.recommended_by_name}</strong>
                          <div style={{ color: 'var(--slate-400)', fontSize: '0.68rem' }}>
                            {new Date(r.recommended_at).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--slate-400)' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {r.approved_by_name ? (
                        <div>
                          <strong>{r.approved_by_name}</strong>
                          <div style={{ color: 'var(--slate-400)', fontSize: '0.68rem' }}>
                            {new Date(r.approved_at).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--slate-400)' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedReq(r)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Decision Modal */}
      {selectedReq && (
        <div className="modal-overlay" onClick={() => setSelectedReq(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Release Request Review: {selectedReq.fdr_number}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  {selectedReq.institution_name} ({selectedReq.institution_code})
                </span>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Checklist Results Box */}
            <div style={{ background: '#F8FAFC', border: '1px solid var(--slate-200)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>
                Automated Regulatory Eligibility Checklist:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedReq.checklist_results?.isBankConfirmed ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                  <span>Bank Confirmed Trust Level: <strong>{selectedReq.checklist_results?.details?.trust_level}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedReq.checklist_results?.noOpenObservations ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                  <span>Open Scrutiny Objections: <strong>{selectedReq.checklist_results?.details?.open_observations_count} open</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedReq.checklist_results?.isMaturedOrReplaced ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                  <span>Maturity / Replacement Status: <strong>{selectedReq.checklist_results?.details?.is_matured ? 'Matured' : (selectedReq.checklist_results?.details?.has_replacement ? 'Replacement in Place' : 'Premature without Replacement')}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedReq.checklist_results?.notAlreadyReleased ? <CheckCircle2 size={16} color="#059669" /> : <XCircle size={16} color="#DC2626" />}
                  <span>Lien Status: <strong>{selectedReq.checklist_results?.details?.current_status}</strong></span>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                Institution Reason for Release:
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid var(--slate-200)', borderRadius: 6, padding: 10, fontSize: '0.85rem', marginTop: 4 }}>
                {selectedReq.reason}
              </div>
            </div>

            {/* Maker 2: Scrutiny Officer Recommendation */}
            {selectedReq.status === 'PENDING_RECOMMENDATION' && canRecommend && (
              <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 16, marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Scrutiny Recommendation Notes (Maker 2)
                </label>
                <textarea
                  rows={3}
                  value={recommendNotes}
                  onChange={e => setRecommendNotes(e.target.value)}
                  placeholder="Record verification findings and state recommendation rationale for bureau authority..."
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.82rem', marginBottom: 10 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRecommend(selectedReq.id)}
                  disabled={actionLoading}
                >
                  Submit Scrutiny Recommendation
                </button>
              </div>
            )}

            {/* Checker: Approving Authority Decision */}
            {(selectedReq.status === 'RECOMMENDED' || selectedReq.status === 'PENDING_RECOMMENDATION') && canApprove && (
              <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-700)', marginBottom: 6 }}>
                  Approving Authority Decision (Checker)
                </div>

                {selectedReq.recommendation_notes && (
                  <div style={{ background: '#FFFBEB', padding: 8, borderRadius: 6, fontSize: '0.78rem', color: '#92400E', marginBottom: 10 }}>
                    <strong>Scrutiny Recommendation:</strong> {selectedReq.recommendation_notes} (by {selectedReq.recommended_by_name})
                  </div>
                )}

                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={e => setDecisionNotes(e.target.value)}
                  placeholder="Record formal statutory decision justification..."
                  style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.82rem', marginBottom: 10 }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => handleDecide(selectedReq.id, 'APPROVED')}
                    disabled={actionLoading}
                  >
                    Sanction Release (Discharge Lien)
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDecide(selectedReq.id, 'REJECTED')}
                    disabled={actionLoading}
                  >
                    Reject Release Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
