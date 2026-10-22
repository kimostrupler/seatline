import type { Metadata } from 'next';
import { TeamsTab } from '@/components/teams/teams-tab';

export const metadata: Metadata = { title: 'Seatline' };

/** The tab inside Microsoft Teams and Outlook (see the Teams app from People & access). */
export default function TeamsPage() {
  return <TeamsTab />;
}
