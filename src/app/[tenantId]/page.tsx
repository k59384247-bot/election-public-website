import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import '@/app/elections-home.css';
import { getAllElections, type GetElectionsResult } from '@/features/election/api';
import { ElectionList } from '@/features/election/components/ElectionList';
import { getTenantPublicInfo } from '@/features/tenant/api';
import { ApiRequestError } from '@/lib/apiClient';

// The UI still paginates the complete snapshot locally. A larger API batch
// makes the initial server seed a single request for normal-sized tenants,
// while getAllElections continues following the cursor for larger lists.
const INITIAL_ELECTIONS_BATCH_SIZE = 50;

async function getTenant(tenantId: string) {
  try {
    return await getTenantPublicInfo(tenantId);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.code === 'TENANT_NOT_FOUND' || error.code === 'INVALID_TENANT')
    ) {
      notFound();
    }
    throw error;
  }
}

export default async function ElectionsHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenant(tenantId);

  let initialData: GetElectionsResult | undefined;
  try {
    initialData = await getAllElections({
      tenantId,
      limit: INITIAL_ELECTIONS_BATCH_SIZE,
      revalidate: 0,
    });
  } catch (err) {
    console.error('[ElectionsHomePage] initial server-side fetch failed:', err);
    initialData = undefined;
  }

  const logoUrl = tenant.logoUrl ?? '/assets/images/amsul-logo.png';
  return (
    <div className="elections-home">
      <header className="elections-hero">
        <div className="elections-hero__bg" aria-hidden="true" />

        <div className="elections-hero__brand">
          <Link href={`/${tenantId}`} aria-label={`${tenant.name} home`}>
            <img className="navbar__logo" src={logoUrl} alt={`${tenant.name} logo`} />
          </Link>
        </div>

        <div className="elections-hero__content">
          <Link
            href={`/${tenantId}`}
            aria-label={`${tenant.name} home`}
            className="elections-hero__brand--mobile"
          >
            <img className="navbar__logo elections-hero__logo--mobile" src={logoUrl} alt={`${tenant.name} logo`} />
          </Link>
          <span className="highlight-pill">
            <Sparkles className="highlight-pill__icon" style={{ color: 'var(--color-amber)' }} aria-hidden="true" />
            ELECTIONS
          </span>
          <h1 className="elections-hero__title">Make Your Voice Count</h1>
          <p className="elections-hero__subtitle">
            Welcome to AMSUL Elections. Eligible voters can securely verify their identity, access
            the ballot, and cast their vote. All ballots remain anonymous and every vote counts.
          </p>
        </div>
      </header>

      <main>
        <section className="elections-list" aria-label={`${tenant.name} elections`}>
          <ElectionList initialData={initialData} />
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__brand">
          <img className="site-footer__logo" src={logoUrl} alt={`${tenant.name} logo`} />
          <p className="site-footer__mission">{tenant.description ?? `${tenant.name} public elections.`}</p>

        </div>

        <hr className="site-footer__divider" />

        <div className="site-footer__bottom">
          <p>© 2026 {tenant.name}. All rights reserved.</p>
          <p>Built by StruktHQ</p>
        </div>
      </footer>
    </div>
  );
}
