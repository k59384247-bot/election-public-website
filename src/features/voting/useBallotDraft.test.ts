import { describe, expect, it } from 'vitest';
import {
  ballotDraftReducer,
  getIncompletePositionIds,
  type BallotDraft,
} from './useBallotDraft';

const emptyDraft: BallotDraft = {
  selections: {},
  withheldPositionIds: [],
};

describe('ballotDraftReducer', () => {
  it('leaves untouched positions empty and unwithheld', () => {
    expect(emptyDraft.selections.position1).toBeUndefined();
    expect(emptyDraft.withheldPositionIds).toEqual([]);
  });

  it('records an explicit withheld choice separately from an empty selection', () => {
    const next = ballotDraftReducer(emptyDraft, {
      type: 'SELECT_WITHHELD',
      positionId: 'position-1',
    });

    expect(next).toEqual({
      selections: {},
      withheldPositionIds: ['position-1'],
    });
  });

  it('replaces an explicit withheld choice when a candidate is selected', () => {
    const withheld = ballotDraftReducer(emptyDraft, {
      type: 'SELECT_WITHHELD',
      positionId: 'position-1',
    });

    expect(
      ballotDraftReducer(withheld, {
        type: 'SELECT_CANDIDATE',
        positionId: 'position-1',
        candidateId: 'candidate-1',
        maxVotesPerVoter: 2,
      })
    ).toEqual({
      selections: { 'position-1': ['candidate-1'] },
      withheldPositionIds: [],
    });
  });

  it('clearing a position removes both its selections and explicit withhold', () => {
    const withheld = ballotDraftReducer(emptyDraft, {
      type: 'SELECT_WITHHELD',
      positionId: 'position-1',
    });

    expect(ballotDraftReducer(withheld, { type: 'CLEAR_POSITION', positionId: 'position-1' })).toEqual(
      emptyDraft
    );
  });
});

describe('getIncompletePositionIds', () => {
  it('returns untouched positions but excludes selected and explicitly withheld positions', () => {
    const draft = ballotDraftReducer(emptyDraft, {
      type: 'SELECT_CANDIDATE',
      positionId: 'position-1',
      candidateId: 'candidate-1',
      maxVotesPerVoter: 1,
    });
    const completeDraft = ballotDraftReducer(draft, {
      type: 'SELECT_WITHHELD',
      positionId: 'position-2',
    });

    expect(getIncompletePositionIds(['position-1', 'position-2', 'position-3'], completeDraft)).toEqual([
      'position-3',
    ]);
  });
});
