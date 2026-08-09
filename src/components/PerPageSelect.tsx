'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpDown } from 'lucide-react';
import './PerPageSelect.css';

/**
 * App-styled replacement for a native <select>. A real <select>'s trigger
 * can be styled, but its open options list is rendered by the OS/browser
 * and can't be — this renders both the trigger and the panel itself so the
 * opened state matches the rest of the app instead of looking like a
 * generic browser dropdown. Shared by the main voting page and the
 * elections home page so both use one canonical look.
 */
export function PerPageSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  options: readonly number[];
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const labelId = `${id}-label`;
  const optionId = (index: number) => `${id}-option-${index}`;

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
    setHighlightedIndex(Math.max(options.indexOf(value), 0));
    setIsOpen(true);
  }

  function selectOption(option: number) {
    onChange(option);
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
    <div className="per-page" ref={rootRef}>
      <span className="per-page__label" id={labelId}>
        {label}
      </span>

      <div className="per-page__control">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="per-page__trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${labelId} ${id}`}
          onClick={() => (isOpen ? setIsOpen(false) : openPanel())}
          onKeyDown={handleTriggerKeyDown}
        >
          {value}
          <ArrowUpDown className="per-page__icon" style={{ color: '#8F95B2' }} aria-hidden="true" />
        </button>

        {isOpen && (
          <ul
            ref={panelRef}
            className="per-page__panel"
            role="listbox"
            aria-labelledby={labelId}
            aria-activedescendant={optionId(highlightedIndex)}
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={option}
                id={optionId(index)}
                role="option"
                aria-selected={option === value}
                className={
                  'per-page__option' +
                  (option === value ? ' per-page__option--selected' : '') +
                  (index === highlightedIndex ? ' per-page__option--highlighted' : '')
                }
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
