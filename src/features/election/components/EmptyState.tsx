// data: [] is a normal 200 (Appendix A), not an error — this must read as
// distinct copy/styling from ErrorState so the two are never confused.
export function EmptyState() {
  return (
    <div className="elections-notice">
      <h2 className="elections-notice__title">No elections yet</h2>
      <p className="elections-notice__text">
        There are no elections to show right now. Check back soon — new elections will
        appear here as soon as they&apos;re published.
      </p>
    </div>
  );
}
