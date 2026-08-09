'use client';

import { useEffect, useReducer, useRef } from 'react';

/** { [positionId]: candidateId[] }. A missing/empty entry is a valid state — zero votes for that position. */
export type BallotDraft = Record<string, string[]>;

export type BallotDraftAction =
  | { type: 'SELECT_CANDIDATE'; positionId: string; candidateId: string; maxVotesPerVoter: number }
  | { type: 'DESELECT_CANDIDATE'; positionId: string; candidateId: string }
  | { type: 'CLEAR_POSITION'; positionId: string }
  | { type: 'RESET' };

function storageKey(electionId: string): string {
  return `ballot-draft:${electionId}`;
}

function readDraft(electionId: string): BallotDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(storageKey(electionId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as BallotDraft) : {};
  } catch {
    return {};
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
      const current = state[positionId] ?? [];

      if (current.includes(candidateId)) return state;

      // Single-choice positions replace the existing pick rather than
      // accumulating one.
      if (maxVotesPerVoter === 1) {
        return { ...state, [positionId]: [candidateId] };
      }

      // Defense in depth: PositionControl is expected to disable the
      // control before this is ever reached, but the reducer must not
      // allow an over-cap selection to slip through either way — this is a
      // silent no-op, never an error.
      if (current.length >= maxVotesPerVoter) {
        return state;
      }

      return { ...state, [positionId]: [...current, candidateId] };
    }

    case 'DESELECT_CANDIDATE': {
      const { positionId, candidateId } = action;
      const current = state[positionId] ?? [];
      if (!current.includes(candidateId)) return state;

      const next = current.filter((id) => id !== candidateId);
      return { ...state, [positionId]: next };
    }

    case 'CLEAR_POSITION': {
      if (!(action.positionId in state) || state[action.positionId].length === 0) return state;
      return { ...state, [action.positionId]: [] };
    }

    case 'RESET':
      return {};

    default:
      return state;
  }
}

export function useBallotDraft(electionId: string) {
  const [draft, dispatch] = useReducer(ballotDraftReducer, electionId, readDraft);

  // Set right before a RESET dispatch so the effect below removes the
  // sessionStorage entry instead of persisting the post-reset `{}` — a
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
