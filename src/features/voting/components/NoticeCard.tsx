import type { LucideIcon } from 'lucide-react';

/** Generic "voting notice" / "what happens next" card — icon-badge + text list. */
export function NoticeCard({
  title,
  lead,
  items,
}: {
  title: string;
  lead?: string;
  items: { icon: LucideIcon; text: string }[];
}) {
  return (
    <section className="verify__col card notice" aria-labelledby="notice-title">
      <div className="notice__head">
        <h2 className="card__title" id="notice-title">
          {title}
        </h2>
        {lead && <p className="notice__lead">{lead}</p>}
      </div>

      <ul className="notice__list" role="list">
        {items.map((item) => (
          <li className="notice__item" key={item.text}>
            <span className="icon-badge">
              <item.icon className="icon-badge__icon" style={{ color: 'var(--color-header-text)' }} aria-hidden="true" />
            </span>
            <p className="notice__text">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
