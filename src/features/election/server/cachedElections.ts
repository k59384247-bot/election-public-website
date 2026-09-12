/**
 * Compatibility entry point for deployments that still have the previous
 * election-list page bundle. Election-list data is no longer cached; the
 * canonical implementation lives in freshElections.ts.
 */
export {
  getFreshElectionList,
  prewarmFreshElectionList,
} from './freshElections';
