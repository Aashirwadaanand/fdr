import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClockProvider } from './context/ClockContext';
import { NotificationProvider } from './context/NotificationContext';
import { DemoBanner } from './components/DemoBanner';
import { Navbar } from './components/Navbar';
import { Sidebar, PageId } from './components/Sidebar';
import { TimeTravelModal } from './components/TimeTravelModal';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FdrRepository } from './pages/FdrRepository';
import { FdrDetail } from './pages/FdrDetail';
import { IntakeExtraction } from './pages/IntakeExtraction';
import { ReleaseRequests } from './pages/ReleaseRequests';
import { AuditTrail } from './pages/AuditTrail';
import { AdminSettings } from './pages/AdminSettings';
import { Reports } from './pages/Reports';
import { Benchmark } from './pages/Benchmark';
import { BulkImport } from './pages/BulkImport';
import { DemoGuide } from './pages/DemoGuide';

const MainPortal: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [selectedFdrId, setSelectedFdrId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A2540', color: '#FFFFFF' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>AICTE FDR-Sentinel Portal</div>
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', marginTop: 4 }}>Initializing security environment...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const handleSelectFdr = (fdrId: string) => {
    setSelectedFdrId(fdrId);
    setCurrentPage('fdr_detail');
  };

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Persistent Hackathon Disclaimer Banner */}
      <DemoBanner onNavigateToGuide={() => handleNavigate('guide')} />

      <div className="app-container">
        {/* Left Navigation Sidebar */}
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

        {/* Main Content View */}
        <div className="main-wrapper">
          <Navbar />

          <main className="content-area">
            {currentPage === 'dashboard' && (
              <Dashboard onSelectFdr={handleSelectFdr} onNavigate={handleNavigate} />
            )}

            {currentPage === 'repository' && (
              <FdrRepository onSelectFdr={handleSelectFdr} />
            )}

            {currentPage === 'fdr_detail' && selectedFdrId && (
              <FdrDetail
                fdrId={selectedFdrId}
                onBack={() => handleNavigate('repository')}
                onNavigateToRelease={() => handleNavigate('release')}
              />
            )}

            {currentPage === 'intake' && (
              <IntakeExtraction onSuccess={fdrId => handleSelectFdr(fdrId)} />
            )}

            {currentPage === 'release' && (
              <ReleaseRequests />
            )}

            {currentPage === 'audit' && (
              <AuditTrail />
            )}

            {currentPage === 'admin' && (
              <AdminSettings />
            )}

            {currentPage === 'reports' && (
              <Reports />
            )}

            {currentPage === 'benchmark' && (
              <Benchmark />
            )}

            {currentPage === 'import' && (
              <BulkImport />
            )}

            {currentPage === 'guide' && (
              <DemoGuide onNavigate={handleNavigate} />
            )}
          </main>
        </div>
      </div>

      {/* Time-Travel Demo Clock Modal */}
      <TimeTravelModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ClockProvider>
        <NotificationProvider>
          <MainPortal />
        </NotificationProvider>
      </ClockProvider>
    </AuthProvider>
  );
};

export default App;
