import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetPaginationScroll } from './paginationScroll';

describe('resetPaginationScroll', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resets the document and pagination-owned scroll containers', () => {
    const scrollTo = vi.fn();
    const documentElement = { scrollTop: 240 };
    const body = { scrollTop: 180 };
    const nestedContainer = { scrollTop: 96 };

    vi.stubGlobal('window', { scrollTo });
    vi.stubGlobal('document', {
      documentElement,
      body,
      querySelectorAll: vi.fn(() => [nestedContainer]),
    });

    resetPaginationScroll();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(documentElement.scrollTop).toBe(0);
    expect(body.scrollTop).toBe(0);
    expect(nestedContainer.scrollTop).toBe(0);
  });
});
