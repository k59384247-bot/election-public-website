import type { Metadata } from 'next';
import { PublicResultsPage } from '@/features/results/components/PublicResultsPage';
import '@/app/elections/[electionId]/vote/vote.css';
import '@/features/results/results.css';

export const metadata: Metadata = { title: 'Election results' };

export default function ResultsPage() { return <PublicResultsPage />; }
