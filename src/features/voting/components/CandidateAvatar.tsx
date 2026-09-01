'use client';

import { useState } from 'react';
import { useTenant } from '@/features/tenant/TenantContext';

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function CandidateAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useTenant();

  if (photoUrl && !imageFailed) {
    return (
      <img
        className="candidate__avatar"
        src={photoUrl}
        alt={name}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className="candidate__avatar candidate__avatar--initials"
      style={{ backgroundColor: 'var(--color-wine)', color: 'var(--color-header-text)' }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
