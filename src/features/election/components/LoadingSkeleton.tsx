// No loading state exists in screens-html (the static mock only shows
// populated cards). Built from the same event-card box model/tokens so the
// grid doesn't reflow once real cards arrive — see elections-home.css.
const SKELETON_COUNT = 4;

export function LoadingSkeleton() {
  return (
    <div className="event-grid" aria-hidden="true" aria-label="Loading elections">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <div className="event-card-skeleton" key={index}>
          <div className="event-card-skeleton__media" />
          <div className="event-card-skeleton__line" />
          <div className="event-card-skeleton__line event-card-skeleton__line--desc" />
          <div className="event-card-skeleton__line event-card-skeleton__line--meta" />
        </div>
      ))}
    </div>
  );
}
