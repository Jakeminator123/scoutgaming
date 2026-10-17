import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {PlayerAreaDocument} from '@/components/player/player-area-document';
import {playerAreaPage, playerAreaRequest} from '@/lib/player-area.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Välj bolag och spelrum · Scoutgaming', description: 'Välj spelbolag, blackjackrum, dealer och miljö. Demo utan riktiga pengar.'};

export default async function PlayerLobbyPage({searchParams}: {searchParams?: Promise<Record<string, string | string[] | undefined>>}) {
  const query = searchParams ? await searchParams : {};
  const operator = typeof query.operator === 'string' ? query.operator : '';
  const path = operator ? `/play?operator=${encodeURIComponent(operator)}` : '/play';
  const page = await playerAreaPage(playerAreaRequest(path, await headers()), process.env, 'lobby');
  if (page.redirect) redirect(page.redirect);
  return <PlayerAreaDocument model={page.model} />;
}
