import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { StatusBadge } from '../components/StatusBadge';
import { TrustBadge } from '../components/TrustBadge';
import { 
  BarChart3, 
  Download, 
  Clock, 
  FileWarning, 
  AlertTriangle, 
  FileCheck,
  RefreshCw 
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<'pending' | 'maturities' | 'missing_docs' | 'intervention'>('pending');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'pending') {
        res = await api.getPendingVerifications();
      } else if (activeTab === 'maturities') {
        res = await api.getUpcomingMaturities();
      } else if (activeTab === 'missing_docs') {
        res = await api.getMissingDocuments();
      } else {
        res = await api.getInterventionCases();
      }
      setReportData(res.data || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab]);

  const handleDownloadCsv = () => {
    const urls: Record<string, string> = {
      pending: '/api/reports/pending-verifications?format=csv',
      maturities: '/api/reports/upcoming-maturities?format=csv',
      missing_docs: '/api/reports/missing-documents?format=csv',
      intervention: '/api/reports/cases-needing-intervention?format=csv',
    };

    const token = localStorage.getItem('fdr_sentinel_token');
    fetch(urls[activeTab], {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aicte_fdr_${activeTab}_report.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('CSV report downloaded successfully', 'success');
      })
      .catch(err => showToast(`Download failed: ${err.message}`, 'error'));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Regulatory Compliance Reports & Exports</h1>
          <p className="page-subtitle">
            Generate and export statutory monitoring reports across upcoming maturities, pending scrutinies, and high-risk compliance exceptions.
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleDownloadCsv}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Report Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('pending')}
        >
          <FileCheck size={14} /> Pending Verifications
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'maturities' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('maturities')}
        >
          <Clock size={14} /> Upcoming Maturities (90d)
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'missing_docs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('missing_docs')}
        >
          <FileWarning size={14} /> Missing Documents
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'intervention' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('intervention')}
        >
          <AlertTriangle size={14} /> Cases Needing Intervention
        </button>
      </div>

      {/* Table Display */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: '16px 20px', margin: 0 }}>
          <h2 className="card-title">
            {activeTab === 'pending' && 'Pending Deposit Scrutinies & Verifications'}
            {activeTab === 'maturities' && 'Upcoming Deposit Maturities (Next 90 Days)'}
            {activeTab === 'missing_docs' && 'FDR Records Missing Supporting Certificates'}
            {activeTab === 'intervention' && 'Priority Exception Cases Requiring Bureau Intervention'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>
            {reportData.length} Records Found
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>FDR Reference</th>
                <th>Institution</th>
                <th>Issuing Bank</th>
                <th>Deposit Amount</th>
                <th>Status</th>
                {activeTab === 'maturities' && <th>Maturity Date</th>}
                {activeTab === 'intervention' && <th>High-Risk Flags</th>}
                {activeTab === 'intervention' && <th>Open Objections</th>}
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    Generating report data...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    No records found for this report criteria.
                  </td>
                </tr>
              ) : (
                reportData.map((row: any) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      {row.fdr_number || '<MISSING REF>'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.institution_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>{row.institution_code}</div>
                    </td>
                    <td>{row.issuing_bank}</td>
                    <td style={{ fontWeight: 700 }}>₹ {row.amount?.toLocaleString('en-IN')}</td>
                    <td><StatusBadge status={row.status} /></td>
                    {activeTab === 'maturities' && <td style={{ fontWeight: 600 }}>{row.maturity_date}</td>}
                    {activeTab === 'intervention' && (
                      <td>
                        <span style={{ color: '#DC2626', fontWeight: 700 }}>
                          {row.high_risk_flags || 0}
                        </span>
                      </td>
                    )}
                    {activeTab === 'intervention' && (
                      <td>
                        <span style={{ color: '#D97706', fontWeight: 600 }}>
                          {row.open_observations || 0}
                        </span>
                      </td>
                    )}
                    <td style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                      {new Date(row.created_at).toLocaleDateString()}
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
