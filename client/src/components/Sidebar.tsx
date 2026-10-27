import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  FilePlus2, 
  CheckSquare, 
  FileKey, 
  Sliders, 
  BarChart3, 
  Activity, 
  Upload, 
  BookOpen,
  ShieldCheck,
  Building
} from 'lucide-react';

export type PageId = 
  | 'dashboard'
  | 'repository'
  | 'fdr_detail'
  | 'intake'
  | 'release'
  | 'audit'
  | 'admin'
  | 'reports'
  | 'benchmark'
  | 'import'
  | 'guide';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { user } = useAuth();

  const isRole = (roles: string[]) => roles.includes(user?.role || '');

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="emblem">
          <span>⚙️</span>
        </div>
        <div>
          <h1>AICTE FDR</h1>
          <p>Regulation Bureau Portal</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Core Operations</div>

        <button
          className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        <button
          className={`nav-item ${currentPage === 'repository' || currentPage === 'fdr_detail' ? 'active' : ''}`}
          onClick={() => onNavigate('repository')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <Building2 size={18} />
          <span>Central Repository</span>
        </button>

        {isRole(['INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN']) && (
          <button
            className={`nav-item ${currentPage === 'intake' ? 'active' : ''}`}
            onClick={() => onNavigate('intake')}
            style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
          >
            <FilePlus2 size={18} />
            <span>Intake & OCR</span>
          </button>
        )}

        <button
          className={`nav-item ${currentPage === 'release' ? 'active' : ''}`}
          onClick={() => onNavigate('release')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <CheckSquare size={18} />
          <span>Release Workflow</span>
        </button>

        {isRole(['INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN']) && (
          <button
            className={`nav-item ${currentPage === 'import' ? 'active' : ''}`}
            onClick={() => onNavigate('import')}
            style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
          >
            <Upload size={18} />
            <span>Bulk CSV Import</span>
          </button>
        )}

        <div className="sidebar-section-title">Governance & Verification</div>

        <button
          className={`nav-item ${currentPage === 'audit' ? 'active' : ''}`}
          onClick={() => onNavigate('audit')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <FileKey size={18} />
          <span>Audit Trail Chain</span>
        </button>

        <button
          className={`nav-item ${currentPage === 'reports' ? 'active' : ''}`}
          onClick={() => onNavigate('reports')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <BarChart3 size={18} />
          <span>Regulatory Reports</span>
        </button>

        <div className="sidebar-section-title">Validation & System</div>

        <button
          className={`nav-item ${currentPage === 'benchmark' ? 'active' : ''}`}
          onClick={() => onNavigate('benchmark')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <Activity size={18} />
          <span>Benchmark & Tests</span>
        </button>

        {isRole(['ADMIN']) && (
          <button
            className={`nav-item ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
            style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
          >
            <Sliders size={18} />
            <span>Admin Settings</span>
          </button>
        )}

        <button
          className={`nav-item ${currentPage === 'guide' ? 'active' : ''}`}
          onClick={() => onNavigate('guide')}
          style={{ width: '100%', background: 'none', textAlign: 'left', border: 'none' }}
        >
          <BookOpen size={18} />
          <span>5-Min Demo Guide</span>
        </button>
      </nav>

      {/* User Info Bar at bottom of sidebar */}
      <div className="sidebar-user">
        <div className="name">{user?.full_name || 'Authorized Officer'}</div>
        <div className="role-tag">{user?.role?.replace(/_/g, ' ')}</div>
        {user?.institution_name && (
          <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Building size={11} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
              {user.institution_name}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
