// Partnerportalens primitiver (efter ny-admin-skiss/components/ui.tsx). Inga
// hooks, ingen data: bara markup som partner-portal.css stylar.
import React from 'react';

export function Page({ eyebrow, title, intro, actions, children }) {
  return <div className="page">
    <div className="page-head">
      <div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h1>{title}</h1>{intro ? <p className="intro">{intro}</p> : null}</div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
    {children}
  </div>;
}
export function Card({ title, aside, className = '', children, ...rest }) {
  return <section className={`card ${className}`.trim()} {...rest}>
    {title ? <div className="card-head"><h2>{title}</h2>{aside ? <div className="aside">{aside}</div> : null}</div> : null}
    {children}
  </section>;
}
export function Chip({ tone = '', dot = false, children }) {
  return <span className={`chip ${tone}`.trim()}>{dot ? <span className="dot" aria-hidden="true" /> : null}{children}</span>;
}
export function Btn({ href, tone = '', small = false, disabled = false, onClick, type = 'button', children, title, target, rel }) {
  const className = `btn ${tone} ${small ? 'small' : ''}`.trim().replace(/\s+/g, ' ');
  if (href && !disabled) return <a href={href} className={className} title={title} target={target} rel={rel}>{children}</a>;
  return <button type={type} className={className} disabled={disabled} aria-disabled={disabled ? 'true' : undefined} title={title} onClick={onClick}>{children}</button>;
}
export function Row({ chip, title, text, href, action }) {
  const body = <><div>{chip}</div><div><div className="title">{title}</div>{text ? <div className="text">{text}</div> : null}</div><div>{action ?? null}</div></>;
  return href ? <a href={href} className="row link">{body}</a> : <div className="row">{body}</div>;
}
export function Empty({ title, text, action, chip }) {
  return <div className="empty">{chip ? <Chip tone="warn">{chip}</Chip> : null}<h3>{title}</h3>{text ? <p className="small">{text}</p> : null}{action ? <div className="mt">{action}</div> : null}</div>;
}
export function KV({ items }) {
  return <dl className="kv">{items.map(([key, value], index) => <React.Fragment key={index}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>;
}
export function Note({ tone = '', children, role }) {
  return <div className={`note ${tone}`.trim()} role={role}>{children}</div>;
}
export function Stat({ value, label }) {
  return <div className="stat"><span className="v">{value}</span><span className="l">{label}</span></div>;
}
// Small bars, one per day. A zero day stays visible as a faint stub.
export function Bars({ values, label, height = 36 }) {
  const max = Math.max(1, ...values);
  return <div className="bars" style={{ height }} role="img" aria-label={label}>{values.map((value, index) =>
    <i key={index} className={value ? '' : 'zero'} style={{ height: `${Math.max(6, (value / max) * 100)}%` }} />)}</div>;
}
export function Tabs({ items, active, onSelect, label }) {
  return <div className="tabs" role="tablist" aria-label={label}>{items.map(item =>
    <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-selected={item.id === active ? 'true' : 'false'} aria-controls={`panel-${item.id}`} onClick={() => onSelect(item.id)}>
      {item.label}{item.count !== undefined ? <span className="count">{item.count}</span> : null}
    </button>)}</div>;
}

export const locale = language => language === 'en' ? 'en-GB' : 'sv-SE';
export function fmtMoney(value, currency, language) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const text = new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
  return currency ? `${text} ${currency}` : text;
}
export const fmtInt = (value, language) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat(locale(language)).format(value) : '—';
export function fmtDate(ms, language) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
export function fmtDateTime(ms, language) {
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString(locale(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
