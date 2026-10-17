import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function ElectionBackLink({ tenantId, className, label = 'Back to Elections' }: { tenantId: string; className: string; label?: string }) {
  return <Link className={`btn btn--ghost ${className}`} href={`/${tenantId}`}>
    <ArrowLeft className="btn__icon" aria-hidden="true" />
    {label}
  </Link>;
}
