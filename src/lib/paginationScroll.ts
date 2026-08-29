/**
 * Reset the viewport after an in-app pagination or result-set change.
 *
 * The document/body assignments cover mobile browser scroll implementations
 * that do not consistently expose the active scroll position through just
 * window.scrollTo. Mark any independently scrollable pagination-owned region
 * with data-pagination-scroll-container so it is reset as well.
 */
export function resetPaginationScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.scrollTo({ top: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document
    .querySelectorAll<HTMLElement>('[data-pagination-scroll-container]')
    .forEach((container) => {
      container.scrollTop = 0;
    });
}
