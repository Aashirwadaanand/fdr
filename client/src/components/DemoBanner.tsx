import React from 'react';
import { Shield, Sparkles, BookOpen, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { useNotifications } from '../context/NotificationContext';
import { useClock } from '../context/ClockContext';

interface DemoBannerProps {
  onNavigateToGuide: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onNavigateToGuide }) => {
  const { showToast } = useNotifications();
  const { refreshClock } = useClock();

  const handleResetData = async () => {
    if (window.confirm('Reset demo data to clean 200 synthetic FDRs with 30 deliberate compliance errors?')) {
      try {
        await api.resetSeedDataset();
        await refreshClock();
        showToast('Demo dataset reset to clean initial seed (200 FDRs, 30 errors)', 'success');
        window.location.reload();
      } catch (err: any) {
        showToast(`Failed to reset seed: ${err.message}`, 'error');
      }
    }
  };

  return (
    <div className="prototype-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="pill">AICTE Prototype</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#F1F5F9' }}>
          <Shield size={14} style={{ color: 'var(--accent-gold)' }} />
          <strong>SIH26265 Synthetic Environment:</strong> Fictional banks, synthetic certificates, and simulated Core Banking verification.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={onNavigateToGuide}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent-gold)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <BookOpen size={13} />
          5-Min Demo Guide
        </button>

        <button
          onClick={handleResetData}
          title="Reset database to 200 clean seeded FDRs and 30 intentional errors"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '0.74rem',
            padding: '2px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RotateCcw size={12} />
          Reset Demo Data
        </button>
      </div>
    </div>
  );
};
