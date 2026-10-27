import React, { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  FileCheck
} from 'lucide-react';

interface IntakeExtractionProps {
  onSuccess: (fdrId: string) => void;
}

export const IntakeExtraction: React.FC<IntakeExtractionProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // Extraction input mode: 'file' | 'text'
  const [inputMode, setInputMode] = useState<'file' | 'text'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState(`STATE BANK OF INDIA
TERM DEPOSIT RECEIPT / FDR
Branch: Hauz Khas IIT Campus, New Delhi
FDR Ref No: SBI-FDR-2024-001
Account No: 30948817264
Date of Issue: 2024-05-15
Maturity Date: 2027-05-15
Deposit Sum: Rs. 15,00,000.00
Lien Favoring: The Member Secretary, AICTE New Delhi
Interest Rate: 7.25% p.a.`);

  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);

  // Form fields
  const [formData, setFormData] = useState({
    institution_id: user?.institution_id || 'inst_001',
    fdr_number: '',
    issuing_bank: 'State Bank of India',
    branch_name: '',
    account_number_masked: '',
    amount: 1500000,
    issue_date: '2024-05-15',
    maturity_date: '2027-05-15',
    interest_rate: 7.25,
    purpose: 'AICTE Security Deposit',
  });

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Run Simulated Extraction
  const handleExtract = async () => {
    setExtracting(true);
    const bodyFormData = new FormData();
    if (inputMode === 'file' && selectedFile) {
      bodyFormData.append('file', selectedFile);
    } else {
      bodyFormData.append('text', rawText);
    }

    try {
      const res = await api.extractPreview(bodyFormData);
      setExtractionResult(res);

      // Auto-populate form fields from extracted candidates
      if (res.extractedFields) {
        setFormData(prev => ({
          ...prev,
          fdr_number: res.extractedFields.fdr_number || prev.fdr_number,
          issuing_bank: res.extractedFields.issuing_bank || prev.issuing_bank,
          branch_name: res.extractedFields.branch_name || prev.branch_name,
          account_number_masked: res.extractedFields.account_number_masked || prev.account_number_masked,
          amount: res.extractedFields.amount || prev.amount,
          issue_date: res.extractedFields.issue_date || prev.issue_date,
          maturity_date: res.extractedFields.maturity_date || prev.maturity_date,
        }));
      }

      showToast(`Extraction complete (Confidence: ${Math.round((res.confidenceScore || 0.9) * 100)}%)`, 'success');
    } catch (err: any) {
      showToast(`Extraction error: ${err.message}`, 'error');
    } finally {
      setExtracting(false);
    }
  };

  // Submit FDR
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      showToast('Please confirm the reconciliation check before saving', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        amount: Number(formData.amount),
        trust_level: extractionResult ? 'DOCUMENT_EXTRACTED' : 'DECLARED',
        extracted_data: extractionResult ? extractionResult.extractedFields : undefined,
      };

      const res = await api.createFdr(payload);
      showToast('Security deposit created successfully in repository', 'success');
      onSuccess(res.fdr.id);
    } catch (err: any) {
      showToast(`Submission failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Field mismatch detection helper
  const getMismatchWarning = (field: string, formVal: any) => {
    if (!extractionResult?.extractedFields) return null;
    const extractedVal = extractionResult.extractedFields[field];
    if (extractedVal === undefined) return null;

    if (field === 'amount') {
      const numExtracted = Number(extractedVal);
      const numForm = Number(formVal);
      if (Math.abs(numExtracted - numForm) > 1.0) {
        return `Discrepancy: OCR detected ₹ ${numExtracted.toLocaleString('en-IN')}`;
      }
    } else if (String(extractedVal).toLowerCase() !== String(formVal).toLowerCase()) {
      return `Discrepancy: OCR detected "${extractedVal}"`;
    }
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">FDR Intake & Document Extraction</h1>
          <p className="page-subtitle">
            Upload deposit certificate PDF or paste receipt text. The backend simulates OCR field extraction and validates discrepancies side-by-side.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Side: Document / Text Intake & Simulated OCR */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">1. Document Intake (Simulated OCR)</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInputMode('text')}
              >
                Paste Text
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inputMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setInputMode('file')}
              >
                Upload File
              </button>
            </div>
          </div>

          <div style={{
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: 8,
            padding: 10,
            fontSize: '0.78rem',
            color: '#0369A1',
            marginBottom: 14
          }}>
            ℹ️ <strong>Simulated Extraction:</strong> Text parsing operates behind a pluggable interface simulating production OCR engines.
          </div>

          {inputMode === 'file' ? (
            <div style={{
              border: '2px dashed var(--slate-300)',
              borderRadius: 8,
              padding: 30,
              textAlign: 'center',
              marginBottom: 16
            }}>
              <Upload size={32} style={{ color: 'var(--slate-400)', marginBottom: 8 }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                {selectedFile ? selectedFile.name : 'Choose a certificate PDF or scan image'}
              </div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                style={{ fontSize: '0.8rem', marginTop: 8 }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Raw Certificate Text / Scanned Content:
              </label>
              <textarea
                rows={9}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--slate-300)',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem'
                }}
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-accent"
            onClick={handleExtract}
            disabled={extracting}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Sparkles size={16} />
            {extracting ? 'Simulating OCR Extraction...' : 'Extract Candidate Fields'}
          </button>

          {/* Extracted Candidates Summary */}
          {extractionResult && (
            <div style={{
              marginTop: 20,
              background: '#F8FAFC',
              border: '1px solid var(--slate-200)',
              borderRadius: 8,
              padding: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--slate-900)' }}>
                  Extracted Candidates
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#ECFDF5',
                  color: '#065F46'
                }}>
                  Confidence: {Math.round((extractionResult.confidenceScore || 0) * 100)}%
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div><strong>Ref Number:</strong> {extractionResult.extractedFields?.fdr_number || 'N/A'}</div>
                <div><strong>Bank:</strong> {extractionResult.extractedFields?.issuing_bank || 'N/A'}</div>
                <div><strong>Amount:</strong> ₹ {extractionResult.extractedFields?.amount?.toLocaleString('en-IN') || 'N/A'}</div>
                <div><strong>Issue Date:</strong> {extractionResult.extractedFields?.issue_date || 'N/A'}</div>
                <div><strong>Maturity Date:</strong> {extractionResult.extractedFields?.maturity_date || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Side-by-Side Reconciliation Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">2. Side-by-Side Form Reconciliation</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Reference Number */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  FDR Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fdr_number}
                  onChange={e => setFormData({ ...formData, fdr_number: e.target.value })}
                  placeholder="e.g. SBI-FDR-2024-001"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--slate-300)',
                    fontFamily: 'monospace',
                    fontWeight: 600
                  }}
                />
                {getMismatchWarning('fdr_number', formData.fdr_number) && (
                  <div style={{ color: '#DC2626', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}>
                    ⚠️ {getMismatchWarning('fdr_number', formData.fdr_number)}
                  </div>
                )}
              </div>

              {/* Issuing Bank */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Issuing Bank *
                </label>
                <select
                  value={formData.issuing_bank}
                  onChange={e => setFormData({ ...formData, issuing_bank: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)' }}
                >
                  <option value="State Bank of India">State Bank of India</option>
                  <option value="Punjab National Bank">Punjab National Bank</option>
                  <option value="Canara Bank">Canara Bank</option>
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="Apex National Commercial Bank">Apex National Commercial Bank</option>
                  <option value="Federal Trust Bank of India">Federal Trust Bank of India</option>
                  <option value="United Sovereign Bank">United Sovereign Bank</option>
                  <option value="Canal Mercantile Bank">Canal Mercantile Bank</option>
                </select>
              </div>

              {/* Deposit Amount */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Principal Deposit Amount (INR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)', fontWeight: 700 }}
                />
                {getMismatchWarning('amount', formData.amount) && (
                  <div style={{ color: '#DC2626', fontSize: '0.72rem', fontWeight: 600, marginTop: 2 }}>
                    ⚠️ {getMismatchWarning('amount', formData.amount)}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Date of Issue *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.issue_date}
                    onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Maturity Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.maturity_date}
                    onChange={e => setFormData({ ...formData, maturity_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)', fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* Branch & Masked Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={e => setFormData({ ...formData, branch_name: e.target.value })}
                    placeholder="e.g. IIT Campus Branch"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Account Number (Masked)
                  </label>
                  <input
                    type="text"
                    value={formData.account_number_masked}
                    onChange={e => setFormData({ ...formData, account_number_masked: e.target.value })}
                    placeholder="XXXX-XXXX-1234"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--slate-300)' }}
                  />
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid var(--slate-200)',
                borderRadius: 8,
                padding: 12,
                marginTop: 6
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    I confirm that the submitted deposit details have been cross-verified against the physical FDR certificate and agree to trigger automated AICTE compliance rule evaluation.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !confirmed}
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                <CheckCircle2 size={16} />
                {submitting ? 'Submitting & Evaluating...' : 'Save FDR & Register Deposit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
