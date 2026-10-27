import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useClock } from '../context/ClockContext';
import { TrustBadge } from '../components/TrustBadge';
import { StatusBadge } from '../components/StatusBadge';
import { 
  Lock, 
  Clock, 
  AlertTriangle, 
  CheckCheck, 
  DollarSign, 
  FileCheck, 
  ArrowRight,
  TrendingUp,
  Building,
  Hourglass,
  RefreshCw
} from 'lucide-react';

interface DashboardProps {
  onSelectFdr: (fdrId: string) => void;
  onNavigate: (page: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectFdr, onNavigate }) => {
  const { clockStatus } = useClock();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [clockStatus.currentDate]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)' }}>
        <RefreshCw size={28} className="spin" style={{ marginBottom: 12 }} />
        <p>Loading AICTE Regulation Bureau metrics...</p>
      </div>
    );
  }

  const formatAmount = (amt: number) => {
    if (!amt) return '₹ 0';
    if (amt >= 10000000) {
      return `₹ ${(amt / 10000000).toFixed(2)} Cr`;
    }
    if (amt >= 100000) {
      return `₹ ${(amt / 100000).toFixed(2)} Lakh`;
    }
    return `₹ ${amt.toLocaleString('en-IN')}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Regulatory Surveillance & FDR Overview</h1>
          <p className="page-subtitle">
            Centralized monitoring of institutional security deposits, bank lien registrations, and compliance deadlines.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchDashboard} title="Refresh live telemetry">
          <RefreshCw size={14} />
          Refresh Metrics
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
            <Lock size={24} />
          </div>
          <div>
            <div className="stat-label">Active Lien Deposits</div>
            <div className="stat-value">{data?.counts?.ACTIVE || 0}</div>
            <div className="stat-subtext">{formatAmount(data?.totalLienAmount)} total value</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FFFBEB', color: '#D97706' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-label">Expiring Soon (≤ 90d)</div>
            <div className="stat-value">{data?.counts?.EXPIRING || 0}</div>
            <div className="stat-subtext">Action required before maturity</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-label">Matured / Overdue</div>
            <div className="stat-value" style={{ color: '#DC2626' }}>{data?.counts?.MATURED || 0}</div>
            <div className="stat-subtext">Lien breach escalation triggered</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <FileCheck size={24} />
          </div>
          <div>
            <div className="stat-label">Pending Scrutiny</div>
            <div className="stat-value">{data?.counts?.PENDING || 0}</div>
            <div className="stat-subtext">Awaiting verification</div>
          </div>
        </div>
      </div>

      {/* Tri-Level Trust Status & Aging Buckets */}
      <div className="grid-2">
        {/* Trust Badges Summary */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Three-Level Trust Status Breakdown</h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginBottom: 16 }}>
            Progressive verification assurance ladder from institutional declaration to simulated CBS core banking confirmation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: '#ECFDF5',
              borderRadius: 8,
              border: '1px solid #A7F3D0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrustBadge level="BANK_CONFIRMED" />
                <span style={{ fontSize: '0.85rem', color: '#065F46', fontWeight: 500 }}>
                  Direct API / Letter CBS Reconciliation
                </span>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#047857' }}>
                {data?.trustCounts?.BANK_CONFIRMED || 0}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: '#EEF2FF',
              borderRadius: 8,
              border: '1px solid #C7D2FE'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrustBadge level="DOCUMENT_EXTRACTED" />
                <span style={{ fontSize: '0.85rem', color: '#3730A3', fontWeight: 500 }}>
                  Certificate Uploaded & OCR Extracted
                </span>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3730A3' }}>
                {data?.trustCounts?.DOCUMENT_EXTRACTED || 0}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: '#F8FAFC',
              borderRadius: 8,
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrustBadge level="DECLARED" />
                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                  Self-Declared Deposit (Pending Document)
                </span>
              </div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#475569' }}>
                {data?.trustCounts?.DECLARED || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Aging Buckets for Pending Scrutiny */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Pending Verification Aging Buckets</h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginBottom: 16 }}>
            Regulatory turnaround monitoring for deposits submitted by institutions awaiting bureau action.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 8,
              padding: 14,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>0 - 7 DAYS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803D', marginTop: 4 }}>
                {data?.agingBuckets?.['0_to_7_days'] || 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: 2 }}>Within Standard SLA</div>
            </div>

            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 8,
              padding: 14,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400E' }}>8 - 30 DAYS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#B45309', marginTop: 4 }}>
                {data?.agingBuckets?.['8_to_30_days'] || 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#92400E', marginTop: 2 }}>SLA Approaching</div>
            </div>

            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: 14,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B' }}>30+ DAYS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                {data?.agingBuckets?.['over_30_days'] || 0}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#991B1B', marginTop: 2 }}>Breached / Escalated</div>
            </div>
          </div>

          <div style={{ marginTop: 20, padding: 12, background: 'var(--slate-50)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--slate-600)' }}>
            💡 <strong>Regulatory Benchmark:</strong> Standard verification SLA requires Scrutiny Officer initial appraisal within 7 business days. Cases exceeding 30 days trigger tier-3 escalation.
          </div>
        </div>
      </div>

      {/* Bank & Discipline Breakdown */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Bank-Wise FDR Distribution</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Issuing Bank</th>
                  <th>Instruments</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.bankBreakdown?.map((b: any) => (
                  <tr key={b.issuing_bank}>
                    <td style={{ fontWeight: 600 }}>{b.issuing_bank}</td>
                    <td>{b.count}</td>
                    <td style={{ fontWeight: 600 }}>{formatAmount(b.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Discipline / Category Distribution</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Institutions</th>
                  <th>Secured Deposit</th>
                </tr>
              </thead>
              <tbody>
                {data?.categoryBreakdown?.map((c: any) => (
                  <tr key={c.category}>
                    <td style={{ fontWeight: 600 }}>{c.category}</td>
                    <td>{c.fdr_count}</td>
                    <td style={{ fontWeight: 600 }}>{formatAmount(c.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Risk-Ranked Officer Worklist */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Risk-Ranked Officer Worklist</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', margin: 0 }}>
              Prioritized queue: Overdue first, followed by expiring instruments, pending verifications, and compliance flags.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('repository')}>
            View All in Repository <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>FDR Reference</th>
                <th>Institution</th>
                <th>Issuing Bank</th>
                <th>Amount</th>
                <th>Maturity</th>
                <th>Status</th>
                <th>Trust</th>
                <th>Flags</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.riskWorklist?.map((row: any, i: number) => (
                <tr key={row.id}>
                  <td>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: row.risk_rank === 1 ? '#FEE2E2' : (row.risk_rank === 2 ? '#FEF3C7' : '#F1F5F9'),
                      color: row.risk_rank === 1 ? '#991B1B' : (row.risk_rank === 2 ? '#92400E' : '#475569')
                    }}>
                      #{i + 1}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {row.fdr_number || '<MISSING FIELD>'}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{row.institution_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>{row.institution_code}</div>
                  </td>
                  <td>{row.issuing_bank}</td>
                  <td style={{ fontWeight: 600 }}>₹ {row.amount?.toLocaleString('en-IN')}</td>
                  <td>{row.maturity_date}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td><TrustBadge level={row.trust_level} /></td>
                  <td>
                    {row.flag_count > 0 ? (
                      <span style={{
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid #FECACA'
                      }}>
                        {row.flag_count} Flag{row.flag_count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>None</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onSelectFdr(row.id)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
