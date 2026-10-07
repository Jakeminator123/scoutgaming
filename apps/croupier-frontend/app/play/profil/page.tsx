import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {PlayerAreaDocument} from '@/components/player/player-area-document';
import {playerAreaPage, playerAreaRequest} from '@/lib/player-area.mjs';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Egen profil · Spelaryta · Scoutgaming'};

export default async function PlayerProfilePage() {
  const page = await playerAreaPage(playerAreaRequest('/play/profil', await headers()), process.env, 'profil');
  if (page.redirect) redirect(page.redirect);
  return <PlayerAreaDocument model={page.model} />;
}
