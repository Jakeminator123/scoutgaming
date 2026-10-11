import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {demoLobbyPath} from '@/lib/player-lobby.mjs';

export const metadata:Metadata={
  title:'Välj bolag och spelrum · Scoutgaming',
  description:'Välj spelbolag, blackjackrum, dealer och miljö i Scoutgamings spellobby.',
};

export default async function DemoPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  redirect(demoLobbyPath(await searchParams??{}));
}
