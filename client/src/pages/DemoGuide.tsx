import React from 'react';
import { 
  BookOpen, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  RefreshCw, 
  CheckSquare, 
  FileKey,
  Users
} from 'lucide-react';
import { PageId } from '../components/Sidebar';

interface DemoGuideProps {
  onNavigate: (page: PageId) => void;
}

export const DemoGuide: React.FC<DemoGuideProps> = ({ onNavigate }) => {
  const steps = [
    {
      num: 1,
      title: 'Select Role & Inspect Active Surveillance Dashboard',
      actor: 'Any Role (e.g. Scrutiny Officer)',
      desc: 'Use the top-right Quick Role Switcher to toggle between demo roles without manual re-login. Inspect the tri-level trust badges, aging buckets (0-7, 8-30, 30+ days), and prioritized officer worklist.',
      icon: <Users size={20} color="#2563EB" />,
      actionLabel: 'Go to Dashboard',
      targetPage: 'dashboard' as PageId,
    },
    {
      num: 2,
      title: 'Deposit Intake & Simulated OCR Field Extraction',
      actor: 'Institution Officer or Scrutiny Officer',
      desc: 'Navigate to Intake & OCR. Paste certificate text or upload a scan. Click "Extract Candidate Fields" to trigger simulated OCR. Inspect the side-by-side comparison and mismatch highlighting before confirming submission.',
      icon: <Sparkles size={20} color="#E89C19" />,
      actionLabel: 'Go to Intake & OCR',
      targetPage: 'intake' as PageId,
    },
    {
      num: 3,
      title: 'Inspect Compliance Triage Flags & Discrepancies',
      actor: 'Scrutiny Officer',
      desc: 'Open any flagged FDR in the Central Repository. View the active triage flags explaining the exact triggering values (e.g. extracted amount mismatch, invalid date sequence, or missing required fields).',
      icon: <AlertTriangle size={20} color="#DC2626" />,
      actionLabel: 'Go to Central Repository',
      targetPage: 'repository' as PageId,
    },
    {
      num: 4,
      title: 'Run Simulated Bank Verification & Trust Badge Elevation',
      actor: 'Scrutiny Officer',
      desc: 'On the FDR detail page, select the "Simulated Core Banking API Adapter" and run verification. Observe the simulated CBS response code, transaction reference, and the trust badge promoting from DECLARED to BANK_CONFIRMED.',
      icon: <ShieldCheck size={20} color="#059669" />,
      actionLabel: 'View Repository FDRs',
      targetPage: 'repository' as PageId,
    },
    {
      num: 5,
      title: 'Time-Travel Demo Clock to Trigger Alerts & Escalations',
      actor: 'Admin',
      desc: 'Click the Demo Date pill in the top navbar. Advance the system clock by +30 or +90 days. The backend scheduler instantly derives EXPIRING and MATURED states, triggers in-app notification alerts, and escalates overdue cases.',
      icon: <Calendar size={20} color="#D97706" />,
      actionLabel: 'Check Notifications in Navbar',
      targetPage: 'dashboard' as PageId,
    },
    {
      num: 6,
      title: 'Renewal / Replacement Linking & Coverage Gap Detection',
      actor: 'Institution Officer',
      desc: 'Register a renewal FDR linking to its predecessor. The portal computes and warns if a statutory coverage gap exists between the predecessor maturity date and renewal issue date.',
      icon: <RefreshCw size={20} color="#0284C7" />,
      actionLabel: 'View Renewal Linking in Detail',
      targetPage: 'repository' as PageId,
    },
    {
      num: 7,
      title: 'Lien Discharge Workflow & Strict Maker-Checker Authorization',
      actor: 'Scrutiny Officer (Recommend) -> Approving Authority (Approve)',
      desc: 'Navigate to Release Workflow. Run the automated 4-point eligibility checklist. Scrutiny Officer submits a recommendation (Maker). Switch role to Approving Authority to sanitize and approve (Checker). The server strictly blocks the recommender from self-approving!',
      icon: <CheckSquare size={20} color="#7C3AED" />,
      actionLabel: 'Go to Release Workflow',
      targetPage: 'release' as PageId,
    },
    {
      num: 8,
      title: 'Cryptographic Audit Trail Integrity & Deliberate Tamper Demo',
      actor: 'Auditor or Admin',
      desc: 'Navigate to Audit Trail Chain. Click "Verify Chain Integrity" to validate sequential SHA-256 links. As Admin, click "Tamper Demo" to deliberately modify a database payload; re-verify to visibly catch the broken sequence, then click "Restore Record" to heal the chain!',
      icon: <FileKey size={20} color="#0D9488" />,
      actionLabel: 'Go to Audit Trail',
      targetPage: 'audit' as PageId,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">5-Minute Portal Tour & Workflow Guide</h1>
          <p className="page-subtitle">
            Follow this step-by-step regulatory workflow to experience all core system capabilities end-to-end.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map(step => (
          <div
            key={step.num}
            className="card"
            style={{
              padding: '18px 22px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: '#F8FAFC',
                border: '1px solid var(--slate-200)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {step.icon}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#0A2540',
                    color: '#FFFFFF'
                  }}>
                    STEP {step.num}
                  </span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--slate-900)' }}>
                    {step.title}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                    [{step.actor}]
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', margin: 0, maxWidth: 760 }}>
                  {step.desc}
                </p>
              </div>
            </div>

            <button
              className="btn btn-outline btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => onNavigate(step.targetPage)}
            >
              {step.actionLabel} <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
