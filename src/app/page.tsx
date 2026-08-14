import Link from "next/link";
import { Mail, Sparkles } from "lucide-react";
import "./elections-home.css";
import { getElections, type GetElectionsResult } from "@/features/election/api";
import { ElectionList } from "@/features/election/components/ElectionList";

// Build spec §2: initial page-1 fetch is server-rendered so first paint
// isn't a blank loading state; the client hook then takes over polling from
// this seeded data (see ElectionList/useElections).
//
// revalidate: 0 (not an ISR window) is deliberate, not an oversight: this
// list changes on discrete admin actions (opening/closing an election), not
// on a schedule, and Next's Data Cache has no way to know when that
// happens. Any revalidate > 0 here means a request landing inside that
// window serves an admin-stale snapshot as `initialData`, which the client
// hook then immediately overwrites with a live fetch on mount — the two
// disagreeing is exactly what causes hydration-mismatch errors on the
// elections list. Traffic here is low enough that a live fetch per request
// is cheap; correctness beats the caching win.
export default async function ElectionsHomePage() {
  // A failed fetch here must not crash the whole route. Fall back to no
  // seed data — ElectionList/useElections then fetches client-side on mount
  // and shows the normal ErrorState/retry UI instead of a 500.
  let initialData: GetElectionsResult | undefined;
  try {
    initialData = await getElections({ revalidate: 0 });
  } catch (err) {
    console.error("[ElectionsHomePage] initial server-side fetch failed:", err);
    initialData = undefined;
  }

  return (
    <div className="elections-home">
      {/* ===================== Hero ===================== */}
      <header className="elections-hero">
        <div className="elections-hero__bg" aria-hidden="true" />

        {/* Desktop: small logo pinned top-left. Hidden below 640px in favor
            of the larger centered mark below (see elections-home.css). */}
        <div className="elections-hero__brand">
          <Link href="/" aria-label="AMSUL home">
            <img className="navbar__logo" src="/assets/images/amsul-logo.png" alt="AMSUL logo" />
          </Link>
        </div>

        <div className="elections-hero__content">
          {/* Mobile only: larger logo centered above the pill, replacing the
              top-left placement — hidden above 640px. */}
          <Link href="/" aria-label="AMSUL home" className="elections-hero__brand--mobile">
            <img
              className="navbar__logo elections-hero__logo--mobile"
              src="/assets/images/amsul-logo.png"
              alt="AMSUL logo"
            />
          </Link>
          <span className="highlight-pill">
            <Sparkles
              className="highlight-pill__icon"
              style={{ color: 'var(--color-amber)' }}
              aria-hidden="true"
            />
            ELECTIONS
          </span>
          <h1 className="elections-hero__title">Make Your Voice Count</h1>
          <p className="elections-hero__subtitle">
            Welcome to AMSUL Elections. Eligible voters can securely verify their identity, access
            the ballot, and cast their vote. All ballots remain anonymous and every vote counts.
          </p>
        </div>

      </header>

      {/* ===================== Elections listing ===================== */}
      <main>
        <section className="elections-list" aria-label="AMSUL elections">
          <ElectionList initialData={initialData} />
        </section>
      </main>

      {/* ===================== Footer ===================== */}
      <footer className="site-footer">
        <div className="site-footer__brand">
          <img
            className="site-footer__logo"
            src="/assets/images/amsul-logo.png"
            alt="AMSUL logo"
          />
          <p className="site-footer__mission">
            The official voting platform of the Association of Medical Students,
            University of Lagos.
          </p>

          <div className="site-footer__socials">
            <div className="site-footer__social-group">
              <div className="site-footer__social-icons">
                <a className="social-badge" href="#" aria-label="Instagram">
                  <img
                    className="social-badge__icon"
                    src="/assets/icons/instagram.svg"
                    alt=""
                    aria-hidden="true"
                  />
                </a>
                <a className="social-badge" href="#" aria-label="X (Twitter)">
                  <img
                    className="social-badge__icon"
                    src="/assets/icons/x-twitter.svg"
                    alt=""
                    aria-hidden="true"
                  />
                </a>
              </div>
              <span className="site-footer__social-label">@amsul_unilag</span>
            </div>

            <div className="site-footer__social-group">
              <div className="site-footer__social-icons">
                <a className="social-badge" href="mailto:electoralcommittee@amsul.org" aria-label="Email">
                  <Mail
                    className="social-badge__icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                </a>
              </div>
              <span className="site-footer__social-label">electoralcommittee@amsul.org</span>
            </div>
          </div>
        </div>

        <hr className="site-footer__divider" />

        <div className="site-footer__bottom">
          <p>© 2026 AMSUL Electoral Committee. All rights reserved.</p>
          <p>Built by StruktHQ</p>
        </div>
      </footer>
    </div>
  );
}
