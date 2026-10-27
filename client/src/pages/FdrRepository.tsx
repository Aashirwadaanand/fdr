import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { TrustBadge } from '../components/TrustBadge';
import { StatusBadge } from '../components/StatusBadge';
import { Search, Filter, Eye, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

interface FdrRepositoryProps {
  onSelectFdr: (fdrId: string) => void;
}

export const FdrRepository: React.FC<FdrRepositoryProps> = ({ onSelectFdr }) => {
  const [fdrs, setFdrs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [bank, setBank] = useState('');
  const [status, setStatus] = useState('');
  const [trustLevel, setTrustLevel] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const fetchFdrs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.getFdrs({
        page,
        limit: 15,
        search,
        issuing_bank: bank,
        status,
        trust_level: trustLevel,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setFdrs(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFdrs(1);
  }, [bank, status, trustLevel, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFdrs(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setBank('');
    setStatus('');
    setTrustLevel('');
    setSortBy('created_at');
    setSortOrder('DESC');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central FDR Repository</h1>
          <p className="page-subtitle">
            Search, filter, and audit institution-wise and instrument-wise security deposit records across India.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => fetchFdrs(pagination.page)}>
          <RefreshCw size={14} /> Refresh List
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
            {/* Search Input */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
                Search Reference / Institution
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--slate-400)' }} />
                <input
                  type="text"
                  placeholder="FDR number, institute code, or keywords..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: 6,
                    border: '1px solid var(--slate-300)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Bank Dropdown */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
                Issuing Bank
              </label>
              <select
                value={bank}
                onChange={e => setBank(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.85rem' }}
              >
                <option value="">All Banks</option>
                <option value="Apex National Commercial Bank">Apex National Commercial Bank</option>
                <option value="Federal Trust Bank of India">Federal Trust Bank of India</option>
                <option value="United Sovereign Bank">United Sovereign Bank</option>
                <option value="Canal Mercantile Bank">Canal Mercantile Bank</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
                Lifecycle Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.85rem' }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active Lien</option>
                <option value="EXPIRING">Expiring Soon (≤90d)</option>
                <option value="MATURED">Matured / Due</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="UNDER_SCRUTINY">Under Scrutiny</option>
                <option value="VERIFIED">Verified</option>
                <option value="RENEWED">Renewed</option>
                <option value="RELEASED">Released</option>
              </select>
            </div>

            {/* Trust Level Dropdown */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', display: 'block', marginBottom: 4 }}>
                Trust Level
              </label>
              <select
                value={trustLevel}
                onChange={e => setTrustLevel(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--slate-300)', fontSize: '0.85rem' }}
              >
                <option value="">All Trust Levels</option>
                <option value="BANK_CONFIRMED">Bank Confirmed (Verified)</option>
                <option value="DOCUMENT_EXTRACTED">Doc Extracted (OCR Checked)</option>
                <option value="DECLARED">Declared (Self-Reported)</option>
              </select>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Search
              </button>
              <button type="button" className="btn btn-outline" onClick={handleResetFilters}>
                Clear
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Repository Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>FDR Reference</th>
                <th>Institution</th>
                <th>Issuing Bank</th>
                <th>Deposit Amount</th>
                <th>Maturity Date</th>
                <th>Lifecycle Status</th>
                <th>Trust Level</th>
                <th>Flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    Loading records from repository...
                  </td>
                </tr>
              ) : fdrs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--slate-500)' }}>
                    No security deposit records match the specified filters.
                  </td>
                </tr>
              ) : (
                fdrs.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--slate-900)' }}>
                        {f.fdr_number || <span style={{ color: '#DC2626' }}>[MISSING REF]</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>
                        A/C: {f.account_number_masked || 'Not provided'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{f.institution_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>{f.institution_code} • {f.institution_state}</div>
                    </td>
                    <td>{f.issuing_bank}</td>
                    <td style={{ fontWeight: 700, color: f.amount <= 0 ? '#DC2626' : 'var(--slate-900)' }}>
                      ₹ {f.amount?.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{f.maturity_date}</span>
                    </td>
                    <td><StatusBadge status={f.status} /></td>
                    <td><TrustBadge level={f.trust_level} /></td>
                    <td>
                      {f.flag_count > 0 ? (
                        <span style={{
                          background: '#FEF2F2',
                          color: '#B91C1C',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          padding: '3px 8px',
                          borderRadius: 4,
                          border: '1px solid #FECACA',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          <AlertCircle size={12} />
                          {f.flag_count} Flag{f.flag_count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem' }}>Clean</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onSelectFdr(f.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderTop: '1px solid var(--slate-200)',
          fontSize: '0.82rem',
          color: 'var(--slate-600)'
        }}>
          <div>
            Showing <strong>{fdrs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</strong> to{' '}
            <strong>{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
            <strong>{pagination.total}</strong> instruments
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchFdrs(pagination.page - 1)}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600 }}>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => fetchFdrs(pagination.page + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
