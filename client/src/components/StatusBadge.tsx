import React from 'react';
import { 
  Clock, 
  Search, 
  CheckCircle2, 
  ShieldAlert, 
  AlertTriangle, 
  RefreshCw, 
  CheckCheck,
  Lock
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'ACTIVE':
        return { className: 'status-badge active', icon: <Lock size={12} />, label: 'Active Lien' };
      case 'EXPIRING':
        return { className: 'status-badge expiring', icon: <Clock size={12} />, label: 'Expiring Soon' };
      case 'MATURED':
        return { className: 'status-badge matured', icon: <AlertTriangle size={12} />, label: 'Matured / Due' };
      case 'SUBMITTED':
        return { className: 'status-badge submitted', icon: <Clock size={12} />, label: 'Submitted' };
      case 'UNDER_SCRUTINY':
        return { className: 'status-badge under-scrutiny', icon: <Search size={12} />, label: 'Under Scrutiny' };
      case 'VERIFIED':
        return { className: 'status-badge verified', icon: <CheckCircle2 size={12} />, label: 'Verified' };
      case 'RENEWED':
        return { className: 'status-badge renewed', icon: <RefreshCw size={12} />, label: 'Renewed' };
      case 'RELEASED':
        return { className: 'status-badge released', icon: <CheckCheck size={12} />, label: 'Released' };
      default:
        return { className: 'status-badge', icon: <ShieldAlert size={12} />, label: status };
    }
  };

  const config = getBadgeConfig();

  return (
    <span className={config.className}>
      {config.icon}
      {config.label}
    </span>
  );
};
