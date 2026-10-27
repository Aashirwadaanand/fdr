import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Play, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const Benchmark: React.FC = () => {
  const { showToast } = useNotifications();
  const [benchmark, setBenchmark] = useState<any>(null);
  const [scenarios, setScenarios] = useState<any>(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(true);
  const [runningScenarios, setRunningScenarios] = useState(false);

  const fetchBenchmark = async () => {
    setLoadingBenchmark(true);
    try {
      const data = await api.getBenchmark();
      setBenchmark(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingBenchmark(false);
    }
  };

  const handleRunScenarios = async () => {
    setRunningScenarios(true);
    try {
      const data = await api.getScenarios();
      setScenarios(data);
      showToast(`Ran ${data.scenarios.length} scenarios: ${data.totalPassed} Passed, ${data.totalFailed} Failed`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setRunningScenarios(false);
    }
  };

  useEffect(() => {
    fetchBenchmark();
    handleRunScenarios();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Functional Benchmark & Scenario Verification</h1>
          <p className="page-subtitle">
            Live accuracy telemetry: seeded error catch rate, false-positive validation, scan latency, and cryptographic tamper detection over 100 simulated edits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={fetchBenchmark}
            disabled={loadingBenchmark}
          >
            <RefreshCw size={14} /> Re-Scan Benchmark
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRunScenarios}
            disabled={runningScenarios}
          >
            <Play size={14} /> {runningScenarios ? 'Running Scenarios...' : 'Run Scenario Suite'}
          </button>
        </div>
      </div>

      {/* Benchmark Disclaimer Banner */}
      <div style={{
        background: '#FFFBEB',
        border: '1px solid #FCD34D',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 18px',
        marginBottom: 20,
        fontSize: '0.82rem',
        color: '#92400E',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
        <AlertCircle size={18} style={{ color: '#D97706', flexShrink: 0 }} />
        <span>
          <strong>Regulatory Notice:</strong> {benchmark?.disclaimer || 'Synthetic functional test, not a real-world accuracy claim.'} Evaluates automated detection efficiency on deterministic synthetic repository errors.
        </span>
      </div>

      {/* Top Benchmark KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-label">Deliberate Errors Caught</div>
            <div className="stat-value" style={{ color: '#059669' }}>
              {benchmark?.deliberateErrorsCaught} / {benchmark?.deliberateErrorsTotal}
            </div>
            <div className="stat-subtext">{benchmark?.detectionRatePercent}% catch rate on seeded errors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-label">Rule Scan Duration</div>
            <div className="stat-value">{benchmark?.scanTimeMs} ms</div>
            <div className="stat-subtext">Across {benchmark?.totalFdrsScanned} FDR records</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F8FAFC', color: '#475569' }}>
            <Zap size={24} />
          </div>
          <div>
            <div className="stat-label">Clean Records Wrongly Flagged</div>
            <div className="stat-value" style={{ color: benchmark?.cleanRecordsWronglyFlaggedCount === 0 ? '#059669' : '#DC2626' }}>
              {benchmark?.cleanRecordsWronglyFlaggedCount}
            </div>
            <div className="stat-subtext">0 false-positives on clean baseline</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F0FDF4', color: '#16A34A' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="stat-label">Audit Tamper Detection</div>
            <div className="stat-value" style={{ color: '#16A34A' }}>
              {benchmark?.auditTamperBenchmark?.detectionSuccessRatePercent}%
            </div>
            <div className="stat-subtext">
              {benchmark?.auditTamperBenchmark?.tamperedDetected}/{benchmark?.auditTamperBenchmark?.iterationsRun} edits caught ({benchmark?.auditTamperBenchmark?.averageDetectionTimeMs}ms)
            </div>
          </div>
        </div>
      </div>

      {/* Rule Detection Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Seeded Compliance Error Detection Breakdown</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--slate-500)', fontWeight: 600 }}>
            Exactly 5 seeded errors per category
          </span>
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Rule Code</th>
                <th>Expected Seeded Errors</th>
                <th>Caught by Engine</th>
                <th>Detection Success Rate</th>
                <th>Outcome Status</th>
              </tr>
            </thead>
            <tbody>
              {benchmark?.breakdown?.map((b: any) => (
                <tr key={b.ruleCode}>
                  <td style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{b.ruleName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--slate-500)' }}>{b.ruleCode}</td>
                  <td>{b.expectedErrors}</td>
                  <td style={{ fontWeight: 700 }}>{b.caughtErrors}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 100, height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(b.caughtErrors / b.expectedErrors) * 100}%`, height: '100%', background: '#059669' }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#059669' }}>
                        {b.ratio} ({Math.round((b.caughtErrors / b.expectedErrors) * 100)}%)
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: b.caughtErrors === b.expectedErrors ? '#D1FAE5' : '#FEE2E2',
                      color: b.caughtErrors === b.expectedErrors ? '#065F46' : '#991B1B'
                    }}>
                      {b.caughtErrors === b.expectedErrors ? 'VERIFIED 100%' : 'PARTIAL'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario Tests Suite */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Live Scenario Verification Suite (10 Scenarios)</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', margin: 0 }}>
              End-to-end positive workflows and negative security boundary tests.
            </p>
          </div>
          <span style={{
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '3px 10px',
            borderRadius: 6,
            background: scenarios?.totalFailed === 0 ? '#D1FAE5' : '#FEE2E2',
            color: scenarios?.totalFailed === 0 ? '#065F46' : '#991B1B'
          }}>
            {scenarios?.totalPassed || 0} / {scenarios?.scenarios?.length || 10} Scenarios Passing
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scenarios?.scenarios?.map((s: any, idx: number) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 8,
                background: s.passed ? '#F8FAFC' : '#FEF2F2',
                border: `1px solid ${s.passed ? 'var(--slate-200)' : '#FECACA'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {s.passed ? (
                  <CheckCircle2 size={20} style={{ color: '#059669', marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <XCircle size={20} style={{ color: '#DC2626', marginTop: 2, flexShrink: 0 }} />
                )}

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: s.category === 'POSITIVE' ? '#E0F2FE' : '#FEF3C7',
                      color: s.category === 'POSITIVE' ? '#0369A1' : '#92400E'
                    }}>
                      {s.category}
                    </span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--slate-900)' }}>
                      {idx + 1}. {s.name}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>
                      ({s.durationMs}ms)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', margin: '2px 0 4px' }}>
                    {s.description}
                  </p>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: s.passed ? '#047857' : '#B91C1C' }}>
                    {s.message}
                  </div>
                </div>
              </div>

              <span style={{
                fontWeight: 800,
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 4,
                background: s.passed ? '#ECFDF5' : '#FEE2E2',
                color: s.passed ? '#065F46' : '#991B1B'
              }}>
                {s.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
