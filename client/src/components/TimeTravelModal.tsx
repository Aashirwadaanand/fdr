import React, { useState } from 'react';
import { useClock } from '../context/ClockContext';
import { useNotifications } from '../context/NotificationContext';
import { Calendar, FastForward, RotateCcw, Play, CheckCircle2, X } from 'lucide-react';
import { api } from '../api/client';

export const TimeTravelModal: React.FC = () => {
  const { clockStatus, advanceDays, setFixedDate, resetClock, isModalOpen, setIsModalOpen } = useClock();
  const { showToast, refreshNotifications } = useNotifications();
  const [customDays, setCustomDays] = useState(30);
  const [targetDate, setTargetDate] = useState(clockStatus.currentDate);
  const [lastSchedulerResult, setLastSchedulerResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isModalOpen) return null;

  const handleAdvance = async (days: number) => {
    setLoading(true);
    try {
      const res = await advanceDays(days);
      setLastSchedulerResult(res.schedulerResult);
      showToast(`Advanced system clock by ${days} days to ${res.status.currentDate}`, 'success');
      await refreshNotifications();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDate = async () => {
    if (!targetDate) return;
    setLoading(true);
    try {
      const res = await setFixedDate(targetDate);
      setLastSchedulerResult(res.schedulerResult);
      showToast(`System date set to ${targetDate}`, 'success');
      await refreshNotifications();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await resetClock();
      setLastSchedulerResult(res.schedulerResult);
      showToast('System clock reset to standard demo date (2026-10-27)', 'success');
      await refreshNotifications();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScheduler = async () => {
    setLoading(true);
    try {
      const res = await api.triggerScheduler();
      setLastSchedulerResult(res.schedulerResult);
      showToast('Scheduled validity check evaluated across all FDR records', 'success');
      await refreshNotifications();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} style={{ color: 'var(--accent-gold)' }} />
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Time-Travel Demo Clock</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', margin: 0 }}>
                Advance system "today" to simulate instrument aging, reminders, and maturity alerts
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current State */}
        <div style={{
          background: clockStatus.isAdvanced ? '#FFFBEB' : '#F1F5F9',
          border: `1px solid ${clockStatus.isAdvanced ? '#FCD34D' : '#CBD5E1'}`,
          borderRadius: 8,
          padding: 14,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
              Current Portal System Date
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: clockStatus.isAdvanced ? '#92400E' : 'var(--slate-900)' }}>
              {clockStatus.currentDate}
            </div>
            {clockStatus.isAdvanced && (
              <div style={{ fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>
                ⚠️ Time travel active (+{clockStatus.offsetDays} days relative to baseline)
              </div>
            )}
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={handleReset}
            disabled={loading}
          >
            <RotateCcw size={14} />
            Reset to Baseline
          </button>
        </div>

        {/* Quick Advance Controls */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Quick Advance Days
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[7, 30, 60, 90, 180, 365].map(days => (
              <button
                key={days}
                className="btn btn-outline btn-sm"
                onClick={() => handleAdvance(days)}
                disabled={loading}
              >
                <FastForward size={13} />
                +{days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Custom Jump */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Jump Directly to Specific Date
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--slate-300)',
                flex: 1,
                fontSize: '0.875rem'
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSetDate}
              disabled={loading}
            >
              Set Date
            </button>
          </div>
        </div>

        {/* Trigger Scheduler On Demand */}
        <div style={{
          borderTop: '1px solid var(--slate-200)',
          paddingTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Run Validity Scheduler</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              Evaluates approaching maturities (90/60/30/7 days) and transitions matured deposits
            </div>
          </div>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleTriggerScheduler}
            disabled={loading}
          >
            <Play size={14} />
            Run Job Now
          </button>
        </div>

        {/* Scheduler Execution Feedback */}
        {lastSchedulerResult && (
          <div style={{
            marginTop: 20,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 8,
            padding: 12,
            fontSize: '0.8rem',
            color: '#065F46'
          }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CheckCircle2 size={16} />
              Scheduled Validity Evaluation Results:
            </div>
            <div>• FDRs Evaluated: {lastSchedulerResult.fdrsChecked}</div>
            <div>• Transitioned to Expiring Soon: {lastSchedulerResult.expiringTransitioned}</div>
            <div>• Transitioned to Matured / Overdue: {lastSchedulerResult.maturedTransitioned}</div>
            <div>• In-App Notifications Issued: {lastSchedulerResult.notificationsCreated}</div>
            <div>• Escalation Events Logged: {lastSchedulerResult.escalationsCreated}</div>
          </div>
        )}
      </div>
    </div>
  );
};
