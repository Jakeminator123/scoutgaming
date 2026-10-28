import {useState} from 'react';
import {CircleDot,Spade} from 'lucide-react';
import {cn} from '../ui/kit';
import {roomLimitProfileImage} from '../../../../lib/room-limit-profiles.mjs';

type PictureRoom={game:string;environment?:{image?:string}|null;savedLimitPreset?:string};
// A room's picture on cards and rows: the published scene image when the catalog has one, else the
// lobby illustration of the room's saved bet profile, else the game symbol on a quiet gradient.
// Decorative only (empty alt); the room's name and facts sit beside it.
export function RoomPicture({room,className}:{room:PictureRoom;className?:string}) {
  const sources=[room.environment?.image,roomLimitProfileImage(room.savedLimitPreset)].filter((value):value is string=>Boolean(value));
  const [failed,setFailed]=useState<string[]>([]);
  const source=sources.find(value=>!failed.includes(value));
  return <span aria-hidden="true" className={cn('relative block shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-sg-surface-2 to-sg-hover',className)}>
    {source?<img src={source} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" onError={()=>setFailed(current=>[...current,source])}/>
      :<span className="absolute inset-0 grid place-items-center text-sg-faint [&_svg]:size-[45%] [&_svg]:max-h-6 [&_svg]:max-w-6">{room.game==='roulette'?<CircleDot strokeWidth={1.4}/>:<Spade strokeWidth={1.4}/>}</span>}
  </span>;
}
