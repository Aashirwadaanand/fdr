import React from 'react';
import { ShieldCheck, FileCheck, FileText } from 'lucide-react';

interface TrustBadgeProps {
  level: string;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ level }) => {
  if (level === 'BANK_CONFIRMED') {
    return (
      <span className="trust-badge bank-confirmed" title="Verified against simulated core banking ledger">
        <ShieldCheck size={12} />
        Bank Confirmed
      </span>
    );
  }

  if (level === 'DOCUMENT_EXTRACTED') {
    return (
      <span className="trust-badge document-extracted" title="Fields matched with OCR-extracted certificate text">
        <FileCheck size={12} />
        Doc Extracted
      </span>
    );
  }

  return (
    <span className="trust-badge declared" title="Self-declared by institution; pending verification">
      <FileText size={12} />
      Declared
    </span>
  );
};
