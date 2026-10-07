import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {PlayerAreaDocument} from '@/components/player/player-area-document';
import {playerAreaPage, playerAreaRequest} from '@/lib/player-area.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Egen historik · Spelaryta · Scoutgaming'};

export default async function PlayerHistoryPage() {
  const page = await playerAreaPage(playerAreaRequest('/play/historik', await headers()), process.env, 'historik');
  if (page.redirect) redirect(page.redirect);
  return <PlayerAreaDocument model={page.model} />;
}
