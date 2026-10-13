'use client';

import { UserCog, VenetianMask, Waves } from 'lucide-react';
import type { Election } from '@/lib/types';
import { useTenant } from '@/features/tenant/TenantContext';
import { getEligibleVoterNoticeText } from '@/features/tenant/terminology';
import { NoticeCard } from './NoticeCard';
import { AssistanceCard } from './AssistanceCard';

export function VotingPageFooter({ election }: { election: Election }) {
  const { tenant } = useTenant();
  const items = [
    { icon: UserCog, text: 'You can review and edit your selections before submitting.' },
    { icon: Waves, text: getEligibleVoterNoticeText(tenant.organizationType) },
    { icon: VenetianMask, text: 'Your vote remains anonymous throughout the election process.' },
  ];

  return <div className="verify__row">
    <NoticeCard title="VOTING NOTICE" lead="Before you begin, please note:" items={items} />
    <AssistanceCard election={election} />
  </div>;
}
