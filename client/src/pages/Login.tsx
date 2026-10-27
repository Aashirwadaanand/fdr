import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Shield, Lock, User, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, switchRole } = useAuth();
  const { showToast } = useNotifications();

  const [username, setUsername] = useState('admin_officer');
  const [password, setPassword] = useState('Admin@123');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      showToast('Authentication successful', 'success');
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts: { role: UserRole; title: string; u: string; p: string; desc: string }[] = [
    { role: 'ADMIN', title: 'System Administrator', u: 'admin_officer', p: 'Admin@123', desc: 'Rules, demo clock, full config' },
    { role: 'SCRUTINY_OFFICER', title: 'Scrutiny Officer', u: 'scrutiny_officer', p: 'Scrutiny@123', desc: 'Verifies banks & recommends release' },
    { role: 'APPROVING_AUTHORITY', title: 'Approving Authority', u: 'approving_officer', p: 'Approver@123', desc: 'Maker-Checker release sanction' },
    { role: 'INSTITUTION_OFFICER', title: 'Institution Officer', u: 'institution_officer', p: 'Institution@123', desc: 'Delhi Institute (own FDRs only)' },
    { role: 'AUDITOR', title: 'Statutory Auditor', u: 'auditor_officer', p: 'Auditor@123', desc: 'Read-only & cryptographic audit logs' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #071927 0%, #0A2540 50%, #0F3759 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        width: '100%',
        maxWidth: 500,
        padding: '36px 32px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 54,
            height: 54,
            background: 'linear-gradient(135deg, var(--accent-gold) 0%, #B45309 100%)',
            borderRadius: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(232, 156, 25, 0.4)',
            marginBottom: 12
          }}>
            <Shield size={28} color="#071927" />
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#0A2540', margin: 0 }}>
            AICTE FDR-Sentinel
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)', marginTop: 4 }}>
            Security Deposit & FDR Management Portal • Regulation Bureau
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-700)', display: 'block', marginBottom: 6 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--slate-400)' }} />
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-700)', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--slate-400)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', justifyContent: 'center', padding: 11, fontSize: '0.95rem' }}
          >
            {submitting ? 'Authenticating...' : 'Sign In to Regulation Portal'}
          </button>
        </form>

        {/* 1-Click Demo Account Quick Logins */}
        <div style={{ borderTop: '1px solid var(--slate-200)', paddingTop: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
            Quick 1-Click Demo Role Logins:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {demoAccounts.map(demo => (
              <button
                key={demo.u}
                type="button"
                onClick={() => {
                  setUsername(demo.u);
                  setPassword(demo.p);
                  login(demo.u, demo.p);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--slate-200)',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-900)' }}>
                    {demo.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                    {demo.desc}
                  </div>
                </div>
                <ArrowRight size={14} color="var(--slate-400)" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
