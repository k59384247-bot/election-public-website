'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import './Pagination.css';
import { PerPageSelect } from './PerPageSelect';
import { resetPaginationScroll } from '@/lib/paginationScroll';

/**
 * Real page-number navigation — Previous / 1 2 3.. / Next — plus a
 * per-page size control. Shared shape with vote.css's .pagination (main
 * voting page), which pages through an already-fully-loaded array the same
 * way this expects `totalPages` to already reflect a fully-loaded list.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  perPageId,
  perPageLabel,
  perPageValue,
  perPageOptions,
  onPerPageChange,
  ariaLabel,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  perPageId: string;
  perPageLabel: string;
  perPageValue: number;
  perPageOptions: readonly number[];
  onPerPageChange: (value: number) => void;
  ariaLabel: string;
}) {
  const previousStateRef = useRef({ currentPage, perPageValue });

  // The event handlers reset immediately. This effect is a safeguard for
  // callers that update pagination state from another event or async result.
  useEffect(() => {
    const previousState = previousStateRef.current;
    if (previousState.currentPage !== currentPage || previousState.perPageValue !== perPageValue) {
      resetPaginationScroll();
    }
    previousStateRef.current = { currentPage, perPageValue };
  }, [currentPage, perPageValue]);

  function goToPage(next: number) {
    resetPaginationScroll();
    onPageChange(Math.min(Math.max(1, next), totalPages));
  }

  function handlePerPageChange(next: number) {
    resetPaginationScroll();
    onPerPageChange(next);
  }

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      <button
        className="pagination__btn pagination__btn--prev"
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ArrowRight className="pagination__btn-icon" aria-hidden="true" />
        Previous
      </button>

      <div className="pagination__center">
        <PerPageSelect
          id={perPageId}
          label={perPageLabel}
          value={perPageValue}
          options={perPageOptions}
          onChange={handlePerPageChange}
        />
        <div className="pagination__numbers">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={
                pageNumber === currentPage
                  ? 'pagination__page pagination__page--current'
                  : 'pagination__page'
              }
              aria-current={pageNumber === currentPage ? 'page' : undefined}
              onClick={() => goToPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      </div>

      <button
        className="pagination__btn pagination__btn--next"
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
        <ArrowRight className="pagination__btn-icon" aria-hidden="true" />
      </button>
    </nav>
  );
}
