import React, { useState } from 'react';
import { api } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { Upload, Download, CheckCircle2, AlertTriangle, FileSpreadsheet, RefreshCw } from 'lucide-react';

export const BulkImport: React.FC = () => {
  const { showToast } = useNotifications();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDownloadTemplate = () => {
    const token = localStorage.getItem('fdr_sentinel_token');
    fetch('/api/import/sample-template', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fdr_sentinel_bulk_import_template.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Template downloaded', 'success');
      })
      .catch(err => showToast(err.message, 'error'));
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('Please select a CSV file to upload', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.bulkImport(formData);
      setResult(res);
      showToast(`Bulk import processed: ${res.importedCount} imported, ${res.failedCount} errors`, res.failedCount === 0 ? 'success' : 'info');
    } catch (err: any) {
      showToast(`Import error: ${err.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bulk CSV Import & Batch Ingestion</h1>
          <p className="page-subtitle">
            Upload institutional deposit batches with strict row-level schema validation and error reporting. Valid rows are committed; invalid rows are highlighted with failure causes.
          </p>
        </div>

        <button className="btn btn-outline btn-sm" onClick={handleDownloadTemplate}>
          <Download size={14} /> Download Sample CSV Template
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleImport}>
          <div style={{
            border: '2px dashed var(--slate-300)',
            borderRadius: 8,
            padding: 30,
            textAlign: 'center',
            marginBottom: 16
          }}>
            <FileSpreadsheet size={36} style={{ color: 'var(--accent-gold)', marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
              {file ? file.name : 'Select or drop FDR Batch CSV file'}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginBottom: 12 }}>
              Supported columns: institution_code, fdr_number, issuing_bank, branch_name, amount, issue_date, maturity_date, purpose
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
            >
              <Upload size={14} />
              {uploading ? 'Validating & Ingesting...' : 'Upload & Process Batch'}
            </button>
          </div>
        </form>
      </div>

      {/* Import Result Box */}
      {result && (
        <div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="stat-label">Total Rows Analyzed</div>
                <div className="stat-value">{result.totalRows}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="stat-label">Successfully Ingested</div>
                <div className="stat-value" style={{ color: '#059669' }}>{result.importedCount}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="stat-label">Rejected / Erroneous Rows</div>
                <div className="stat-value" style={{ color: result.failedCount > 0 ? '#DC2626' : '#059669' }}>
                  {result.failedCount}
                </div>
              </div>
            </div>
          </div>

          {/* Row-Level Errors Table */}
          {result.errors?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Row-Level Ingestion Rejection Report</h2>
                <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
                  {result.errors.length} Rows Failed Validation
                </span>
              </div>

              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>CSV Row #</th>
                      <th>FDR Reference</th>
                      <th>Rejection Reasons</th>
                      <th>Raw Row Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err: any, idx: number) => (
                      <tr key={idx}>
                        <td>
                          <span style={{ fontWeight: 800, color: '#B91C1C' }}>
                            Line {err.rowNumber}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {err.fdrNumber || '<BLANK>'}
                        </td>
                        <td>
                          <ul style={{ margin: 0, paddingLeft: 18, color: '#991B1B', fontSize: '0.78rem' }}>
                            {err.reasons.map((r: string, rIdx: number) => (
                              <li key={rIdx}>{r}</li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          <pre style={{
                            maxWidth: 300,
                            overflowX: 'auto',
                            fontSize: '0.68rem',
                            background: '#F8FAFC',
                            padding: 4,
                            borderRadius: 4,
                            color: 'var(--slate-600)'
                          }}>
                            {JSON.stringify(err.rawData)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
