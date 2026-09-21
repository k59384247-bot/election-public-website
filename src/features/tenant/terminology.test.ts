import { describe, expect, it } from 'vitest';
import {
  getEligibleVoterNoticeText,
  getTenantTerminology,
  normalizeOrganizationType,
} from './terminology';

describe('tenant terminology', () => {
  it('uses student terminology for a student tenant', () => {
    expect(getTenantTerminology('student')).toMatchObject({
      organizationType: 'student',
      identifierLabel: 'Matric Number',
      candidateIdentifierLabel: 'Matric Number',
      academicSessionLabel: 'Academic Session',
      levelLabel: 'Level',
      showLevel: true,
      eligibleVoterLabel: 'student',
    });
  });

  it('uses general-organization terminology for a general tenant', () => {
    expect(getTenantTerminology('general')).toMatchObject({
      organizationType: 'general',
      identifierLabel: 'Voter ID Number',
      candidateIdentifierLabel: 'Candidate ID Number',
      academicSessionLabel: 'Year',
      levelLabel: 'N/A',
      showLevel: false,
      classOptional: true,
      eligibleVoterLabel: 'voter',
    });
    expect(getTenantTerminology('general').classHelperText).toContain('student organizations');
  });

  it('treats missing or unsupported organization types as student', () => {
    expect(normalizeOrganizationType(undefined)).toBe('student');
    expect(getTenantTerminology()).toEqual(getTenantTerminology('student'));
    expect(getTenantTerminology('legacy-value')).toEqual(getTenantTerminology('student'));
  });

  it('uses organization-aware voter wording in the voting notice', () => {
    expect(getEligibleVoterNoticeText('student')).toBe('Each eligible student can vote only once.');
    expect(getEligibleVoterNoticeText('general')).toBe('Each eligible voter can vote only once.');
  });
});
