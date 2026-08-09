'use client';

export function LoadMoreButton({
  onClick,
  isLoading,
}: {
  onClick: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="load-more">
      <button className="load-more__btn" type="button" onClick={onClick} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
