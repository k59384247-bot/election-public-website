import { Mail, Phone } from 'lucide-react';
import type { Election } from '@/lib/types';

type AssistanceContact = Pick<Election, 'contactEmail' | 'contactWhatsapp' | 'contactPhone'>;

/**
 * Electoral Committee contact block, identical across every vote-flow
 * screen. Renders only the methods the dashboard actually set for this
 * election — a null contact field is omitted, never backfilled with a
 * placeholder number. `election` is optional only to cover the brief
 * window before a caller's own election fetch resolves.
 */
export function AssistanceCard({ election }: { election?: AssistanceContact }) {
  const whatsapp = election?.contactWhatsapp ?? null;
  const phone = election?.contactPhone ?? null;
  const email = election?.contactEmail ?? null;

  return (
    <section className="verify__col assistance" aria-labelledby="assistance-title">
      <div className="assistance__head">
        <h2 className="assistance__title" id="assistance-title">
          Need Any Assistance
        </h2>
        <p className="assistance__subtitle">Contact the Electoral Committee</p>
      </div>

      <div className="assistance__contacts">
        {whatsapp && (
          // wa.me's click-to-chat format wants digits only (no "+", dashes,
          // or leading zeros) — the dashboard stores contactWhatsapp in
          // full "+countrycode..." form, so strip non-digits for the link
          // while still displaying the number as the dashboard sent it.
          <a className="assistance__contact" href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}>
            <span className="icon-badge">
              <img className="icon-badge__icon" src="/assets/icons/whatsapp.svg" alt="WhatsApp" />
            </span>
            <span className="assistance__contact-label">{whatsapp}</span>
          </a>
        )}
        {phone && (
          <a className="assistance__contact" href={`tel:${phone}`}>
            <span className="icon-badge">
              <Phone className="icon-badge__icon" style={{ color: 'var(--color-header-text)' }} aria-label="Phone" />
            </span>
            <span className="assistance__contact-label">{phone}</span>
          </a>
        )}
        {email && (
          <a className="assistance__contact" href={`mailto:${email}`}>
            <span className="icon-badge">
              <Mail className="icon-badge__icon" style={{ color: 'var(--color-header-text)' }} aria-label="Email" />
            </span>
            <span className="assistance__contact-label">{email}</span>
          </a>
        )}
      </div>
    </section>
  );
}
