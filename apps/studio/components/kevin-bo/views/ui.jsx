// Partnerportalens primitiver: samma bibliotek som Admin-klienten (Radix, cva,
// lucide, recharts), stylade av partner-portal.css med portalens tokens. Inga
// data och inga anrop här; komponenterna laddas bara bakom skalets 'use client'.
import React from 'react';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

// Radix-portaler hamnar i portalens rot så att tokens och tema följer med (skalet sätter den).
export const PortalRoot = React.createContext(null);
const usePortal = () => React.useContext(PortalRoot) ?? undefined;

export function Page({ eyebrow, title, intro, actions, children }) {
  return <div className="page">
    <div className="page-head">
      <div className="page-title">{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{intro ? <p className="intro">{intro}</p> : null}</div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
    {children}
  </div>;
}
// Brödsmulor: "Spelbord / Privé". Sista ledet är sidan själv.
export function Crumbs({ items }) {
  return <nav aria-label="Brödsmulor" className="crumbs">{items.map((item, index) => <React.Fragment key={index}>
    {index ? <ChevronRight aria-hidden="true" size={13} /> : null}
    {item.href ? <a href={item.href}>{item.label}</a> : <span aria-current="page">{item.label}</span>}
  </React.Fragment>)}</nav>;
}
export function Card({ title, aside, icon, className = '', children, ...rest }) {
  return <section className={clsx('card', className)} {...rest}>
    {title ? <div className="card-head"><h2>{icon ? <span className="card-icon" aria-hidden="true">{icon}</span> : null}{title}</h2>{aside ? <div className="aside">{aside}</div> : null}</div> : null}
    {children}
  </section>;
}
export function Chip({ tone = '', dot = false, children, title }) {
  return <span className={clsx('chip', tone)} title={title}>{dot ? <span className="dot" aria-hidden="true" /> : null}{children}</span>;
}
// Knappens varianter i ett ställe (samma mönster som Admin-klientens ui/button).
const buttonClass = cva('btn', {
  variants: { tone: { default: '', primary: 'primary', ghost: 'ghost', ink: 'ink', danger: 'danger' }, small: { true: 'small', false: '' }, icon: { true: 'icon', false: '' } },
  defaultVariants: { tone: 'default', small: false, icon: false },
});
export function Btn({ href, tone = 'default', small = false, icon = false, disabled = false, onClick, type = 'button', children, title, target, rel, ...rest }) {
  const className = buttonClass({ tone: tone || 'default', small, icon });
  if (href && !disabled) return <a href={href} className={className} title={title} target={target} rel={rel} {...rest}>{children}</a>;
  return <button type={type} className={className} disabled={disabled} aria-disabled={disabled ? 'true' : undefined} title={title} onClick={onClick} {...rest}>{children}</button>;
}
export function Row({ chip, title, text, href, action }) {
  const body = <><div>{chip}</div><div><div className="title">{title}</div>{text ? <div className="text">{text}</div> : null}</div><div>{action ?? null}</div></>;
  return href ? <a href={href} className="row link">{body}</a> : <div className="row">{body}</div>;
}
export function Empty({ title, text, action, chip, icon }) {
  return <div className="empty">{icon ? <div className="empty-icon" aria-hidden="true">{icon}</div> : null}{chip ? <Chip tone="warn">{chip}</Chip> : null}<h3>{title}</h3>{text ? <p className="small">{text}</p> : null}{action ? <div className="mt">{action}</div> : null}</div>;
}
export function KV({ items }) {
  return <dl className="kv">{items.map(([key, value], index) => <React.Fragment key={index}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>;
}
export function Note({ tone = '', children, role }) {
  return <div className={clsx('note', tone)} role={role}>{children}</div>;
}
export function Stat({ value, label, icon, children }) {
  return <div className="stat">{icon ? <span className="stat-icon" aria-hidden="true">{icon}</span> : null}<span className="v">{value}</span><span className="l">{label}</span>{children}</div>;
}

// Verktygstips (Radix): förklaringar och id:n utan att de syns i texten.
export function Tip({ content, children, side = 'top' }) {
  const container = usePortal();
  if (!content) return children;
  // Each tip carries its own provider, so a view also works outside the shell (tests, server markup).
  return <Tooltip.Provider delayDuration={250}><Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal container={container}><Tooltip.Content className="tip" side={side} sideOffset={6}>{content}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}

// Spelbordets små staplar per dag och större diagram (recharts). Tomma dagar syns som stubbar.
export function Bars({ values, label, height = 36 }) {
  const max = Math.max(1, ...values);
  const data = values.map((value, index) => ({ index, value, stub: value ? 0 : max * 0.08 }));
  return <div className="bars" style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
      <YAxis hide domain={[0, max]} />
      <Bar dataKey="value" stackId="day" fill="var(--chart-1)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      <Bar dataKey="stub" stackId="day" fill="var(--line)" isAnimationActive={false} />
    </BarChart></ResponsiveContainer>
  </div>;
}
// Rundor (staplar) och netto (linje, egen axel) per dag över perioden, med verktygstips.
export function TrendChart({ data, bars, line, height = 240, label }) {
  const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--faint)', fontSize: 11 } };
  const names = { [bars.key]: bars, ...(line ? { [line.key]: line } : {}) };
  return <div className="chart" style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 8, right: line ? 0 : 4, bottom: 0, left: -12 }} barCategoryGap="24%">
      <CartesianGrid vertical={false} stroke="var(--line-2)" />
      <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={16} />
      <YAxis yAxisId="bars" {...axis} allowDecimals={false} width={40} />
      {line ? <YAxis yAxisId="line" orientation="right" {...axis} width={56} tickFormatter={value => line.format ? line.format(value, true) : value} /> : null}
      <ChartTooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, boxShadow: 'var(--shadow)' }} labelStyle={{ color: 'var(--muted)', marginBottom: 4 }}
        formatter={(value, name) => [names[name]?.format ? names[name].format(value) : value, names[name]?.label ?? name]} />
      <Bar yAxisId="bars" dataKey={bars.key} fill={bars.color ?? 'var(--chart-1)'} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      {line ? <Line yAxisId="line" type="monotone" dataKey={line.key} stroke={line.color ?? 'var(--chart-2)'} strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
    </ComposedChart></ResponsiveContainer>
  </div>;
}


// Åtgärdsmeny (⋯) per rad (Radix DropdownMenu): varje åtgärd kan kräva en bekräftelse
// med konsekvenser (Radix Dialog) innan den körs. Menyn gör inget själv; onSelect gör anropet.
export function ActionMenu({ label, items, id, disabled = false }) {
  const container = usePortal();
  const [pending, setPending] = React.useState(null);
  const choose = item => { if (item.disabled) return; if (item.confirm) setPending(item); else item.onSelect(); };
  return <>
    <Dropdown.Root modal={false}>
      <Dropdown.Trigger asChild><button type="button" id={id} className="btn small icon" aria-label={label} disabled={disabled || !items.length}><MoreHorizontal size={16} aria-hidden="true" /></button></Dropdown.Trigger>
      <Dropdown.Portal container={container}><Dropdown.Content className="menu-content" align="end" sideOffset={4} aria-label={label}>
        {items.map(item => <Dropdown.Item key={item.id} className={clsx('menu-item', item.tone)} disabled={Boolean(item.disabled)} title={typeof item.disabled === 'string' ? item.disabled : undefined} onSelect={() => choose(item)}>{item.icon ? <span aria-hidden="true" className="menu-icon">{item.icon}</span> : null}{item.label}</Dropdown.Item>)}
      </Dropdown.Content></Dropdown.Portal>
    </Dropdown.Root>
    <Dialog.Root open={Boolean(pending)} onOpenChange={open => { if (!open) setPending(null); }}>
      <Dialog.Portal container={container}><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content" aria-describedby={pending?.confirm?.impact?.length ? `${id}-impact` : undefined}>
        <Dialog.Title>{pending?.confirm?.title}</Dialog.Title>
        {pending?.confirm?.impact?.length ? <ul id={`${id}-impact`}>{pending.confirm.impact.map(line => <li key={line}>{line}</li>)}</ul> : null}
        <div className="actions end"><Dialog.Close asChild><button type="button" className="btn">{pending?.confirm?.cancel ?? 'Avbryt'}</button></Dialog.Close>
          <button type="button" className={clsx('btn', pending?.tone === 'danger' ? 'danger-solid' : 'primary')} onClick={() => { const item = pending; setPending(null); item?.onSelect(); }}>{pending?.confirm?.button}</button></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}

// Böjning: "1 dealer", "2 dealers"; "1 scenmall", "2 scenmallar".
export function count(value, one, many) { return `${value} ${value === 1 ? one : many}`; }

export const locale = language => language === 'en' ? 'en-GB' : 'sv-SE';
export const fmtInt = (value, language) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(locale(language)).format(value) : '—';
export function fmtDate(ms, language) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
