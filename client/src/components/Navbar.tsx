import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { useClock } from '../context/ClockContext';
import { useNotifications } from '../context/NotificationContext';
import { Calendar, Bell, User, LogOut, Check, Shield } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, switchRole } = useAuth();
  const { clockStatus, setIsModalOpen } = useClock();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-600)' }}>
          {user?.institution_name ? user.institution_name : 'AICTE Central Regulation Bureau (HQ - New Delhi)'}
        </span>
      </div>

      <div className="nav-controls">
        {/* Time Travel Demo Clock Button */}
        <button
          className={`clock-pill ${clockStatus.isAdvanced ? 'advanced' : ''}`}
          onClick={() => setIsModalOpen(true)}
          title="Click to advance demo system clock"
        >
          <Calendar size={15} />
          <span>Demo Date: <strong>{clockStatus.currentDate}</strong></span>
          {clockStatus.isAdvanced && (
            <span style={{ background: '#F59E0B', color: '#FFFFFF', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem' }}>
              +{clockStatus.offsetDays}d
            </span>
          )}
        </button>

        {/* Quick Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor="role-select" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>
            Role:
          </label>
          <select
            id="role-select"
            className="role-switcher-select"
            value={user?.role || 'ADMIN'}
            onChange={e => switchRole(e.target.value as UserRole)}
            title="Switch demo user role instantly"
          >
            <option value="INSTITUTION_OFFICER">Institution Officer (Own Inst)</option>
            <option value="SCRUTINY_OFFICER">Scrutiny Officer (Regulation)</option>
            <option value="APPROVING_AUTHORITY">Approving Authority (Bureau Head)</option>
            <option value="ADMIN">System Administrator</option>
            <option value="AUDITOR">Vigilance & Statutory Auditor</option>
          </select>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            style={{
              position: 'relative',
              background: '#F1F5F9',
              border: '1px solid var(--slate-300)',
              borderRadius: 'var(--radius-md)',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--slate-700)'
            }}
            title="Notification Center"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--rose-600)',
                color: '#FFFFFF',
                borderRadius: '50%',
                fontSize: '0.68rem',
                fontWeight: 700,
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Drawer */}
          {isNotifOpen && (
            <div style={{
              position: 'absolute',
              top: 44,
              right: 0,
              width: 360,
              maxHeight: 460,
              overflowY: 'auto',
              background: '#FFFFFF',
              border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 100,
              padding: 14
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-100)', paddingBottom: 10, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                  Notifications & Escalations
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-600)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--slate-400)', fontSize: '0.85rem' }}>
                  No notifications yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.slice(0, 15).map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markAsRead(n.id)}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: n.is_read ? '#FFFFFF' : '#F0F9FF',
                        border: `1px solid ${n.is_read ? 'var(--slate-200)' : '#BAE6FD'}`,
                        cursor: n.is_read ? 'default' : 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--slate-900)' }}>
                          {n.title}
                        </span>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: n.severity === 'URGENT' ? '#FEE2E2' : '#FEF3C7',
                          color: n.severity === 'URGENT' ? '#991B1B' : '#92400E'
                        }}>
                          {n.severity}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', margin: '4px 0 0' }}>
                        {n.message}
                      </p>
                      <div style={{ fontSize: '0.65rem', color: 'var(--slate-400)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User profile & Logout */}
        <button
          onClick={logout}
          className="btn btn-outline btn-sm"
          title="Sign out of current portal session"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </header>
  );
};
