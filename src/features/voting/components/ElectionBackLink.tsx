import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function ElectionBackLink({ tenantId, className }: { tenantId: string; className: string }) {
  return <Link className={`btn btn--ghost ${className}`} href={`/${tenantId}`}>
    <ArrowLeft className="btn__icon" aria-hidden="true" />
    Back to Elections
  </Link>;
}
