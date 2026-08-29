'use client';

import { useEffect, useReducer, useRef } from 'react';

/** Candidate selections keyed by position. */
export type BallotSelections = Record<string, string[]>;

/**
 * The ballot draft keeps an explicit withheld choice separate from candidate
 * selections. An empty selection is therefore an untouched position, not an
 * implicitly withheld vote.
 */
export interface BallotDraft {
  selections: BallotSelections;
  withheldPositionIds: string[];
}

export type BallotDraftAction =
  | { type: 'SELECT_CANDIDATE'; positionId: string; candidateId: string; maxVotesPerVoter: number }
  | { type: 'DESELECT_CANDIDATE'; positionId: string; candidateId: string }
  | { type: 'SELECT_WITHHELD'; positionId: string }
  | { type: 'CLEAR_POSITION'; positionId: string }
  | { type: 'RESET' };

function storageKey(electionId: string): string {
  return `ballot-draft:${electionId}`;
}

const EMPTY_DRAFT: BallotDraft = { selections: {}, withheldPositionIds: [] };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readSelections(value: unknown): BallotSelections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(([, candidateIds]) => isStringArray(candidateIds))
  ) as BallotSelections;
}

function readDraft(electionId: string): BallotDraft {
  if (typeof window === 'undefined') return EMPTY_DRAFT;
  try {
    const raw = window.sessionStorage.getItem(storageKey(electionId));
    if (!raw) return EMPTY_DRAFT;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_DRAFT;

    // Migrate drafts written by the previous shape. Empty legacy entries are
    // intentionally treated as untouched because they did not record whether
    // the voter explicitly chose Withhold Vote.
    if ('selections' in parsed) {
      const stored = parsed as { selections?: unknown; withheldPositionIds?: unknown };
      return {
        selections: readSelections(stored.selections),
        withheldPositionIds: isStringArray(stored.withheldPositionIds)
          ? Array.from(new Set(stored.withheldPositionIds))
          : [],
      };
    }

    return { selections: readSelections(parsed), withheldPositionIds: [] };
  } catch {
    return EMPTY_DRAFT;
  }
}

function writeDraft(electionId: string, draft: BallotDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(electionId), JSON.stringify(draft));
  } catch {
    // sessionStorage unavailable (private mode / quota) — the draft still
    // works in memory for this tab, it just won't survive a refresh.
  }
}

/**
 * Exported standalone (not just reachable via the hook's `reset`) because
 * the successful-submit case that must also clear this entry lives outside
 * this file entirely — ConfirmSubmissionModal, where castVote() resolves.
 */
export function clearBallotDraft(electionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey(electionId));
  } catch {
    // no-op — nothing to clear if storage isn't available anyway
  }
}

/**
 * Security spec §13: sessionStorage only, never localStorage — a ballot
 * draft must not outlive the browser tab.
 */
export function ballotDraftReducer(state: BallotDraft, action: BallotDraftAction): BallotDraft {
  switch (action.type) {
    case 'SELECT_CANDIDATE': {
      const { positionId, candidateId, maxVotesPerVoter } = action;
      const current = state.selections[positionId] ?? [];

      if (current.includes(candidateId) && !state.withheldPositionIds.includes(positionId)) return state;

      const nextWithheldPositionIds = state.withheldPositionIds.filter((id) => id !== positionId);
      const nextState = {
        ...state,
        withheldPositionIds: nextWithheldPositionIds,
      };

      // Single-choice positions replace the existing pick rather than
      // accumulating one.
      if (maxVotesPerVoter === 1) {
        return {
          ...nextState,
          selections: { ...state.selections, [positionId]: [candidateId] },
        };
      }

      // Defense in depth: PositionControl is expected to disable the
      // control before this is ever reached, but the reducer must not
      // allow an over-cap selection to slip through either way — this is a
      // silent no-op, never an error.
      if (current.length >= maxVotesPerVoter) {
        return state;
      }

      return {
        ...nextState,
        selections: { ...state.selections, [positionId]: [...current, candidateId] },
      };
    }

    case 'DESELECT_CANDIDATE': {
      const { positionId, candidateId } = action;
      const current = state.selections[positionId] ?? [];
      if (!current.includes(candidateId)) return state;

      const next = current.filter((id) => id !== candidateId);
      return { ...state, selections: { ...state.selections, [positionId]: next } };
    }

    case 'SELECT_WITHHELD': {
      const current = state.selections[action.positionId] ?? [];
      if (current.length === 0 && state.withheldPositionIds.includes(action.positionId)) return state;

      const remainingSelections = { ...state.selections };
      delete remainingSelections[action.positionId];

      return {
        ...state,
        selections: remainingSelections,
        withheldPositionIds: state.withheldPositionIds.includes(action.positionId)
          ? state.withheldPositionIds
          : [...state.withheldPositionIds, action.positionId],
      };
    }

    case 'CLEAR_POSITION': {
      const hasSelections = (state.selections[action.positionId] ?? []).length > 0;
      const hasWithheld = state.withheldPositionIds.includes(action.positionId);
      if (!hasSelections && !hasWithheld) return state;

      const remainingSelections = { ...state.selections };
      delete remainingSelections[action.positionId];

      return {
        ...state,
        selections: remainingSelections,
        withheldPositionIds: state.withheldPositionIds.filter((id) => id !== action.positionId),
      };
    }

    case 'RESET':
      return EMPTY_DRAFT;

    default:
      return state;
  }
}

export function getIncompletePositionIds(
  positionIds: readonly string[],
  draft: BallotDraft
): string[] {
  return positionIds.filter(
    (positionId) =>
      (draft.selections[positionId] ?? []).length === 0 &&
      !draft.withheldPositionIds.includes(positionId)
  );
}

export function useBallotDraft(electionId: string) {
  const [draft, dispatch] = useReducer(ballotDraftReducer, electionId, readDraft);

  // Set right before a RESET dispatch so the effect below removes the
  // sessionStorage entry instead of persisting the post-reset empty draft — a
  // plain "write on every change" effect can't tell "user reset" apart
  // from "user cleared every position by hand", and only the former should
  // delete the key outright.
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      clearBallotDraft(electionId);
      return;
    }
    writeDraft(electionId, draft);
  }, [electionId, draft]);

  function reset() {
    skipNextPersistRef.current = true;
    dispatch({ type: 'RESET' });
  }

  return { draft, dispatch, reset };
}
