import type { OrganizationType } from '@/lib/types';

export interface TenantTerminology {
  organizationType: OrganizationType;
  identifierLabel: string;
  candidateIdentifierLabel: string;
  academicSessionLabel: string;
  levelLabel: string;
  showLevel: boolean;
  classOptional: boolean;
  classHelperText: string | null;
}

const STUDENT_TERMINOLOGY: TenantTerminology = {
  organizationType: 'student',
  identifierLabel: 'Matric Number',
  candidateIdentifierLabel: 'Matric Number',
  academicSessionLabel: 'Academic Session',
  levelLabel: 'Level',
  showLevel: true,
  classOptional: false,
  classHelperText: null,
};

const GENERAL_TERMINOLOGY: TenantTerminology = {
  organizationType: 'general',
  identifierLabel: 'Voter ID Number',
  candidateIdentifierLabel: 'Candidate ID Number',
  academicSessionLabel: 'Year',
  levelLabel: 'N/A',
  showLevel: false,
  classOptional: true,
  classHelperText: 'Optional; intended for student organizations.',
};

/** Normalizes missing or unsupported tenant values to the legacy student mode. */
export function normalizeOrganizationType(value: unknown): OrganizationType {
  return value === 'general' ? 'general' : 'student';
}

/** Presentation-only terminology. It does not alter any API field names. */
export function getTenantTerminology(value?: unknown): TenantTerminology {
  return normalizeOrganizationType(value) === 'general'
    ? GENERAL_TERMINOLOGY
    : STUDENT_TERMINOLOGY;
}
