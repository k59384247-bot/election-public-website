'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared chrome for the ballot/review/submitting/receipt screens (screens
 * 4-8): nav + the `.vote__main` content column. Distinct from
 * VoteFlowLayout (screens 2-3), which uses the two-column `.verify` shell —
 * screens-html gives the ballot flow its own single-column `.vote` page
 * shell instead. Mounted once by the vote route for whichever step is
 * active, so nav never remounts between ballot -> review -> submitting ->
 * receipt.
 */
export function VotePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="vote">
      <header>
        <nav className="navbar" aria-label="Primary">
          <Link className="navbar__brand" href="/" aria-label="AMSUL home">
            {/* eslint-disable-next-line @next/next/no-img-element -- matches
                screens-html, which uses plain <img> throughout. */}
            <img className="navbar__logo" src="/assets/images/amsul-logo.png" alt="AMSUL logo" />
          </Link>
        </nav>
      </header>

      <main className="vote__main">{children}</main>
    </div>
  );
}
