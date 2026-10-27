export type FdrStatus = 
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'MATURED'
  | 'RENEWED'
  | 'RELEASED';

export type TrustLevel = 
  | 'DECLARED'
  | 'DOCUMENT_EXTRACTED'
  | 'BANK_CONFIRMED';

export interface TransitionRule {
  from: FdrStatus;
  to: FdrStatus;
  allowedRoles: string[];
  description: string;
}

export const VALID_TRANSITIONS: TransitionRule[] = [
  {
    from: 'SUBMITTED',
    to: 'UNDER_SCRUTINY',
    allowedRoles: ['SCRUTINY_OFFICER', 'ADMIN'],
    description: 'Scrutiny Officer initiates verification and document analysis',
  },
  {
    from: 'UNDER_SCRUTINY',
    to: 'SUBMITTED',
    allowedRoles: ['SCRUTINY_OFFICER', 'ADMIN'],
    description: 'Returned to institution due to discrepancies or missing information',
  },
  {
    from: 'UNDER_SCRUTINY',
    to: 'VERIFIED',
    allowedRoles: ['SCRUTINY_OFFICER', 'ADMIN'],
    description: 'Document and bank verification successfully completed',
  },
  {
    from: 'VERIFIED',
    to: 'ACTIVE',
    allowedRoles: ['SCRUTINY_OFFICER', 'APPROVING_AUTHORITY', 'ADMIN'],
    description: 'Deposit formally confirmed and activated under AICTE regulatory lien',
  },
  {
    from: 'ACTIVE',
    to: 'EXPIRING',
    allowedRoles: ['SYSTEM_SCHEDULER', 'ADMIN', 'SCRUTINY_OFFICER'],
    description: 'Deposit reaches reminder threshold (<= 90 days to maturity)',
  },
  {
    from: 'EXPIRING',
    to: 'MATURED',
    allowedRoles: ['SYSTEM_SCHEDULER', 'ADMIN', 'SCRUTINY_OFFICER'],
    description: 'Deposit has reached or passed its contractual maturity date',
  },
  {
    from: 'ACTIVE',
    to: 'MATURED',
    allowedRoles: ['SYSTEM_SCHEDULER', 'ADMIN', 'SCRUTINY_OFFICER'],
    description: 'Deposit has reached or passed its maturity date',
  },
  {
    from: 'EXPIRING',
    to: 'RENEWED',
    allowedRoles: ['INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN'],
    description: 'Deposit replaced by a registered renewal instrument',
  },
  {
    from: 'MATURED',
    to: 'RENEWED',
    allowedRoles: ['INSTITUTION_OFFICER', 'SCRUTINY_OFFICER', 'ADMIN'],
    description: 'Matured deposit replaced by a new renewal instrument',
  },
  {
    from: 'MATURED',
    to: 'RELEASED',
    allowedRoles: ['APPROVING_AUTHORITY', 'ADMIN'],
    description: 'Deposit lien formally discharged following approved release workflow',
  },
  {
    from: 'ACTIVE',
    to: 'RELEASED',
    allowedRoles: ['APPROVING_AUTHORITY', 'ADMIN'],
    description: 'Early lien release approved with appropriate replacement deposit in place',
  },
];

export class LifecycleStateMachine {
  public static validateTransition(
    currentStatus: FdrStatus,
    targetStatus: FdrStatus,
    userRole: string
  ): { allowed: boolean; reason?: string } {
    if (currentStatus === targetStatus) {
      return { allowed: true };
    }

    const rule = VALID_TRANSITIONS.find(t => t.from === currentStatus && t.to === targetStatus);

    if (!rule) {
      return {
        allowed: false,
        reason: `Illegal lifecycle transition: cannot move status from '${currentStatus}' to '${targetStatus}'.`,
      };
    }

    if (userRole !== 'ADMIN' && userRole !== 'SYSTEM_SCHEDULER' && !rule.allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        reason: `Role '${userRole}' is not authorized to transition FDR status from '${currentStatus}' to '${targetStatus}'. Allowed roles: ${rule.allowedRoles.join(', ')}.`,
      };
    }

    return { allowed: true };
  }
}
