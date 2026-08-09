'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import './ElectionFilters.css';
import type { PublicElectionStatus } from '@/lib/types';
import { STATUS_CONFIG } from './ElectionCard';

export type SortKey = 'relevance' | 'newest' | 'oldest' | 'votes';

export type StatusFilter = PublicElectionStatus | 'all';

// Order intentionally differs from STATUS_PRIORITY in useElections.ts —
// that ordering ranks "what should sort first", this ordering is "what a
// voter scans for first" (currently-actionable states before archived
// ones), and results_published sits last since it's the least urgent.
const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'voting_open', label: STATUS_CONFIG.voting_open.label },
  { value: 'upcoming', label: STATUS_CONFIG.upcoming.label },
  { value: 'voting_paused', label: STATUS_CONFIG.voting_paused.label },
  { value: 'voting_closed', label: STATUS_CONFIG.voting_closed.label },
  { value: 'results_published', label: STATUS_CONFIG.results_published.label },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'votes', label: 'Most votes' },
];

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Dark pill listbox shared by the Status and Sort By controls — same
 * trigger/panel/keyboard-nav shape as PerPageSelect, restyled to match the
 * Figma search-bar-and-filters frame (black fill, hairline border) instead
 * of PerPageSelect's white one, and driven by string options instead of a
 * fixed page-size list.
 */
function FilterDropdown<T extends string>({
  id,
  groupLabel,
  value,
  options,
  onChange,
}: {
  id: string;
  groupLabel: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const labelId = `${id}-label`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  function openPanel() {
    setHighlightedIndex(Math.max(options.findIndex((option) => option.value === value), 0));
    setIsOpen(true);
  }

  function selectOption(option: DropdownOption<T>) {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openPanel();
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectOption(options[highlightedIndex]);
        break;
      default:
        break;
    }
  }

  return (
    <div className="election-filters__group" ref={rootRef}>
      <span className="election-filters__group-label" id={labelId}>
        {groupLabel}
      </span>

      <div className="election-filters__select-control">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="election-filters__select"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${labelId} ${id}`}
          onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
          onKeyDown={handleTriggerKeyDown}
        >
          {selected.label}
          <ChevronDown className="election-filters__select-icon" aria-hidden="true" />
        </button>

        {isOpen && (
          <ul
            ref={panelRef}
            className="election-filters__panel"
            role="listbox"
            aria-labelledby={labelId}
            aria-activedescendant={optionId(highlightedIndex)}
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                className={
                  'election-filters__option' +
                  (option.value === value ? ' election-filters__option--selected' : '') +
                  (index === highlightedIndex ? ' election-filters__option--highlighted' : '')
                }
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ElectionFilters({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortKeyChange,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
}): ReactNode {
  return (
    <div className="election-filters">
      {/* Filters live entirely client-side over elections already loaded —
          there's no query submit to a server, so onSubmit only exists to
          stop Enter/the Search button from reloading the page (the input's
          onChange already filters as the voter types). */}
      <form
        className="election-filters__search"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="election-filters__search-field">
          <Search className="election-filters__search-icon" aria-hidden="true" />
          <input
            type="search"
            className="election-filters__search-input"
            placeholder="Search elections"
            aria-label="Search elections"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </div>
        <button type="submit" className="election-filters__search-submit">
          Search
        </button>
      </form>

      <FilterDropdown
        id="election-status-filter"
        groupLabel="Status:"
        value={statusFilter}
        options={STATUS_FILTER_OPTIONS}
        onChange={onStatusFilterChange}
      />

      <FilterDropdown
        id="election-sort"
        groupLabel="Sort By:"
        value={sortKey}
        options={SORT_OPTIONS}
        onChange={onSortKeyChange}
      />
    </div>
  );
}
