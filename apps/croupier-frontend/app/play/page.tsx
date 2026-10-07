import {headers} from 'next/headers';
import {PlayerAreaDocument} from '@/components/player/player-area-document';
import {playerAreaPage, playerAreaRequest} from '@/lib/player-area.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Spellobby · Spelaryta · Scoutgaming'};

export default async function PlayerLobbyPage() {
  const page = await playerAreaPage(playerAreaRequest('/play', await headers()), process.env, 'lobby');
  return <PlayerAreaDocument model={page.model} />;
}
