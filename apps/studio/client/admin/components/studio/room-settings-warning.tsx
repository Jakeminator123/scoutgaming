import Link from '../../../runtime/navigation';
import {Badge,buttonVariants,cn} from '../ui/kit';

// Ett öppet blackjack-spelbord vars publicerade tilldelning inte binder några spelinställningar
// (katalogens settingsMissing, lib/design-preview-catalog.mjs) tar inte emot någon spelare: spelmotorn
// nekar med room_config_missing och lobbyn visar spelbordet som "förbereds". Admin säger samma sak på
// spelbordet och i listan, med en knapp till fliken Spelinställningar där de publiceras.
export const ROOM_SETTINGS_MISSING='Saknar spelinställningar – spelare kan inte sätta sig';
type RoomState={id:string;state:string;settingsMissing?:boolean};
export const roomSettingsHref=(room:Pick<RoomState,'id'>)=>`/admin/rooms/${encodeURIComponent(room.id)}?flik=spel`;
export const roomPreparing=(room:RoomState)=>room.state==='live'&&room.settingsMissing===true;

/** Läget i listor och rubrik: öppet, pausat eller förbereds (öppet utan publicerade spelinställningar). */
export function RoomStateChip({room}:{room:RoomState}) {
  if(roomPreparing(room))return <Badge tone="warn" dot title={ROOM_SETTINGS_MISSING}>förbereds</Badge>;
  return <Badge tone={room.state==='live'?'live':'warn'} dot>{room.state==='live'?'öppet':'pausat'}</Badge>;
}

/** Varningen med knapp till Spelinställningar; `compact` är listans rad. Inget visas för ett spelbord som kan spelas. */
export function RoomSettingsWarning({room,compact=false,className}:{room:RoomState;compact?:boolean;className?:string}) {
  if(!roomPreparing(room))return null;
  if(compact)return <span data-room-settings-missing="" className={cn('block text-[12px] text-sg-warn',className)}>{ROOM_SETTINGS_MISSING}{' · '}
    <Link className="font-semibold text-sg-warn underline" href={roomSettingsHref(room)}>Spelinställningar</Link></span>;
  return <div role="alert" data-room-settings-missing="" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sg-warn-bg px-3.5 py-2.5 text-[13px] text-sg-warn',className)}>
    <span><strong className="font-semibold">{ROOM_SETTINGS_MISSING}.</strong> Välj språk och insatsprofil och publicera dem; till dess visas spelbordet som förbereds i lobbyn.</span>
    <Link className={buttonVariants({size:'sm'})} href={roomSettingsHref(room)}>Öppna Spelinställningar</Link>
  </div>;
}
