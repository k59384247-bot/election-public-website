'use client';

import { useState } from 'react';

const INITIALS_PALETTE = [
  { bg: '#900000', fg: '#faf9f7' }, // wine
  { bg: '#ed9a00', fg: '#faf9f7' }, // amber
  { bg: '#f4c95d', fg: '#1c1c1c' }, // gold
  { bg: '#5c5c5c', fg: '#faf9f7' }, // neutral-600
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getSwatch(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return INITIALS_PALETTE[Math.abs(hash) % INITIALS_PALETTE.length];
}

export function CandidateAvatar({
  id,
  name,
  photoUrl,
}: {
  id: string;
  name: string;
  photoUrl: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);

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

  const swatch = getSwatch(id);

  return (
    <div
      className="candidate__avatar candidate__avatar--initials"
      style={{ backgroundColor: swatch.bg, color: swatch.fg }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
