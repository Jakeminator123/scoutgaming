import {PlayerLobbyDocument} from './player-lobby-document';
import {PlayerProfileForm} from './player-profile-form';

type PlayerField = {label: string, value: string};
type PlayerPill = {label: string, status: string};
type PlayerLink = {href: string, label: string};

export type PlayerAreaModel = {
  surface: 'lobby' | 'profil' | 'historik';
  eyebrow: string;
  title: string;
  intro: string;
  notice: string | null;
  fields: PlayerField[];
  pills: PlayerPill[];
  links: PlayerLink[];
  sentence: string | null;
  primary: {href: string, label: string} | null;
  empty: string | null;
  historyLines: string[];
  clientLabel: string | null;
  profileForm: {displayName: string, locale: 'sv' | 'en'} | null;
  profileNote: string | null;
  operator: {slug: string, name: string} | null;
};

function PrimaryAction({primary}: {primary: PlayerAreaModel['primary']}) {
  if (!primary) return null;
  return <a href={primary.href} className="mt-7 inline-block rounded-lg bg-emerald-300 px-6 py-3 font-semibold text-slate-950">{primary.label}</a>;
}

export function PlayerAreaDocument({model}: {model: PlayerAreaModel}) {
  if(model.surface==='lobby')return <PlayerLobbyDocument model={model}/>;
  return <main className="min-h-screen bg-[#0b151b] px-6 py-14 text-white">
    <div className="mx-auto max-w-3xl">
      <a href="/" className="text-sm text-slate-300">← Scoutgaming</a>
      <p className="mt-12 text-sm uppercase tracking-widest text-emerald-300">{model.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold">{model.title}</h1>
      <p className="mt-4 text-slate-300">{model.intro}</p>
      {model.notice ? <p role="status" className="mt-6 inline-block rounded-full border border-white/15 px-3 py-1 text-sm text-slate-200">{model.notice}</p> : null}
      {model.profileNote ? <p role="status" className="mt-6 text-slate-300">{model.profileNote}</p> : null}
      {model.profileForm ? <PlayerProfileForm displayName={model.profileForm.displayName} locale={model.profileForm.locale} /> : null}
      {model.fields.length ? <dl className="mt-6 space-y-2">{model.fields.map(field => <div key={field.label} className="flex flex-wrap gap-2 text-slate-200"><dt className="text-slate-400">{field.label}</dt><dd data-field={field.label}>{field.value}</dd></div>)}</dl> : null}
      {model.sentence ? <p className="mt-6 text-slate-300">{model.sentence}</p> : null}
      {model.empty ? <p role="status" className="mt-6 text-slate-300">{model.empty}</p> : null}
      {model.historyLines.length ? <ul className="mt-6 space-y-2 text-slate-200">{model.historyLines.map(line => <li key={line}>{line}</li>)}</ul> : null}
      {model.links.length ? <nav className="mt-6 flex flex-wrap gap-4" aria-label="Spelarkonto">{model.links.map(link => <a key={link.href} href={link.href} className="text-emerald-300 underline decoration-emerald-300/70 underline-offset-4">{link.label}</a>)}</nav> : null}
      <PrimaryAction primary={model.primary} />
      {model.pills.length ? <p className="mt-6 flex flex-wrap gap-2">{model.pills.map(pill => <span key={pill.label} className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-300">{pill.label} · {pill.status}</span>)}</p> : null}
    </div>
  </main>;
}
