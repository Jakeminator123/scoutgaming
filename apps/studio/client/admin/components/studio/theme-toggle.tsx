import {useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {applyThemeMode,readThemeMode,type ThemeMode} from '../../../../lib/theme-mode.mjs';

// Ett lägesval för Admin och Partnerportalen (lib/theme-mode.mjs). Mörkt är standard;
// valet sparas i webbläsaren och gäller båda ytorna.
export function ThemeToggle() {
  const [mode,setMode]=useState<ThemeMode>(()=>readThemeMode());
  const next:ThemeMode=mode==='dark'?'light':'dark';
  const label=next==='light'?'Ljust tema':'Mörkt tema';
  const Icon=next==='light'?Sun:Moon;
  return <button type="button" className="studio-theme-toggle" aria-label={'Byt till '+label.toLowerCase()} title={'Byt till '+label.toLowerCase()}
    onClick={()=>setMode(applyThemeMode(next))}><Icon size={17} aria-hidden="true"/><span>{label}</span></button>;
}
