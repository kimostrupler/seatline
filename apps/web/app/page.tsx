import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard/dashboard';
import { requireMember } from '@/lib/server/require-member';

const MAP_PARAMS = ['building', 'floor', 'seat', 'person', 'mode'];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireMember();
  // links from before the dashboard (e.g. "/?floor=…&seat=…") open the map
  const params = await searchParams;
  if (MAP_PARAMS.some((k) => params[k])) {
    const query = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
    redirect(`/map?${query.toString()}`);
  }
  return <Dashboard />;
}
