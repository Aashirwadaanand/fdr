import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { Sliders, Shield, Users, Clock, CheckCircle2, Play, RefreshCw, Key } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { showToast } = useNotifications();
  const [rules, setRules] = useState<any[]>([]);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const ruleList = await api.getRules();
      const userList = await api.getDemoUsers();
      setRules(ruleList);
      setDemoUsers(userList);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggleRule = async (ruleCode: string, currentEnabled: number) => {
    try {
      await api.updateRule(ruleCode, { is_enabled: currentEnabled === 0 });
      showToast(`Rule ${ruleCode} ${currentEnabled === 0 ? 'enabled' : 'disabled'} successfully`, 'success');
      await fetchSettings();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleEvaluateAll = async () => {
    setEvaluating(true);
    try {
      const res = await api.evaluateAllRules();
      showToast(res.message, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bureau Administration & Compliance Rules</h1>
          <p className="page-subtitle">
            Configure automated compliance evaluation rules, adjust regulatory SLA thresholds, and inspect role permission matrices.
          </p>
        </div>

        <button
          className="btn btn-accent btn-sm"
          onClick={handleEvaluateAll}
          disabled={evaluating}
        >
          <Play size={14} />
          {evaluating ? 'Evaluating Repository...' : 'Re-Evaluate All Rules on Repository'}
        </button>
      </div>

      {/* Rule Engine Configurations */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Automated Compliance Rule Toggles (8 Rules)</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', margin: 0 }}>
              Each rule can be toggled on/off. When triggered, flags are stored as triage aids for scrutiny officers.
            </p>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Description</th>
                <th>Status</th>
                <th>Toggle Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>{r.rule_code}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#F1F5F9' }}>
                      {r.category}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: r.severity === 'HIGH' ? '#FEE2E2' : '#FEF3C7',
                      color: r.severity === 'HIGH' ? '#991B1B' : '#92400E'
                    }}>
                      {r.severity}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--slate-600)', maxWidth: 360 }}>
                    {r.description}
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      color: r.is_enabled ? '#059669' : '#94A3B8'
                    }}>
                      {r.is_enabled ? '● Active' : '○ Disabled'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${r.is_enabled ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => handleToggleRule(r.rule_code, r.is_enabled)}
                    >
                      {r.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA & Reminder Thresholds */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Maturity Reminder & SLA Configuration</h2>
          </div>
          <table className="table" style={{ border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Approaching Maturity Thresholds</td>
                <td style={{ fontWeight: 700, color: '#D97706' }}>90, 60, 30, and 7 Days</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Scrutiny Action Turnaround SLA</td>
                <td style={{ fontWeight: 700 }}>7 Calendar Days</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Release Authority Sanction SLA</td>
                <td style={{ fontWeight: 700 }}>5 Calendar Days</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Escalation Level 1 (Institution)</td>
                <td>Issued at 90d, 60d, 30d windows</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Escalation Level 2 (Scrutiny)</td>
                <td>Issued at 7d before maturity or 1-15d overdue</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Escalation Level 3 (Bureau Head)</td>
                <td>Issued when overdue &gt; 15 days or SLA breach</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Role & Permissions Matrix */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Role & Permission Matrix</h2>
          </div>
          <table className="table" style={{ border: 'none', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th>Role</th>
                <th>Intake</th>
                <th>Verify Bank</th>
                <th>Recommend</th>
                <th>Approve</th>
                <th>Audit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 700 }}>INSTITUTION_OFFICER</td>
                <td>✅ Own</td>
                <td>❌</td>
                <td>❌</td>
                <td>❌</td>
                <td>❌</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>SCRUTINY_OFFICER</td>
                <td>✅ All</td>
                <td>✅</td>
                <td>✅</td>
                <td>❌</td>
                <td>✅</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>APPROVING_AUTHORITY</td>
                <td>✅ All</td>
                <td>❌</td>
                <td>❌</td>
                <td>✅ (M-C)</td>
                <td>✅</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>ADMIN</td>
                <td>✅ All</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅ (M-C)</td>
                <td>✅</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 700 }}>AUDITOR</td>
                <td>👁️ View</td>
                <td>👁️ View</td>
                <td>👁️ View</td>
                <td>👁️ View</td>
                <td>✅ Full</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--slate-500)' }}>
            *(M-C) denotes Server-enforced Maker-Checker segregation: Officer who verified or recommended cannot approve.
          </div>
        </div>
      </div>

      {/* Demo User Accounts Reference */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Documented Demo Accounts & Credentials</h2>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Username</th>
                <th>Default Password</th>
                <th>Full Name & Designation</th>
                <th>Access Scope</th>
              </tr>
            </thead>
            <tbody>
              {demoUsers.map(u => (
                <tr key={u.username}>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: '#E0F2FE', color: '#0369A1' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{u.username}</td>
                  <td style={{ fontFamily: 'monospace', color: '#B45309', fontWeight: 600 }}>{u.password}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>{u.designation}</div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--slate-600)' }}>{u.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
