'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCheck, Download, Link2, Loader2 } from 'lucide-react';
import { getElectionById, getElectionResults, getElectionReportDownload } from '@/features/election/api';
import { useTenant } from '@/features/tenant/TenantContext';
import { ElectionHead } from '@/features/voting/components/ElectionHead';
import { VotePageShell } from '@/features/voting/components/VotePageShell';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor } from '@/lib/errors';
import { buildResultsView, publishedDate, resultsHref } from '../model';
import { ResultPositionCard } from './ResultPositionCard';

export function PublicResultsPage() {
  const { electionId } = useParams<{ tenantId: string; electionId: string }>();
  const { tenantId } = useTenant();
  const [notice, setNotice] = useState('');
  const [downloading, setDownloading] = useState(false);
  const detail = useQuery({ queryKey: ['public-election-detail', tenantId, electionId],
    queryFn: () => getElectionById(tenantId, electionId), staleTime: 0, retry: false });
  const results = useQuery({ queryKey: ['public-election-results', tenantId, electionId],
    queryFn: () => getElectionResults(tenantId, electionId), enabled: detail.data?.status === 'results_published',
    staleTime: 30_000, retry: false,
    // Poll aggregate metadata for a bounded time while the background report
    // is being prepared. Never request its file or signed URL automatically.
    refetchInterval: (query) => query.state.dataUpdateCount < 18 &&
      ['pending', 'generating'].includes(query.state.data?.report?.status ?? '') ? 10_000 : false,
  });
  const election = detail.data;
  const data = results.data;
  const report = data?.report;
  const positions = data && election ? buildResultsView(data, election) : [];
  const hasSingleSeatTie = positions.some((position) => position.seats === 1 && position.candidates.some((candidate) => candidate.isTie));

  async function download() {
    if (downloading) return;
    setDownloading(true); setNotice('');
    try {
      const report = await getElectionReportDownload(tenantId, electionId);
      const url = new URL(report.downloadUrl);
      if (url.protocol !== 'https:') throw new Error('Invalid report download');
      const link = document.createElement('a');
      link.href = url.toString(); link.download = report.filename; link.rel = 'noopener';
      document.body.append(link); link.click(); link.remove();
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? getErrorDescriptor(error.code, 'results').userMessage : 'Unable to download the results PDF. Please try again.');
      void results.refetch();
    } finally { setDownloading(false); }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(new URL(resultsHref(tenantId, electionId), window.location.origin).toString());
      setNotice('Results link copied.');
    } catch { setNotice('Copy this page’s address from your browser to share the results.'); }
  }
  const failure = detail.error ?? results.error;
  let content;
  if (failure) {
    const descriptor = getErrorDescriptor(failure instanceof ApiRequestError ? failure.code : 'INTERNAL', 'results');
    content = <section className="card results-state" role="status"><h2>Election results</h2><p>{descriptor.userMessage}</p>
      {descriptor.recoveryAction === 'retry' && <button className="btn btn--gold" type="button" onClick={() => { void detail.refetch(); if (election?.status === 'results_published') void results.refetch(); }}>Try again</button>}</section>;
  } else if (detail.isLoading || (election?.status === 'results_published' && results.isLoading)) {
    content = <section className="card results-state" role="status" aria-busy="true"><Loader2 aria-hidden="true" /><h2>Loading election results…</h2></section>;
  } else if (election && election.status !== 'results_published') {
    content = <section className="card results-state" role="status"><h2>Results awaiting publication</h2><p>Results will appear here once the Electoral Committee publishes them.</p><button className="btn btn--gold" type="button" disabled={detail.isFetching} onClick={() => void detail.refetch()}>Check for results</button></section>;
  } else if (data) {
    content = <>
      <div className="publication-line"><CheckCheck size={18} aria-hidden="true" /><span>Published by the Electoral Committee{data.publishedAt ? ` · ${publishedDate(data.publishedAt)}` : ''}</span></div>
      <div className="result-actions">
        {report?.status === 'ready' && <button className="btn btn--gold result-download" disabled={downloading} type="button" onClick={() => void download()}>{downloading ? <Loader2 size={22} aria-hidden="true" /> : <Download size={22} aria-hidden="true" />}{downloading ? 'Preparing download…' : 'Download results PDF'}{report.bytes ? <span className="report-size">{Math.ceil(report.bytes / 1024)} KB</span> : null}</button>}
        <button className="btn result-copy" type="button" onClick={() => void share()}><Link2 size={20} aria-hidden="true" />Copy results link</button>
        <p className="action-notice" role="status">{notice}</p>
      </div>
      {report?.status !== 'ready' && <div className="report-availability"><p>{report?.status === 'pending' || report?.status === 'generating' ? 'The results PDF is being prepared. You can read the full results below.' : 'The PDF is currently unavailable. You can read the full results below.'}</p><button type="button" disabled={results.isFetching} onClick={() => void results.refetch()}>Check PDF availability</button></div>}
      <dl className="result-summary"><div><dt>Ballots cast</dt><dd>{data.totalVotesCast.toLocaleString('en-US')}</dd></div><div><dt>Positions</dt><dd>{positions.length}</dd></div><div><dt>Voting</dt><dd>Closed</dd></div></dl>
      <section className="result-content" aria-labelledby="result-section-title"><div className="result-section-intro"><h2 className="vote__section-title" id="result-section-title">{hasSingleSeatTie ? 'RESULTS BY POSITION' : 'MEET YOUR ELECTED TEAM'}</h2><p>The outcome first. Full counts are one click away.</p></div>
        {positions.length ? <div className="winner-grid">{positions.map((position, index) => <ResultPositionCard position={position} index={index} key={position.id} />)}</div> : <section className="card results-state"><h3>No positions to display</h3><p>No positions were configured for this election.</p></section>}
      </section>
      <div className="results-footnote"><p>Individual ballots and voter information are private.</p><Link href={`/${tenantId}`}>Back to Elections <ArrowRight size={18} aria-hidden="true" /></Link></div>
    </>;
  }
  return <VotePageShell mobileCenteredLogo>
    <Link className="btn btn--ghost result-back" href={`/${tenantId}`}><ArrowLeft size={24} aria-hidden="true" />Back to Elections</Link>
    {election && <ElectionHead election={election} showVoterDetails={false} />}
    {content}
  </VotePageShell>;
}
