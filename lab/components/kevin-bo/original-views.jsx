// Native React port of the GitLab design source. Instance-local, no legacy server.
import React from 'react';
export function createOriginalViews(runtime) {
const { assetUrl } = runtime;
const session = {user:runtime.user, role:'admin'};
const api = runtime.api;
const notifyError = error => runtime.notify(error?.message || 'Åtgärden kunde inte utföras.');
const unavailable = runtime.unavailable;
const settingRead = (key, fallback) => structuredClone(runtime.settings[key] ?? fallback);
async function settingSave(key, value) {
  if (!['tableDrafts','dealerDrafts','backgrounds','reportExports'].includes(key)) throw Error('Inställningen är inte ansluten i denna förhandsvisning.');
  runtime.settings[key] = structuredClone(value); runtime.dirty=true;
  runtime.notify('Lokalt utkast i denna flik. Inget sparat på servern.');
  return value;
}
const savedSetting = (key, value) => settingSave(key, value).catch(notifyError);
const aggregate = rows => { const stakes=rows.reduce((sum,row)=>sum+Math.round(row.stakes*100),0),payouts=rows.reduce((sum,row)=>sum+Math.round(row.payouts*100),0);return{stakes:stakes/100,payouts:payouts/100,result:(stakes-payouts)/100,rounds:new Set(rows.map(row=>row.room+':'+row.roundId)).size}; };
function recordedRows(brand='all',scope={}) { return runtime.data2.settlements.filter(row=>(brand==='all'||row.brand===brand)&&(!scope.table||scope.table==='all'||row.room===scope.table)); }
function resultFor(period,brand) { return aggregate(recordedRows(brand)); }
const imageFile = async file => {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size>2100000) throw Error('Use PNG, JPG or WebP under 2 MB.');
  const url=URL.createObjectURL(file);
  try { const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1000/img.width,1000/img.height),c=document.createElement('canvas');c.width=img.width*scale;c.height=img.height*scale;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png'); }
  finally { URL.revokeObjectURL(url); }
};
const sharePreview=async(brand,toast)=>{try {const url=new URL(location.href);url.hash='test';await navigator.clipboard.writeText(url.href);toast('Länk kopierad. Endast intern administratör kan öppna förhandsvisningen.');}catch{toast('Kunde inte kopiera länken.');}};
function downloadRows(name,columns,rows) {
  const quote=value=>'"'+String(value??'').replace(/^[=+@\t\r-]/,"'").replaceAll('"','""')+'"';
  const csv=['FIXTURE PREVIEW - NO LIVE CUSTOMER DATA',columns.map(quote).join(','),...rows.map(row=>row.map(quote).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='fixture-'+name.replace(/[^a-z0-9 _-]/gi,'')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return blob.size;
}
async function exportReport(name,columns,rows,format) { if(format!=='CSV')throw Error('Only labelled fixture CSV is available; PDF/XLSX export is not connected.');return downloadRows(name,columns,rows); }


// Source: shell.jsx at 7dee0901; see source-provenance.json.
const NAV = runtime.navigation;
const STUDIO = runtime.studioNavigation;
function Mark({
  size = 22
}) {
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{
    display: 'block',
    flex: 'none'
  }}>
    <path d="M8 22V8H22M78 8H92V22M92 78V92H78M22 92H8V78" stroke="#0A0B0D" strokeWidth="8" fill="none" strokeLinecap="square" />
    <path d="M68 36C68 28 60 24 50 24C40 24 32 28 32 36C32 50 68 50 68 64C68 72 60 76 50 76C40 76 32 72 32 64" stroke="#0A0B0D" strokeWidth="9.5" fill="none" strokeLinecap="square" />
  </svg>;
}
const BO_ROLES = runtime.surface === 'partner' ? [['reader', 'Partner analyst'], ['staff', 'Partner editor'], ['admin', 'Partner administrator']] : [['reader', 'Internal reader'], ['staff', 'Internal staff'], ['admin', 'Administrator'], ['superadmin', 'Internal administrator']];
const isAdmin = r => r === 'admin' || r === 'superadmin';
const tmAllTabs = () => [...NAV.flatMap(g => g.items.map(i => i[0])), ...STUDIO.map(i => i[0])];
function tmPreset(role) {
  const o = {};
  const T = tmAllTabs();
  if (role === 'superadmin' || role === 'admin') {
    T.forEach(t => {
      o[t] = 'edit';
    });
    return o;
  }
  T.forEach(t => {
    o[t] = 'none';
  });
  if (role === 'staff') {
    ['ops', 'players', 'pit', 'test'].forEach(t => o[t] = 'edit');
    ['tx', 'bj', 'roulette', 'baccarat', 'dealers', 'shoes', 'stats', 'reports'].forEach(t => o[t] = 'view');
  }
  if (role === 'reader') ['ops', 'players', 'tx', 'bj', 'roulette', 'baccarat', 'dealers', 'stats', 'reports'].forEach(t => o[t] = 'view');
  return o;
}
function tmStore() {
  return settingRead('access', {});
}
function tmAccessOf(user, role) {
  return tmPreset(role);
}
async function tmSave() {
  throw new Error('Access configuration is not connected in this preview.');
}
const tmMine = role => tmPreset(role);
function Badge({
  status,
  children
}) {
  const label = {
    live: 'Live',
    warning: 'Warning',
    error: 'Error',
    paused: 'Paused',
    closed: 'Closed'
  }[status];
  return <span className={'badge b-' + status}><i></i>{children || label}</span>;
}
function Drawer({
  open,
  onClose,
  children,
  width = 560
}) {
  React.useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!open) return null;
  return <div className="scrim" onClick={onClose}><div className="drawer" style={{
      width
    }} onClick={e => e.stopPropagation()}>{children}</div></div>;
}
function Modal({
  open,
  title,
  onClose,
  children,
  footer
}) {
  if (!open) return null;
  return <div className="scrim center" onClick={onClose}><div className="modal" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
    <div className="modal-h"><h2>{title}</h2><button className="btn ghost sm" onClick={onClose} aria-label="Close">Close</button></div>
    <div className="modal-b">{children}</div>
    <div className="modal-f">{footer}</div>
  </div></div>;
}
function Toast({
  msg
}) {
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
function EmptyState({
  title,
  body,
  action
}) {
  return <div className="empty"><div className="empty-box"></div><h3>{title}</h3><p className="muted">{body}</p>{action}</div>;
}
const brandName = id => (runtime.data.brands.find(b => b.id === id) || {}).name;
function BrandTags({
  ids
}) {
  const B = runtime.data.brands;
  if (ids.length === B.length) return <span className="muted">All brands</span>;
  return <span className="btags">{ids.map(id => <span key={id} className="btag" title={brandName(id)}>{B.find(b => b.id === id).code}</span>)}</span>;
}
const money = (n, sign) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return (n < 0 ? '−$' : sign && n > 0 ? '+$' : '$') + s;
};

// Source: design.jsx at 7dee0901; see source-provenance.json.
const hexToRgb = h => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
const rgbToHsv = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d) {
    h = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
};
const hsvToRgb = (h, s, v) => {
  const f = n => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
};
const lum = hex => {
  const c = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const TD_LAYOUTS = {
  classic: {
    label: 'Classic',
    note: 'Half-moon with rail',
    path: 'M40 40 H960 A460 480 0 0 1 40 40 Z',
    cx: 500,
    cy: 40,
    rx: 460,
    ry: 480,
    rail: true
  },
  round: {
    label: 'Rounded',
    note: 'Soft corners with rail',
    path: 'M100 40 H900 Q960 40 960 100 A460 440 0 0 1 40 100 Q40 40 100 40 Z',
    cx: 500,
    cy: 100,
    rx: 460,
    ry: 440,
    rail: true
  },
  wide: {
    label: 'Wide',
    note: 'Shallow, no rail',
    path: 'M20 40 H980 A480 330 0 0 1 20 40 Z',
    cx: 500,
    cy: 40,
    rx: 480,
    ry: 330,
    rail: false
  }
};
const TD_PRESETS = [{
  name: 'Privé',
  felt: '#2B2622',
  rail: '#6E5A3E',
  print: '#D9C9A3'
}, {
  name: 'Emerald Club',
  felt: '#145C43',
  rail: '#2B2622',
  print: '#E9DDB8'
}, {
  name: 'Midnight',
  felt: '#1F3A6B',
  rail: '#1A1C20',
  print: '#F2F1ED'
}, {
  name: 'Burgundy',
  felt: '#6B2233',
  rail: '#2B2622',
  print: '#E9DDB8'
}, {
  name: 'Slate',
  felt: '#3B4450',
  rail: '#1A1C20',
  print: '#F2F1ED'
}, {
  name: 'Teal',
  felt: '#0F5E63',
  rail: '#23282B',
  print: '#F2F1ED'
}, {
  name: 'Sand',
  felt: '#C9B48A',
  rail: '#5B4A33',
  print: '#2B2622'
}, {
  name: 'Graphite',
  felt: '#1D1F22',
  rail: '#3A3D42',
  print: '#D6FF3A'
}];
const TD_DEFAULTS = {
  scout: {
    name: 'Scout Privé',
    layout: 'classic',
    felt: '#2B2622',
    rail: '#6E5A3E',
    print: '#D9C9A3',
    logo: null,
    logoSize: 200,
    logoPos: 'center',
    logoTint: false
  },
  nrk: {
    name: 'Norrsken Classic',
    layout: 'classic',
    felt: '#145C43',
    rail: '#2B2622',
    print: '#E9DDB8',
    logo: null,
    logoSize: 200,
    logoPos: 'center',
    logoTint: false
  },
  bfj: {
    name: 'BetFjord Blue',
    layout: 'round',
    felt: '#1F3A6B',
    rail: '#1A1C20',
    print: '#F2F1ED',
    logo: null,
    logoSize: 200,
    logoPos: 'center',
    logoTint: false
  },
  aur: {
    name: 'Aurora Burgundy',
    layout: 'classic',
    felt: '#6B2233',
    rail: '#2B2622',
    print: '#E9DDB8',
    logo: null,
    logoSize: 200,
    logoPos: 'center',
    logoTint: false
  }
};
const TD_KEY = 'bo.tableDesigns';
function loadDesigns() {
  let s = runtime.designStore.read('tables');
  const out = {};
  Object.keys(TD_DEFAULTS).forEach(b => {
    const x = s[b] || {};
    out[b] = {
      draft: {
        ...TD_DEFAULTS[b],
        ...(x.draft || {})
      },
      published: {
        ...TD_DEFAULTS[b],
        ...(x.published || {})
      },
      tables: x.tables || runtime.data.tables.filter(t => t.game === 'Blackjack' && t.brands.includes(b)).map(t => t.id)
    };
  });
  return out;
}
function saveDesigns(d) {
  runtime.designStore.write('tables', d);
  return true;
}
function tdPrepLogo(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height)),
        w = Math.max(1, Math.round(img.width * k)),
        h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, w, h);
      let data;
      try {
        data = x.getImageData(0, 0, w, h);
      } catch (e) {
        res({
          src,
          opaque: false
        });
        return;
      }
      const p = data.data;
      let alpha = false;
      for (let i = 3; i < p.length; i += 16) if (p[i] < 245) {
        alpha = true;
        break;
      }
      if (alpha) {
        res({
          src,
          opaque: false
        });
        return;
      }
      const at = (px, py) => {
        const i = (py * w + px) * 4;
        return [p[i], p[i + 1], p[i + 2]];
      };
      const cs = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)],
        bg = [0, 1, 2].map(k2 => cs.reduce((n, q) => n + q[k2], 0) / 4);
      const dist = q => Math.hypot(q[0] - bg[0], q[1] - bg[1], q[2] - bg[2]);
      if (cs.some(q => dist(q) > 40)) {
        res({
          src,
          opaque: true,
          removed: false
        });
        return;
      }
      for (let i = 0; i < p.length; i += 4) {
        const dd = dist([p[i], p[i + 1], p[i + 2]]);
        if (dd < 38) p[i + 3] = 0;else if (dd < 70) p[i + 3] = Math.round((dd - 38) / 32 * 255);
      }
      x.putImageData(data, 0, 0);
      res({
        src: c.toDataURL('image/png'),
        opaque: true,
        removed: true
      });
    };
    img.onerror = () => res({
      src,
      opaque: false
    });
    img.src = src;
  });
}
function seatPos(layout) {
  const L = TD_LAYOUTS[layout];
  return {
    H: L.cy + L.ry + 30,
    pos: Array.from({
      length: 7
    }, (_, i) => {
      const a = (160 - i * 140 / 6) * Math.PI / 180;
      return [L.cx + L.rx * .84 * Math.cos(a), L.cy + L.ry * .84 * Math.sin(a)];
    })
  };
}
function TableSVG({
  d,
  uid = 'p',
  brandLabel,
  noSeats
}) {
  const L = TD_LAYOUTS[d.layout];
  const arc = k => `M${L.cx - L.rx * k} ${L.cy} A${L.rx * k} ${L.ry * k} 0 0 0 ${L.cx + L.rx * k} ${L.cy}`;
  const seats = Array.from({
    length: 7
  }, (_, i) => {
    const a = (160 - i * 140 / 6) * Math.PI / 180;
    return [L.cx + L.rx * .84 * Math.cos(a), L.cy + L.ry * .84 * Math.sin(a)];
  });
  const lw = d.logoSize,
    lh = d.logoSize * .5;
  const ly = d.logoPos === 'dealer' ? L.cy + 24 : L.cy + L.ry * .26 - lh / 2;
  const H = L.cy + L.ry + 30;
  return <svg viewBox={`0 0 1000 ${H}`} role="img" aria-label="Table preview" style={{
    display: 'block',
    width: '100%',
    height: 'auto'
  }}>
    <defs>
      <filter id={'tint-' + uid}><feFlood floodColor={d.print} /><feComposite in2="SourceAlpha" operator="in" /></filter>
      {[.62, .555, .5].map((k, i) => <path key={i} id={`arc${i}-${uid}`} d={arc(k)} />)}
    </defs>
    {L.rail && <path d={L.path} fill="none" stroke={d.rail} strokeWidth="34" strokeLinejoin="round" />}
    <path d={L.path} fill={d.felt} />
    <path d={arc(.7)} fill="none" stroke={d.print} strokeWidth="2" opacity=".55" />
    <text fill={d.print} fontFamily="Space Grotesk, sans-serif" fontWeight="600" fontSize="30" letterSpacing="5"><textPath href={`#arc0-${uid}`} startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
    <text fill={d.print} fontFamily="Inter, sans-serif" fontSize="17" letterSpacing="2" opacity=".9"><textPath href={`#arc1-${uid}`} startOffset="50%" textAnchor="middle">Dealer stands on all 17s</textPath></text>
    <text fill={d.print} fontFamily="Space Grotesk, sans-serif" fontWeight="500" fontSize="20" letterSpacing="4"><textPath href={`#arc2-${uid}`} startOffset="50%" textAnchor="middle">INSURANCE PAYS 2 TO 1</textPath></text>
    {d.logo ? <image href={d.logo} x={500 - lw / 2} y={ly} width={lw} height={lh} preserveAspectRatio="xMidYMid meet" filter={d.logoTint ? `url(#tint-${uid})` : undefined} /> : <g opacity=".7"><rect x={500 - lw / 2} y={ly} width={lw} height={lh} rx="6" fill="none" stroke={d.print} strokeWidth="2" strokeDasharray="8 6" /><text x="500" y={ly + lh / 2 + 6} textAnchor="middle" fill={d.print} fontFamily="Inter, sans-serif" fontSize="17">{brandLabel ? brandLabel + ' logo' : 'Brand logo'}</text></g>}
    {!noSeats && seats.map(([x, y], i) => <g key={i}>
      <circle cx={x} cy={y} r="34" fill="none" stroke={d.print} strokeWidth="2.5" />
      <text x={x} y={y + 7} textAnchor="middle" fill={d.print} fontFamily="JetBrains Mono, monospace" fontSize="20">{i + 1}</text>
    </g>)}
  </svg>;
}
function ColorMap({
  value,
  onChange,
  label
}) {
  const [hsv, setHsv] = React.useState(() => rgbToHsv(hexToRgb(value)));
  const [txt, setTxt] = React.useState(value);
  const last = React.useRef(value),
    box = React.useRef(null);
  React.useEffect(() => {
    setTxt(value);
    if (value !== last.current) {
      setHsv(rgbToHsv(hexToRgb(value)));
      last.current = value;
    }
  }, [value]);
  const emit = n => {
    setHsv(n);
    const hx = rgbToHex(...hsvToRgb(...n));
    last.current = hx;
    onChange(hx);
  };
  const clamp = x => Math.min(1, Math.max(0, x));
  const pick = e => {
    const r = box.current.getBoundingClientRect();
    emit([hsv[0], clamp((e.clientX - r.left) / r.width), 1 - clamp((e.clientY - r.top) / r.height)]);
  };
  const key = e => {
    const st = {
      ArrowLeft: [-.02, 0],
      ArrowRight: [.02, 0],
      ArrowUp: [0, .02],
      ArrowDown: [0, -.02]
    }[e.key];
    if (st) {
      e.preventDefault();
      emit([hsv[0], clamp(hsv[1] + st[0]), clamp(hsv[2] + st[1])]);
    }
  };
  return <div className="cmap">
    <div ref={box} className="cmap-sv" tabIndex="0" role="slider" aria-label={label + ' saturation and brightness'} aria-valuetext={value} style={{
      background: `hsl(${hsv[0]} 100% 50%)`
    }} onPointerDown={e => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pick(e);
    }} onPointerMove={e => {
      if (e.buttons) pick(e);
    }} onKeyDown={key}>
      <div className="cmap-w"></div><div className="cmap-b"></div>
      <span className="cmap-dot" style={{
        left: hsv[1] * 100 + '%',
        top: (1 - hsv[2]) * 100 + '%',
        background: value
      }}></span>
    </div>
    <input className="cmap-hue" type="range" min="0" max="359" value={Math.round(hsv[0])} aria-label={label + ' hue'} onChange={e => emit([+e.target.value, hsv[1], hsv[2]])} />
    <div className="cmap-row">
      <span className="swatch lg" style={{
        background: value
      }}></span>
      <input className="input mono" style={{
        width: 110
      }} value={txt} aria-label={label + ' hex'} onChange={e => {
        const v = e.target.value.toUpperCase();
        setTxt(v);
        if (/^#?[0-9A-F]{6}$/.test(v)) onChange(v[0] === '#' ? v : '#' + v);
      }} />
      <span className="muted" style={{
        fontSize: 12.5
      }}>Drag in the map or type a hex code</span>
    </div>
  </div>;
}
function LayoutThumb({
  id,
  on
}) {
  const L = TD_LAYOUTS[id];
  return <svg viewBox={`0 0 1000 ${L.cy + L.ry + 30}`} width="72" aria-hidden="true"><path d={L.path} fill={on ? 'var(--ink)' : 'var(--off2)'} stroke={L.rail ? on ? 'var(--ink)' : 'var(--steel)' : 'none'} strokeWidth="30" /></svg>;
}
function PublishModal({
  brand,
  current,
  onClose,
  onConfirm
}) {
  const B = runtime.data;
  const eligible = [...B.tables.filter(t => t.brands.includes(brand)), ...settingRead('tableDrafts', []).filter(t => t.brands.includes(brand))];
  const [sel, setSel] = React.useState(current);
  return <Modal open title={'Apply local table preview design · ' + brandName(brand)} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => onConfirm(sel)}>Publish preview profile</button></>}>
    <p style={{
      margin: '0 0 14px'
    }}>{brandName(brand)} design profile is kept in this tab only. Live table presentation is not changed by this workspace.</p>
    <div className="opts">{eligible.map(t => {
        const bj = t.game === 'Blackjack',
          on = sel.includes(t.id),
          shared = t.brands.filter(x => x !== brand);
        return <label key={t.id} className={'opt' + (on ? ' on' : '') + (bj ? '' : ' dis')} style={{
          height: 'auto',
          minHeight: 48,
          padding: '8px 12px'
        }}>
        <input type="checkbox" disabled={!bj} checked={on} onChange={() => setSel(s => on ? s.filter(x => x !== t.id) : [...s, t.id])} />
        <span style={{
            display: 'grid'
          }}><span><b style={{
                fontWeight: 600
              }}>{t.name}</b> <span className="mono muted">{t.id}</span></span>
          <span className="muted" style={{
              fontSize: 12.5
            }}>{!bj ? t.game + ' tables need their own layout' : shared.length ? 'Shared with ' + shared.map(brandName).join(', ') : 'Only ' + brandName(brand)}</span></span>
        <span style={{
            marginLeft: 'auto'
          }}><Badge status={t.status} /></span>
      </label>;
      })}</div>
  </Modal>;
}
function TableDesign({
  brand: scope,
  toast
}) {
  const [all, setAll] = React.useState(loadDesigns);
  const [brand, setBrand] = React.useState(scope === 'all' ? 'scout' : scope);
  const [target, setTarget] = React.useState('felt');
  const [pub, setPub] = React.useState(false),
    [src, setSrc] = React.useState('custom'),
    [book, setBook] = React.useState(null),
    [bookBusy, setBookBusy] = React.useState(false);
  const fileRef = React.useRef(null);
  React.useEffect(() => {
    if (scope !== 'all') setBrand(scope);
  }, [scope]);
  const cur = all[brand],
    d = cur.draft;
  const dirty = JSON.stringify(d) !== JSON.stringify(cur.published);
  const commit = next => {
    setAll(next);
    if (!saveDesigns(next)) toast('Could not save. The logo file may be too large.');
  };
  const set = patch => commit({
    ...all,
    [brand]: {
      ...cur,
      draft: {
        ...d,
        ...patch
      }
    }
  });
  React.useEffect(() => {
    if (!d.logo || d.logoChecked) return;
    tdPrepLogo(d.logo).then(o => set({
      logo: o.src,
      logoOrig: o.removed ? d.logo : d.logoOrig || null,
      logoTint: o.opaque && !o.removed ? false : d.logoTint,
      logoChecked: true
    }));
  }, [brand, d.logo]);
  const L = TD_LAYOUTS[d.layout];
  if (target === 'rail' && !L.rail) setTimeout(() => setTarget('felt'));
  const cr = contrast(d.felt, d.print);
  const crS = cr >= 4.5 ? ['live', 'Easy to read'] : cr >= 3 ? ['warning', 'Readable at large sizes only'] : ['error', 'Too low. Print will be hard to read'];
  const autoPrint = () => set({
    print: lum(d.felt) > 0.18 ? '#1D1F22' : '#F2F1ED'
  });
  const upload = async f => {
    if (!f) return;
    try {
      const src = await imageFile(f),
        out = await tdPrepLogo(src);
      set({
        logoChecked: true,
        logo: out.src,
        logoOrig: out.removed ? src : null,
        logoTint: out.opaque && !out.removed ? false : d.logoTint
      });
      toast(out.removed ? 'Logo added; background removed.' : 'Logo added to the table.');
    } catch (e) {
      notifyError(e);
    }
  };
  const TGT = [['felt', 'Felt'], ['rail', 'Rail'], ['print', 'Print & lines']];
  const tdFromTheme = t => {
    const felt = th.lum(t.surface) < .03 ? th.mix(t.surface, t.primary, .22) : t.surface;
    return {
      felt,
      rail: th.mix(t.surface, '#000000', .35),
      print: th.cr(felt, t.text) >= 4.5 ? t.text : th.on(felt)
    };
  };
  const theme = typeof thLoad === 'function' ? (thLoad()[brand] || {}).draft : null;
  const themeSug = theme ? tdFromTheme(theme) : null;
  const readBook = async f => {
    if (!f) return;
    setBookBusy(true);
    try {
      const r = await thReadBook(f);
      const pal = thPalette(r.canvases),
        ro = thRoles(pal);
      setBook({
        name: f.name,
        pages: r.pages,
        thumbs: r.canvases.slice(0, 4).map(c => c.toDataURL('image/jpeg', .7)),
        pal,
        pick: tdFromTheme({
          surface: ro.surface,
          primary: ro.primary,
          text: ro.text
        })
      });
    } catch (e) {
      toast('Could not read the file. Try a PNG, JPG or WebP · PDF not connected.');
    }
    setBookBusy(false);
  };
  const Sw = ({
    c,
    l
  }) => <span className="td-sug"><i style={{
      background: c
    }}></i><span><b>{l}</b><small className="mono">{c}</small></span></span>;
  return <>
    <header className="page-h">
      <div><h1>Table design</h1><div className="muted" style={{
          fontSize: 13
        }}>Felt colours, layout and logo that players see. Each brand has its own design, also on shared tables.</div></div>
      <div className="td-actions">
        {dirty ? <Badge status="warning">Local changes</Badge> : <Badge status="live">Local preview</Badge>}
        <button className="btn" disabled={!dirty} onClick={() => {
          commit({
            ...all,
            [brand]: {
              ...cur,
              draft: {
                ...cur.published
              }
            }
          });
          toast('Changes discarded');
        }}>Discard changes</button>
        <button className="btn primary" onClick={() => setPub(true)}>Apply locally</button>
      </div>
    </header>
    <div className="page-b">
      <div className="td-grid">
        <section className="panel">
          <div className="panel-h wrap">
            <div className="field" style={{
              minWidth: 220
            }}><label htmlFor="td-brand">Brand</label><select id="td-brand" className="select" value={brand} onChange={e => setBrand(e.target.value)}>{runtime.data.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="field" style={{
              flex: 1,
              minWidth: 200
            }}><label htmlFor="td-name">Design name</label><input id="td-name" className="input" value={d.name} onChange={e => set({
                name: e.target.value
              })} /></div>
          </div>
          <div className="td-stage"><TableSVG d={d} uid="main" brandLabel={brandName(brand)} /></div>
          <div className="note td-used">Preview assignments: <b>{cur.tables.length ? cur.tables.map(id => runtime.data.tables.find(t => t.id === id)?.name || settingRead('tableDrafts', []).find(t => t.id === id)?.name || id).join(', ') : 'no tables'}</b>. Apply stores this draft in this tab only. It is not published to any game. <a href="#test">Try it in Dealer test</a></div>
        </section>

        <section className="panel td-ctrl">
          <div className="td-sec"><h3>Start from</h3>
            <div className="seg" style={{
              flexWrap: 'wrap',
              maxWidth: '100%'
            }}>{[['custom', 'Choose colours myself'], ['theme', 'Colours, chips & cards'], ['book', 'Brand book']].map(([k, l]) => <button key={k} className={src === k ? 'on' : ''} onClick={() => setSrc(k)}>{l}</button>)}</div>
            {src === 'theme' && <div className="td-from">{themeSug ? <><p className="muted" style={{
                  margin: 0,
                  fontSize: 13
                }}>Uses the {brandName(brand)} colours set in <a href="#theme">Colours, chips & cards</a>: felt from the dock surface and main action, print in the text colour.</p>
              <div className="td-sugs"><Sw c={themeSug.felt} l="Felt" /><Sw c={themeSug.rail} l="Rail" /><Sw c={themeSug.print} l="Print" /></div>
              <div style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap'
                }}><button className="btn primary sm" onClick={() => {
                    set({
                      ...themeSug,
                      ...(theme.logo && !d.logo ? {
                        logo: theme.logo,
                        logoChecked: false
                      } : {})
                    });
                    toast('Table colours taken from Colours, chips & cards');
                  }}>Apply to table</button>{theme.logo && <span className="muted" style={{
                    fontSize: 12.5,
                    alignSelf: 'center'
                  }}>{d.logo ? 'Your table logo is kept.' : 'The brand logo is added too.'}</span>}</div></> : <p className="muted">No brand theme set yet.</p>}</div>}
            {src === 'book' && <div className="td-from">
              <label className="th-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readBook(e.target.files[0])} /><b>{bookBusy ? 'Reading brand book…' : book ? 'Upload another brand book' : 'Upload brand book'}</b><span>PNG, JPG or WebP · PDF not connected. We suggest felt, rail and print colours from it.</span></label>
              {book && <><div className="th-thumbs">{book.thumbs.map((s, i) => <img key={i} src={assetUrl(s)} alt={'Page ' + (i + 1)} />)}</div><div className="muted" style={{
                  fontSize: 12.5
                }}>{book.name} · {book.pal.length} colours found</div>
                <div className="th-roles">{[['felt', 'Felt'], ['rail', 'Rail'], ['print', 'Print']].map(([k, l]) => <div key={k}><span className="th-sw" style={{
                      background: book.pick[k]
                    }}></span><span>{l}</span><select className="select" value={book.pick[k]} onChange={e => setBook({
                      ...book,
                      pick: {
                        ...book.pick,
                        [k]: e.target.value
                      }
                    })}>{[...new Set([book.pick[k], ...book.pal.map(p => p.hex)])].map(h => <option key={h} value={h}>{h}</option>)}</select></div>)}</div>
                <div style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}><button className="btn primary sm" onClick={() => {
                    set(book.pick);
                    toast('Brand book colours applied to the table');
                  }}>Apply to table</button>{contrast(book.pick.felt, book.pick.print) < 4.5 && <span className="row-issue is-warning">Print is hard to read on this felt</span>}</div></>}
            </div>}
            {src === 'custom' && <p className="muted" style={{
              margin: '8px 0 0',
              fontSize: 13
            }}>Pick layout, colours and logo below.</p>}
          </div>
          <div className="td-sec"><h3>Layout</h3>
            <div className="td-layouts">{Object.entries(TD_LAYOUTS).map(([k, x]) => <button key={k} className={'td-lay' + (d.layout === k ? ' on' : '')} aria-pressed={d.layout === k} onClick={() => set({
                layout: k
              })}>
              <LayoutThumb id={k} on={d.layout === k} /><b>{x.label}</b><span className="muted">{x.note}</span></button>)}</div>
          </div>
          <div className="td-sec"><h3>Colours</h3>
            <div className="td-targets">{TGT.map(([k, l]) => {
                const dis = k === 'rail' && !L.rail;
                return <button key={k} className={'td-tgt' + (target === k ? ' on' : '')} disabled={dis} aria-pressed={target === k} onClick={() => setTarget(k)} title={dis ? 'This layout has no rail' : ''}>
              <span className="swatch" style={{
                    background: d[k]
                  }}></span><span><b>{l}</b><span className="mono muted">{dis ? 'No rail' : d[k]}</span></span></button>;
              })}</div>
            <ColorMap value={d[target]} label={TGT.find(t => t[0] === target)[1]} onChange={v => set({
              [target]: v
            })} />
            <div className="td-cr"><Badge status={crS[0]}>{cr.toFixed(1)}:1</Badge><span style={{
                fontSize: 13
              }}>{crS[1]}</span>{cr < 4.5 && <button className="btn sm" style={{
                marginLeft: 'auto'
              }} onClick={autoPrint}>Fix print colour</button>}</div>
            <div className="field" style={{
              marginTop: 14
            }}><label>Starting points</label>
              <div className="td-presets">{TD_PRESETS.map(p => <button key={p.name} className="td-pre" title={p.name} onClick={() => set({
                  felt: p.felt,
                  rail: p.rail,
                  print: p.print
                })}><span className="swatch" style={{
                    background: p.felt,
                    boxShadow: `inset 0 0 0 3px ${p.rail}`
                  }}></span><span>{p.name}</span></button>)}</div>
            </div>
          </div>
          <div className="td-sec"><h3>Logo</h3>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={e => {
              upload(e.target.files[0]);
              e.target.value = '';
            }} />
            {d.logo ? <div className="td-logo"><div className="td-logo-img" style={{
                background: d.felt
              }}><img src={assetUrl(d.logo)} alt={brandName(brand) + ' logo'} /></div>
              <div style={{
                display: 'flex',
                gap: 8
              }}><button className="btn sm" onClick={() => fileRef.current.click()}>Replace</button><button className="btn sm ghost" onClick={() => set({
                  logo: null
                })}>Remove</button></div></div> : <button className="td-drop" onClick={() => fileRef.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => {
              e.preventDefault();
              upload(e.dataTransfer.files[0]);
            }}>
                <b>Upload {brandName(brand)} logo</b><span className="muted">Drop a file or click. SVG or PNG with transparent background, max 1.5 MB.</span></button>}
            <div className="field" style={{
              marginTop: 14
            }}><label htmlFor="td-size">Size <span className="mono muted" style={{
                  fontWeight: 400
                }}>{d.logoSize} px</span></label><input id="td-size" type="range" min="80" max="320" step="10" value={d.logoSize} onChange={e => set({
                logoSize: +e.target.value
              })} className="td-range" /></div>
            <div className="field" style={{
              marginTop: 12
            }}><label>Position</label><div className="seg">{[['center', 'Centre'], ['dealer', 'Near dealer']].map(([k, l]) => <button key={k} className={d.logoPos === k ? 'on' : ''} onClick={() => set({
                  logoPos: k
                })}>{l}</button>)}</div></div>
            {d.logoOrig && <label className="chk" style={{
              marginTop: 12
            }}><input type="checkbox" checked={d.logo !== d.logoOrig} onChange={async e => {
                if (e.target.checked) {
                  const o = await tdPrepLogo(d.logoOrig);
                  set({
                    logo: o.src
                  });
                } else set({
                  logo: d.logoOrig,
                  logoTint: false
                });
              }} />Remove the logo’s background</label>}
            <label className="chk" style={{
              marginTop: 12
            }}><input type="checkbox" checked={d.logoTint} disabled={!!d.logo && d.logo === d.logoOrig} onChange={e => set({
                logoTint: e.target.checked
              })} />Print logo in the print colour <span className="muted">· needs a transparent background</span></label>
          </div>
        </section>
      </div>
    </div>
    {pub && <PublishModal brand={brand} current={cur.tables} onClose={() => setPub(false)} onConfirm={async sel => {
      try {
        const next = {
          ...all,
          [brand]: {
            ...cur,
            published: {
              ...d
            },
            tables: sel
          }
        };
        runtime.designStore.write('tables', next);
        await runtime.designStore.save('tables');
        setAll(next);
        setPub(false);
        toast('Local preview updated for ' + brandName(brand));
      } catch (e) {
        notifyError(e);
      }
    }} />}
  </>;
}

// Source: v-live.jsx at 7dee0901; see source-provenance.json.
const D2 = runtime.data2;
const dealerN = k => ({
  vera: 'Vera',
  astrid: 'Astrid',
  amira: 'Amira',
  mei: 'Mei'
})[k] || k;
const portrait = k => '/bo/img/' + k + '-portrait.jpg';
const STATE_B = {
  live: ['live', 'Live'],
  preview: ['paused', 'Preview'],
  pending: ['closed', 'Pending']
};
function PageH({
  title,
  sub,
  right,
  src
}) {
  return <header className="page-h"><div style={{
      display: 'grid',
      gap: 6
    }}><h1>{title}</h1>{sub && <div className="muted" style={{
        fontSize: 13,
        maxWidth: 720
      }}>{sub}</div>}</div>{right}</header>;
}
function LegacyNote({
  children
}) {
  return <div className="legacy-note"><Badge status="closed">Legacy</Badge><div><b>Old game data</b>{children}</div></div>;
}
function useJson(path) {
  return runtime.catalogs[path] || {
    error: true
  };
}
function Confirm({
  state,
  onClose
}) {
  if (!state) return null;
  return <Modal open title={state.title} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={'btn ' + (state.danger ? 'danger' : 'primary')} onClick={() => {
      state.ok();
      onClose();
    }}>{state.cta}</button></>}>
    <p style={{
      margin: 0
    }}>{state.body}</p></Modal>;
}
function TablesRooms({
  toast,
  tables = []
}) {
  const [rooms, setRooms] = React.useState(D2.rooms);
  const [confirm, setConfirm] = React.useState(null);
  const flip = r => {
    const next = r.state === 'live' ? 'preview' : 'live';
    setConfirm({
      title: (next === 'live' ? 'Go live · ' : 'Set to preview · ') + r.name,
      body: next === 'live' ? 'Players on every brand that offers this room can join its tables.' : 'Players can no longer join. Rounds in progress finish first.',
      cta: next === 'live' ? 'Go live' : 'Set preview',
      ok: () => {
        setRooms(rs => rs.map(x => x.id === r.id ? {
          ...x,
          state: next
        } : x));
        toast(r.name + ' → ' + (next === 'live' ? 'Live' : 'Preview'));
      }
    });
  };
  return <>
    <PageH title="Tables & Rooms" sub="Rooms, the dealer seated in each, table tiers and house rules." src={assetUrl("bo.mjs \xB7 rooms \xB7 server.mjs BO_DEFAULTS")} right={<button className="btn primary" disabled title="Legacy rooms are read only">Add room</button>} />
    <div className="page-b">
      <LegacyNote>The current BO reads these rooms from the old game and has every control disabled. The Astrid shared game has one table today. Archived room controls do not change the Astrid shared game.</LegacyNote>
      <div className="grid-cards">{rooms.map(r => {
          const [bs, bl] = STATE_B[r.state];
          const rt = tables.filter(t => t.room === r.name);
          return <article key={r.id} className="vcard">
        <div className="vcard-img"><img src={assetUrl(r.img)} alt={r.name} /><Badge status={bs}>{bl}</Badge></div>
        <div className="vcard-b">
          <div className="who-row"><img className="pic" src={assetUrl(portrait(r.dealer))} alt="" /><div><h3>{r.name}</h3><div className="muted" style={{
                    fontSize: 12.5
                  }}>{dealerN(r.dealer)} deals here</div></div></div>
          <dl className="dl"><dt>Scene</dt><dd>{r.scene}</dd><dt>Felt</dt><dd>{r.felt}</dd><dt>Tiers</dt><dd>{D2.tiers.filter(t => t.dealer === r.dealer).map(t => t.name).join(' · ') || '—'}</dd><dt>Tables</dt><dd>{rt.length ? rt.map(t => t.name).join(', ') : '—'}</dd></dl>
        </div>
        <div className="vcard-f"><button className="btn sm" onClick={() => location.hash = 'test'}>Open table</button><button className="btn sm" onClick={() => location.hash = 'dealers'}>Seat dealer</button><button className={'btn sm' + (r.state === 'live' ? '' : ' primary')} style={{
                marginLeft: 'auto'
              }} disabled title="Legacy room state does not control Astrid">{r.state === 'live' ? 'Set preview' : 'Go live'}</button></div>
      </article>;
        })}</div>
      <div className="two">
        <section className="panel"><div className="panel-h"><h2>House rules</h2><span className="muted" style={{
              fontSize: 12.5
            }}>All tables</span></div><div className="rows">{D2.rules.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}</div></section>
        <section className="panel"><div className="panel-h"><h2>Tier limits</h2></div><table className="tbl"><thead><tr><th>Tier</th><th>Limits per box</th><th>Dealer</th></tr></thead>
          <tbody>{D2.tiers.map(t => <tr key={t.id}><td><b style={{
                    fontWeight: 600
                  }}>{t.name}</b></td><td className="mono">{t.limits}</td><td><div className="who-row"><img className="pic" style={{
                      width: 24,
                      height: 24
                    }} src={assetUrl(portrait(t.dealer))} alt="" />{dealerN(t.dealer)}</div></td></tr>)}</tbody></table>
          <div className="note">Default in the old game: every tier is dealt by Vera.</div></section>
      </div>
    </div>
    <Confirm state={confirm} onClose={() => setConfirm(null)} />
  </>;
}
function PitBosses({
  toast
}) {
  const [tr, setTr] = React.useState(D2.pit.triggers);
  const flip = k => unavailable('Legacy pit boss triggers');
  return <>
    <PageH title="Pit Bosses" sub="Supervisors who walk on to the table when something unusual happens." src={assetUrl("bo.mjs \xB7 pit \xB7 server.mjs pitboss")} />
    <div className="page-b">
      <LegacyNote>Pit bosses belong to the old game. Controls are disabled in the current BO.</LegacyNote>
      <div className="two">
        <section className="panel"><div className="panel-h"><h2>Supervisors</h2><button className="btn sm" disabled title="Legacy pit bosses are not active in Astrid">Assign rooms</button></div>
          <div className="scroll-x"><table className="tbl pit-tbl"><thead><tr><th>Pit boss</th><th>Model</th><th>Rooms</th><th>Status</th></tr></thead>
            <tbody>{D2.pit.bosses.map(b => <tr key={b.name}><td><b style={{
                      fontWeight: 600
                    }}>{b.name}</b></td><td className="mono muted">{b.model}</td><td>{b.rooms}</td><td><Badge status={b.state === 'live' ? 'live' : 'closed'}>{b.state === 'live' ? 'Active' : 'Pending'}</Badge></td></tr>)}</tbody></table></div></section>
        <section className="panel"><div className="panel-h"><h2>Walk-on triggers</h2></div>
          <div className="rows">
            <div><span style={{
                color: 'var(--ink)'
              }}>Payout above 10× stake</span><button className={'toggle' + (tr.payout10x ? ' on' : '')} aria-pressed={tr.payout10x} onClick={() => flip('payout10x')}></button></div>
            <div><span style={{
                color: 'var(--ink)'
              }}>Win streak of 5 rounds or more</span><button className={'toggle' + (tr.streak5 ? ' on' : '')} aria-pressed={tr.streak5} onClick={() => flip('streak5')}></button></div>
            <div><span style={{
                color: 'var(--ink)'
              }}>Random floor walk</span><span style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}>Every <select className="select" value={tr.randomWalkMin} disabled>{[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}</select></span></div>
          </div></section>
      </div>
    </div>
  </>;
}
function Dealers({
  toast
}) {
  const cat = useJson('/bo/jakob-catalog.json');
  const ev = cat && cat.project ? cat.project.events.length : '…',
    fam = cat && cat.families ? cat.families.length : '…',
    items = cat && cat.items ? cat.items.length : '…';
  return <>
    <PageH title="Dealers" sub="Which dealer runs which table, and what each one is ready for." src={assetUrl("bo.mjs \xB7 dealers (Dealer & direction)")} right={<a className="btn primary" href="#test" style={{
      textDecoration: 'none'
    }}>Test a dealer</a>} />
    <div className="page-b">
      <section className="panel">
        <div className="vcard-b" style={{
          gridTemplateColumns: 'auto minmax(0,1fr)',
          alignItems: 'start',
          gap: 20,
          padding: 20
        }}>
          <img src={assetUrl("/bo/img/astrid-portrait.jpg")} alt="Astrid" style={{
            width: 120,
            height: 150,
            objectFit: 'cover',
            borderRadius: 6
          }} />
          <div style={{
            display: 'grid',
            gap: 12
          }}>
            <div style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}><h3 style={{
                fontSize: 22
              }}>Astrid</h3><Badge status="live">Shared game</Badge><span className="muted" style={{
                fontSize: 13
              }}>Privé Blackjack · $5–$2,000</span></div>
            <p style={{
              margin: 0,
              maxWidth: 680,
              fontSize: 13.5
            }}>The game server owns the shoe, random draws, rules and payouts. Dealer clips and speech present server events. Jakob's event catalog and Emil's source clips are imported with pinned GitLab references. An imported asset is not automatically a live assignment.</p>
            <div className="metrics4" style={{
              maxWidth: 760
            }}>
              <div className="metric"><span>Catalog events</span><b>{ev}</b></div><div className="metric"><span>Media families</span><b>{fam}</b></div><div className="metric"><span>Media entries</span><b>{items}</b></div><div className="metric"><span>Voice lines</span><b>51</b></div>
            </div>
            <dl className="dl"><dt>Voice</dt><dd>Cartesia sonic-3.5 · Freja – Informative Host</dd><dt>Format</dt><dd>1080 × 1920, 24 fps, H.264 BT.709. Every clip starts and ends on the same still frame.</dd><dt>Presentation</dt><dd>OpenClaw direction. Production activation and full speech/video acceptance are not verified.</dd></dl>
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap'
            }}><a className="btn sm" href="#tree" style={{
                textDecoration: 'none'
              }}>Actions and connected clips</a><a className="btn sm" href="#media" style={{
                textDecoration: 'none'
              }}>Runtime media</a><a className="btn sm" href="#voice" style={{
                textDecoration: 'none'
              }}>Voice lines</a></div>
          </div>
        </div>
      </section>
      <section className="panel"><div className="panel-h"><h2>Other dealers</h2><a href="#archive">Dealer archive →</a></div>
        <table className="tbl"><thead><tr><th>Dealer</th><th>Room</th><th>Voice</th><th>Gameplay clips</th><th>Status</th></tr></thead>
          <tbody>{D2.archive.filter(d => d.key !== 'astrid').map(d => <tr key={d.key}><td><div className="who-row"><img className="pic" src={assetUrl(portrait(d.key))} alt="" /><b style={{
                    fontWeight: 600
                  }}>{d.name}</b></div></td><td>{d.room}</td><td className="muted">{d.voice}</td><td><span className="mono">0</span> <span className="muted">of 33</span></td><td><Badge status="closed">Legacy · training</Badge></td></tr>)}</tbody></table>
        <div className="note">Earlier dealer models are retained for training. They do not describe the current shared game.</div></section>
    </div>
  </>;
}
function DealerArchive({
  toast
}) {
  return <>
    <PageH title="Dealer archive" sub="Previous dealer models, their clips and the tier each one served." src={assetUrl("bo.mjs \xB7 legacy-dealers")} />
    <div className="page-b">
      <LegacyNote>Archived models and prototype data. Tier assignment is read-only.</LegacyNote>
      <div className="grid-cards">{D2.archive.map(d => {
          const pct = Math.min(100, Math.round(d.speak / d.full * 100));
          return <article key={d.key} className="vcard">
        <div className="vcard-img" style={{
              aspectRatio: '16/10'
            }}><img src={assetUrl(portrait(d.key))} alt={d.name} /><Badge status="closed">Training only</Badge></div>
        <div className="vcard-b"><h3>{d.name}</h3>
          <dl className="dl"><dt>Room</dt><dd>{d.room}</dd><dt>Clips</dt><dd className="mono">{d.clips} ({d.speak} speech)</dd><dt>Voice</dt><dd>{d.voice}</dd></dl>
          <div style={{
                display: 'grid',
                gap: 4
              }}><div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5
                }}><span className="muted">Speech lines</span><span className="mono">{d.speak}/{d.full}</span></div><div className="bar"><i style={{
                    width: pct + '%'
                  }}></i></div></div>
        </div></article>;
        })}</div>
      <section className="panel"><div className="panel-h"><h2>Tier assignments</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Not the Astrid shared game</span></div>
        <table className="tbl"><thead><tr><th>Tier</th><th>Limits</th>{D2.archive.map(d => <th key={d.key}>{d.name}</th>)}</tr></thead>
          <tbody>{D2.tiers.map(t => <tr key={t.id}><td><b style={{
                  fontWeight: 600
                }}>{t.name}</b></td><td className="mono">{t.limits}</td>{D2.archive.map(d => <td key={d.key}>{t.dealer === d.key ? <Badge status="live">Assigned</Badge> : d.clips ? <span className="muted">—</span> : <span className="muted">Needs clips</span>}</td>)}</tr>)}</tbody></table>
        <div className="note">A dealer brings her own room. A new dealer and room combination needs a generation pass.</div></section>
    </div>
  </>;
}
function Shoes({
  toast,
  brand = 'all'
}) {
  const [sel, setSel] = React.useState(null),
    [proof, setProof] = React.useState(null),
    [room, setRoom] = React.useState('all'),
    [proofError, setProofError] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;
    setProof(null);
    setProofError('');
    if (sel?.closed_at) api('/api/bo/game-audit?room=' + encodeURIComponent(sel.room) + '&shoeId=' + encodeURIComponent(sel.id)).then(p => {
      if (!cancelled) setProof(p);
    }).catch(e => {
      if (!cancelled) setProofError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [sel]);
  const S = D2.shoes.filter(s => (brand === 'all' || brand === 'scout') && (room === 'all' || s.room === room)),
    active = S.find(s => s.status === 'active');
  const VB = {
    active: ['live', 'In play'],
    verified: ['live', 'Verified'],
    failed: ['error', 'Failed'],
    incomplete: ['warning', 'Incomplete']
  };
  return <>
    <PageH title="Shoes & Decks" sub="Every card accounted for. 8 decks × 52 cards = 416. One burn. Cut at draw 312. The hand in progress finishes, then unused cards are retired and a new shoe opens." src={assetUrl("game-audit.mjs \xB7 shoes")} right={<div className="filters"><select className="select" value={room} onChange={e => setRoom(e.target.value)} aria-label="Table"><option value="all">All tables</option>{runtime.data.tables.filter(t => brand === 'all' || t.brands.includes(brand)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn" onClick={() => runtime.refresh()}>Refresh</button></div>} />
    <div className="page-b">
      <div className="metrics4">
        <div className="metric lead"><span>Active shoe</span><b>{active?.id ?? 'No active shoe'}</b></div>
        <div className="metric"><span>Cards consumed</span><b>{active?.dealt ?? 0} <em className="muted" style={{
              fontStyle: 'normal',
              fontSize: 14
            }}>of 416</em></b><div className="bar"><i style={{
              width: Math.min(100, (active?.dealt ?? 0) / 312 * 100) + '%'
            }}></i></div></div>
        <div className="metric"><span>Until cut card</span><b>{active ? Math.max(0, 312 - active.dealt) : '—'}</b></div>
        <div className="metric"><span>Verified shoes</span><b>{S.filter(s => s.status === 'verified').length}</b></div>
        <div className="metric"><span>Need review</span><b className={S.some(s => s.status === 'failed') ? 'neg' : ''}>{S.filter(s => s.status === 'failed' || s.status === 'incomplete').length}</b></div>
      </div>
      <section className="panel"><div className="panel-h"><h2>Shoes</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Click a shoe for its proof</span></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Shoe</th><th>First captured</th><th>Verification</th><th>Card accounting</th><th>SHA-256 opening commitment</th><th></th></tr></thead>
          <tbody>{S.map(s => {
                const [b, l] = VB[s.status];
                const retired = s.status === 'active' ? null : s.remaining;
                return <tr key={s.id} className="click" onClick={() => setSel(s)}>
            <td className="mono">{s.id}</td><td className="mono muted">{s.first}</td><td><Badge status={b}>{l}</Badge>{s.fail && <div className={'row-issue ' + (s.status === 'failed' ? 'is-error' : 'is-warning')}>{s.fail}</div>}</td>
            <td className="mono">{s.status === 'active' ? s.dealt + ' consumed (incl. burn) · ' + (416 - s.dealt) + ' in shoe' : s.dealt + ' consumed (incl. burn) · ' + retired + ' retired'}</td>
            <td className="hash">{s.commit ? s.commit + '…' : '—'}</td><td><button className="btn sm" onClick={e => {
                      e.stopPropagation();
                      setSel(s);
                    }}>Evidence</button></td></tr>;
              })}</tbody></table></div>
        <div className="note">Verification replays recorded random samples and reconciles the action log. It is not independent RNG certification. Future cards stay private until the shoe is retired.</div></section>
    </div>
    <Drawer open={!!sel} onClose={() => setSel(null)} width={520}>{sel && <>
      <div className="dr-h"><div><div className="muted" style={{
              fontSize: 12.5
            }}>{sel.closed_at ? 'Closed shoe' : 'Shoe in play'}</div><h2 className="mono" style={{
              fontFamily: 'var(--mono)'
            }}>{sel.id}</h2></div><button className="btn ghost sm" onClick={() => setSel(null)}>Close</button></div>
      <div className={'dr-issue ' + (sel.status === 'failed' ? 'is-error' : sel.status === 'incomplete' ? 'is-warning' : 'is-live')}>{sel.status === 'active' ? 'Shoe in play. Proof is published when it is retired.' : sel.status === 'verified' ? 'Shuffle replay verified.' : sel.status === 'failed' ? 'Verification failed. ' + sel.fail : 'Historical evidence is incomplete. ' + sel.fail}</div>
      <div className="dr-b">
        <div className="kv"><div><span>First captured</span><b className="mono">{sel.first}</b></div><div><span>Cards consumed</span><b className="mono">{sel.dealt}</b></div><div><span>Burn</span><b className="mono">1</b></div><div><span>Retired unused</span><b className="mono">{sel.status === 'active' ? '—' : 416 - sel.dealt}</b></div></div>
        <h3>Opening commitment</h3><div className="secret">{sel.commit ? sel.commit : 'Not recorded'}</div>
        <h3>Recorded verification</h3>
        {sel.closed_at ? proof ? <><table className="tbl"><tbody>{proof.verification.checks.map((c, i) => <tr key={i}><td>{c.name}</td><td><Badge status={c.pass ? 'live' : 'error'}>{c.pass ? 'Pass' : 'Fail'}</Badge></td></tr>)}</tbody></table><button className="btn" onClick={() => {
              const u = URL.createObjectURL(new Blob([JSON.stringify(proof, null, 2)], {
                  type: 'application/json'
                })),
                a = document.createElement('a');
              a.href = u;
              a.download = 'shoe-' + sel.id + '.json';
              a.click();
              setTimeout(() => URL.revokeObjectURL(u), 1000);
            }}>Download proof</button><details><summary>Card ledger and random samples</summary><pre className="table-facts">{JSON.stringify(proof.proof, null, 2)}</pre></details></> : <p role="status">{proofError || 'Loading recorded proof…'}</p> : <p>Future cards and shuffle samples remain private until the shoe closes.</p>}

      </div></>}</Drawer>
  </>;
}

// Source: v-player.jsx at 7dee0901; see source-provenance.json.
const PV = runtime.data2;
function pvRng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const PV_R = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
  PV_S = ['♠', '♥', '♦', '♣'];
const pvVal = r => r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : +r;
const pvTot = cs => {
  let t = 0,
    a = 0;
  cs.forEach(c => {
    t += pvVal(c.r);
    if (c.r === 'A') a++;
  });
  while (t > 21 && a) {
    t -= 10;
    a--;
  }
  return t;
};
const pvBJ = cs => cs.length === 2 && pvTot(cs) === 21;
const PV_DEV = ['iPhone · Safari', 'Android · Chrome', 'Mac · Safari', 'Windows · Chrome', 'iPad · Safari'];
const PV_CHAT = ['Hi Astrid!', 'What are the limits here?', 'Nice hand', 'Can I split tens?', 'How does 21+3 work?', 'Thanks for the game', 'Unlucky again…', 'Show me your hole card', 'Is the shoe shuffled?', 'Good night'];
function pvHistory(p) {
  const rows = runtime.data2.settlements.filter(r => r.playerId === p.id && r.room === p.room);
  const rounds = rows.map(r => ({
    at: r.at,
    id: r.roundId,
    room: r.room,
    hands: (r.hands ?? []).map(h => ({
      box: h.box + 1,
      cards: h.cards ?? [],
      stake: h.stake,
      doubled: !!h.doubled,
      dec: [],
      res: handOutcome(h),
      ret: h.result ?? 0
    })),
    dealer: [],
    dt: 'Not recorded',
    dbj: false,
    staked: r.stakes,
    pay: r.payouts,
    house: r.house,
    side: (r.hands ?? []).some(h => h.pp || h.tp) ? {
      name: 'Perfect Pairs + 21+3',
      stake: (r.hands ?? []).reduce((n, h) => n + (h.pp ?? 0) + (h.tp ?? 0), 0),
      ret: (r.hands ?? []).reduce((n, h) => n + (h.sideReturn ?? 0), 0)
    } : null
  }));
  const mv = runtime.data2.movements.filter(m => m.playerId === p.id && m.room === p.room).map(m => ({
    ...m,
    round: m.roundId
  }));
  return {
    rounds,
    mv,
    sessions: [],
    chat: [],
    reg: mv.at(-1)?.at ?? null,
    first: rounds.at(-1)?.at ?? null,
    stats: pvStats(rounds),
    opId: 'Not recorded'
  };
}
function pvStats(rounds) {
  const all = rounds.flatMap(r => r.hands);
  const s = {
    rounds: rounds.length,
    hands: all.length,
    staked: rounds.reduce((n, r) => n + r.staked, 0),
    house: rounds.reduce((n, r) => n + r.house, 0),
    bj: all.filter(h => h.res === 'Blackjack').length,
    bust: all.filter(h => h.res === 'Bust').length,
    dbl: all.filter(h => h.doubled).length,
    win: all.filter(h => h.res === 'Win' || h.res === 'Blackjack').length,
    push: all.filter(h => h.res === 'Push').length,
    lose: all.filter(h => h.res === 'Lose' || h.res === 'Bust').length,
    sides: rounds.filter(r => r.side).length,
    sideWins: rounds.filter(r => r.side && r.side.ret).length,
    bigWin: Math.max(0, ...rounds.map(r => r.pay - r.staked)),
    bigLoss: Math.max(0, ...rounds.map(r => r.staked - r.pay))
  };
  s.avg = s.rounds ? s.staked / s.rounds : 0;
  return s;
}
const pvInRange = per => {
  const RG = rpRange(per),
    from = RG.cur[RG.cur.length - 1].d,
    to = RG.cur[0].d;
  return {
    label: RG.label,
    test: ms => {
      const d = new Date(ms).toISOString().slice(0, 10);
      return d >= from && d <= to;
    }
  };
};
const pvT = ms => ms == null ? 'Not recorded' : new Date(ms).toLocaleString('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short'
});
const pvDur = ms => {
  const m = Math.round(ms / 60000);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + m % 60 + ' min';
};
const PvCards = ({
  cs
}) => <span style={{
  display: 'inline-flex',
  gap: 3
}}>{cs.map((c, i) => <span key={i} className={'as-mc' + (c.s === '♥' || c.s === '♦' ? ' red' : '')} style={{
    marginRight: 0
  }}>{c.r}{c.s}</span>)}</span>;
function handOutcome(h) {
  if (h.insured) return 'Includes insurance';
  if (pvTot(h.cards ?? []) > 21) return 'Bust';
  if (h.result === h.stake) return 'Push';
  if (h.result < h.stake) return 'Lose';
  if (h.splitFrom == null && pvBJ(h.cards ?? [])) return 'Blackjack';
  return 'Win';
}
const PV_RB = {
  Win: 'live',
  Blackjack: 'live',
  Push: 'closed',
  Lose: 'error',
  Bust: 'error'
};
function PlayerDetail({
  p,
  onClose,
  onBlock,
  toast,
  per: per0
}) {
  const H0 = React.useMemo(() => p ? pvHistory(p) : null, [p && p.id]);
  const [per, setPer] = React.useState(per0 || {
    k: '30d'
  });
  const IR = pvInRange(per);
  const H = H0 ? {
    ...H0,
    rounds: H0.rounds.filter(r => IR.test(r.at)),
    mv: H0.mv.filter(m => IR.test(m.at)),
    sessions: H0.sessions.filter(s => IR.test(s.start)),
    chat: H0.chat.filter(c => IR.test(c.at))
  } : null;
  if (H) H.stats = pvStats(H.rounds);
  const [tab, setTab] = React.useState('overview'),
    [open, setOpen] = React.useState(null),
    [rf, setRf] = React.useState('all'),
    [notes, setNotes] = React.useState([]),
    [note, setNote] = React.useState('');
  React.useEffect(() => {
    setTab('overview');
    setOpen(null);
    setRf('all');
    setNotes(settingRead('playerNotes', {})[p.room + ':' + p.id] ?? []);
  }, [p && p.id]);
  if (!p) return null;
  const S = H.stats,
    rows = H.rounds.filter(r => rf === 'all' || r.hands.some(h => rf === 'win' ? ['Win', 'Blackjack'].includes(h.res) : rf === 'lose' ? ['Lose', 'Bust'].includes(h.res) : h.res === 'Push'));
  const tabs = [['overview', 'Overview'], ['rounds', 'Rounds', H.rounds.length], ['tx', 'Transactions', H.mv.length], ['sessions', 'Sessions', H.sessions.length], ['chat', 'Chat', H.chat.length], ['notes', 'Notes', notes.length]];
  return <Drawer open onClose={onClose} width={820}>
    <div className="dr-h"><div><div className="muted" style={{
          fontSize: 12.5
        }}>{brandName(p.brand)} · <span className="mono">{p.id}</span></div><h2 style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center'
        }}>{p.name} {p.status === 'online' ? <Badge status="live">Online</Badge> : p.status === 'blocked' ? <Badge status="error">Blocked</Badge> : <Badge status="closed">Offline</Badge>}</h2></div>
      <div style={{
        display: 'flex',
        gap: 6
      }}><button className={'btn sm' + (p.status === 'blocked' ? '' : ' danger')} onClick={() => onBlock(p)}>{p.status === 'blocked' ? 'Unblock' : 'Block player'}</button><button className="btn sm" disabled title="Shared-game top-ups are available in the playable game">Add $1,000 demo</button><button className="btn ghost sm" onClick={onClose}>Close</button></div></div>
    {p.status === 'blocked' && <div className="dr-issue is-error">{p.blockReason}</div>}
    <div style={{
      padding: '12px 24px 0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }}><span className="muted" style={{
        fontSize: 13
      }}>History for</span><RpPeriod p={per} set={setPer} /></div>
    <div style={{
      padding: '8px 24px 0',
      borderBottom: '1px solid var(--rule)',
      display: 'flex',
      gap: 2,
      flexWrap: 'wrap'
    }}>{tabs.map(([k, l, n]) => <button key={k} className={'pv-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>)}</div>
    <div className="dr-b">
      {tab === 'overview' && <>
        <div className="metrics4" style={{
          marginTop: 20
        }}>
          <div className="metric"><span>Balance</span><b>{money(p.balance)}</b></div><div className="metric"><span>House result</span><b className={S.house < 0 ? 'neg' : ''}>{money(S.house, true)}</b></div>
          <div className="metric"><span>Rounds</span><b>{S.rounds}</b></div><div className="metric"><span>Staked</span><b>{money(S.staked)}</b></div>
          <div className="metric"><span>Average stake / round</span><b>{money(S.avg)}</b></div><div className="metric"><span>Hold</span><b>{S.staked ? (S.house / S.staked * 100).toFixed(1) + '%' : '—'}</b></div>
        </div>
        <h3>Profile</h3>
        <div className="kv" style={{
          marginTop: 0
        }}>
          <div><span>Nickname</span><b>{p.name}</b></div><div><span>Player ID</span><b className="mono">{p.id}</b></div>
          <div><span>Operator player ID</span><b className="mono">{H.opId}</b></div><div><span>Brand</span><b>{brandName(p.brand)}</b></div>
          <div><span>Currency</span><b>USD · demo funds</b></div><div><span>First wallet record</span><b className="mono">{pvT(H.reg)}</b></div>
          <div><span>First played</span><b className="mono">{pvT(H.first)}</b></div><div><span>Last seen</span><b>{p.status === 'online' ? 'Online now' : p.last}</b></div>
          <div><span>Current table</span><b>{p.status === 'online' ? 'Privé Blackjack · boxes ' + (H.sessions[0] ? H.sessions[0].boxes : '—') : '—'}</b></div><div><span>Last device</span><b>{H.sessions[0] ? H.sessions[0].device : '—'}</b></div>
        </div>
        <h3>Play</h3>
        <div className="kv" style={{
          marginTop: 0
        }}>
          <div><span>Hands played</span><b className="mono">{S.hands}</b></div><div><span>Won · push · lost</span><b className="mono">{S.win} · {S.push} · {S.lose}</b></div>
          <div><span>Blackjacks</span><b className="mono">{S.bj}</b></div><div><span>Busts</span><b className="mono">{S.bust}</b></div>
          <div><span>Doubles</span><b className="mono">{S.dbl}</b></div><div><span>Side bets won</span><b className="mono">{S.sideWins} of {S.sides}</b></div>
          <div><span>Biggest win</span><b className="mono">{money(S.bigWin)}</b></div><div><span>Biggest loss</span><b className="mono">{money(S.bigLoss)}</b></div>
        </div>
        <h3>Latest rounds</h3>
        <PvRounds rows={H.rounds.slice(0, 5)} open={open} setOpen={setOpen} />
        <button className="btn sm" style={{
          marginTop: 10
        }} onClick={() => setTab('rounds')}>All {H.rounds.length} rounds</button>
      </>}
      {tab === 'rounds' && <>
        <div className="filters" style={{
          margin: '16px 0 10px'
        }}>{[['all', 'All'], ['win', 'Won'], ['push', 'Push'], ['lose', 'Lost']].map(([k, l]) => <button key={k} className={'chip' + (rf === k ? ' on' : '')} onClick={() => setRf(k)}>{l}</button>)}<button className="btn sm" style={{
            marginLeft: 'auto'
          }} onClick={() => downloadRows('player-rounds', ['Round', 'Settled', 'Stake', 'Payout', 'House'], rows.map(r => [r.id, pvT(r.at), r.staked, r.pay, r.house]))}>Export CSV</button></div>
        <PvRounds rows={rows} open={open} setOpen={setOpen} />
      </>}
      {tab === 'tx' && <div className="scroll-x" style={{
        marginTop: 16
      }}><table className="tbl"><thead><tr><th>Time</th><th>Type</th><th>Round</th><th className="num">Change</th><th className="num">Before</th><th className="num">After</th></tr></thead>
        <tbody>{H.mv.map((m, i) => <tr key={i}><td className="mono muted">{pvT(m.at)}</td><td>{PV.kindName[m.kind]}</td><td className="mono">{m.round || '—'}</td><td className={'num mono' + (m.amount < 0 ? ' neg' : '')}>{money(m.amount, true)}</td><td className="num mono muted">{money(m.before)}</td><td className="num mono">{money(m.after)}</td></tr>)}</tbody></table></div>}
      {tab === 'sessions' && <><p className="muted">Historic device and session data are not recorded by this service.</p><div className="scroll-x" style={{
          marginTop: 16
        }}><table className="tbl"><thead><tr><th>Started</th><th className="num">Length</th><th>Boxes</th><th className="num">Rounds</th><th className="num">Staked</th><th className="num">House</th><th>Device</th><th>IP</th></tr></thead>
        <tbody>{H.sessions.map((s, i) => <tr key={i}><td className="mono muted">{pvT(s.start)}</td><td className="num mono">{pvDur(s.end - s.start)}</td><td className="mono">{s.boxes}</td><td className="num mono">{s.rounds}</td><td className="num mono">{money(s.staked)}</td><td className={'num mono' + (s.house < 0 ? ' neg' : '')}>{money(s.house, true)}</td><td>{s.device}</td><td className="mono muted">{s.ip}</td></tr>)}</tbody></table></div></>}
      {tab === 'chat' && (H.chat.length ? <div style={{
        display: 'grid',
        marginTop: 16
      }}>{H.chat.map((c, i) => <div key={i} className="dr-row" style={{
          marginBottom: 8,
          justifyContent: 'space-between'
        }}><div><div style={{
              fontSize: 13.5
            }}>{c.text}</div><div className="muted mono" style={{
              fontSize: 12
            }}>{pvT(c.at)} · {c.round}</div></div>{/hole card/i.test(c.text) && <Badge status="warning">Asked for hidden card</Badge>}</div>)}</div> : <EmptyState title="No chat messages" body="Chat archive is not exposed by the connected game service." />)}
      {tab === 'notes' && <>
        <div className="field" style={{
          marginTop: 16
        }}><label htmlFor="pv-note">Add a note</label><textarea id="pv-note" className="input" style={{
            height: 72,
            padding: 10,
            resize: 'vertical'
          }} value={note} onChange={e => setNote(e.target.value)} placeholder="Visible to everyone with access to this brand"></textarea></div>
        <div style={{
          marginTop: 8
        }}><button className="btn primary" disabled={!note.trim()} onClick={() => {
            const nx = [{
              at: Date.now(),
              by: session.user,
              text: note.trim()
            }, ...notes];
            settingSave('playerNotes', {
              ...settingRead('playerNotes', {}),
              [p.room + ':' + p.id]: nx
            }).then(() => {
              setNotes(nx);
              setNote('');
              toast('Note saved');
            }).catch(notifyError);
          }}>Add note</button></div>
        <div style={{
          display: 'grid',
          gap: 8,
          marginTop: 16
        }}>{notes.map((n, i) => <div key={i} className="dr-row" style={{
            display: 'grid',
            gap: 2
          }}><div style={{
              fontSize: 13.5
            }}>{n.text}</div><div className="muted" style={{
              fontSize: 12
            }}>{n.by} · <span className="mono">{pvT(n.at)}</span></div></div>)}{!notes.length && <p className="muted" style={{
            fontSize: 13
          }}>No notes yet.</p>}</div>
      </>}
    </div>
  </Drawer>;
}
function PvRounds({
  rows,
  open,
  setOpen
}) {
  return <div className="scroll-x"><table className="tbl"><thead><tr><th>Settled</th><th>Round</th><th>Boxes</th><th>Result</th><th className="num">Staked</th><th className="num">Returned</th><th className="num">House</th></tr></thead>
    <tbody>{rows.map(r => <React.Fragment key={r.id}><tr className="click" onClick={() => setOpen(open === r.id ? null : r.id)}>
      <td className="mono muted">{pvT(r.at)}</td><td className="mono">{r.id}</td><td className="mono">{r.hands.map(h => h.box).join(', ')}</td>
      <td><span style={{
                display: 'inline-flex',
                gap: 4
              }}>{r.hands.map((h, i) => <Badge key={i} status={PV_RB[h.res]}>{h.res}</Badge>)}</span></td>
      <td className="num mono">{money(r.staked)}</td><td className="num mono">{money(r.pay)}</td><td className={'num mono' + (r.house < 0 ? ' neg' : '')}>{money(r.house, true)}</td></tr>
      {open === r.id && <tr><td colSpan="7" style={{
              whiteSpace: 'normal',
              height: 'auto',
              padding: '10px 12px 14px',
              background: 'var(--paper)'
            }}>
        <div style={{
                display: 'grid',
                gap: 8,
                fontSize: 13
              }}>
          <div style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}><b style={{
                    width: 70
                  }}>Dealer</b><PvCards cs={r.dealer} /><span className="mono">{r.dbj ? 'Blackjack' : r.dt > 21 ? 'Bust ' + r.dt : r.dt}</span></div>
          {r.hands.map((h, i) => <div key={i} style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}><b style={{
                    width: 70
                  }}>Box {h.box}</b><PvCards cs={h.cards} /><span className="mono">{pvTot(h.cards)}</span><span className="muted">{h.dec.join(' → ')}</span><span className="mono" style={{
                    marginLeft: 'auto'
                  }}>{money(h.stake)} → {money(h.ret)}</span></div>)}
          {r.side && <div style={{
                  display: 'flex',
                  gap: 10
                }}><b style={{
                    width: 70
                  }}>Side bet</b><span>{r.side.name} · {money(r.side.stake)} → {r.side.ret ? money(r.side.ret) : 'lost'}</span></div>}
          <div className="muted" style={{
                  fontSize: 12
                }}>Recorded settlement · Astrid · <a href="#shoes">Round proof</a></div>
        </div></td></tr>}</React.Fragment>)}</tbody></table>
    {!rows.length && <EmptyState title="No rounds match" body="Try another result filter." />}</div>;
}

// Source: v-money.jsx at 7dee0901; see source-provenance.json.
const MX = runtime.data2;
const fmtAt = ms => new Date(ms).toLocaleString('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'medium'
});
const PL_CC = {
  nrk: ['SE', 'SE', 'NO'],
  bfj: ['NO', 'NO', 'SE'],
  aur: ['FI', 'FI', 'SE']
};
const PL_SEG = {
  vip: ['VIP', 'live'],
  new: ['New', 'paused'],
  risk: ['Watch', 'warning'],
  reg: ['Regular', 'closed']
};
function plEnrich(p) {
  const H = pvHistory(p),
    seg = p.staked > 6000 ? 'vip' : p.rounds < 20 ? 'new' : 'reg';
  return {
    ...p,
    H,
    flags: p.status === 'blocked' ? ['Blocked'] : [],
    seg,
    cc: '—',
    sessions: H.sessions.length,
    avg: p.rounds ? p.staked / p.rounds : 0,
    trend: H.rounds.slice(0, 8).reverse().map(r => r.house),
    boxes: (runtime.data.tables.find(t => t.id === p.room)?.seatInfo ?? []).filter(s => s.playerId === p.id).map(s => s.seat).join(', '),
    device: '—'
  };
}
function PlSpark({
  v
}) {
  if (!v.length) return <span className="muted">—</span>;
  const m = Math.max(...v.map(Math.abs)) || 1;
  return <svg width="64" height="22" viewBox="0 0 64 22" aria-label="House result per round">{v.map((x, i) => <rect key={i} x={i * 8 + 1} width="6" y={x >= 0 ? 11 - x / m * 10 : 11} height={Math.max(1, Math.abs(x) / m * 10)} rx="1" fill={x < 0 ? 'var(--err)' : 'var(--steel)'}></rect>)}<line x1="0" x2="64" y1="11" y2="11" stroke="rgba(10,11,13,.2)" strokeWidth=".6"></line></svg>;
}
function Players({
  toast,
  brand
}) {
  const [q, setQ] = React.useState(''),
    [st, setSt] = React.useState('all'),
    [seg, setSeg] = React.useState('all'),
    [sort, setSort] = React.useState('last'),
    [sel, setSel] = React.useState(null);
  const [players, setPlayers] = React.useState(MX.players),
    [confirm, setConfirm] = React.useState(null);
  React.useEffect(() => {
    const refresh = () => setPlayers([...MX.players]);
    window.addEventListener('bo-data', refresh);
    return () => window.removeEventListener('bo-data', refresh);
  }, []);
  const [per, setPer] = React.useState({
      k: '30d'
    }),
    [activeOnly, setActiveOnly] = React.useState(true);
  const E0 = React.useMemo(() => players.map(plEnrich), [players]);
  const IR = pvInRange(per);
  const E = E0.map(p => {
    const rr = p.H.rounds.filter(r => IR.test(r.at)),
      ss = p.H.sessions.filter(s => IR.test(s.start));
    const staked = rr.reduce((n, r) => n + r.staked, 0);
    return {
      ...p,
      rounds: rr.length,
      staked,
      net: rr.reduce((n, r) => n + r.house, 0),
      sessions: ss.length,
      avg: rr.length ? staked / rr.length : 0,
      trend: rr.slice(0, 8).reverse().map(s => s.house)
    };
  });
  const scoped = E.filter(p => brand === 'all' || p.brand === brand);
  const LAST = {
    online: 0,
    '18:02': 1,
    '17:40': 2,
    '17:12': 3,
    '16:55': 4,
    '16:40': 5,
    '15:12': 6,
    '15:05': 7,
    '14:30': 8,
    yesterday: 9
  };
  const sorter = {
    last: (a, b) => b.seen - a.seen,
    staked: (a, b) => b.staked - a.staked,
    house: (a, b) => b.net - a.net,
    balance: (a, b) => b.balance - a.balance,
    rounds: (a, b) => b.rounds - a.rounds
  }[sort];
  const rows = scoped.filter(p => (!activeOnly || p.rounds > 0 || p.status === 'online') && (st === 'all' || p.status === st) && (seg === 'all' || p.seg === seg) && (!q || (p.name + p.id).toLowerCase().includes(q.toLowerCase()))).sort(sorter);
  const cnt = k => scoped.filter(p => k === 'all' || p.status === k).length;
  const block = p => unavailable('Player blocking');
  const tot = scoped.reduce((a, p) => ({
    bal: a.bal + p.balance,
    st: a.st + p.staked,
    net: a.net + p.net,
    r: a.r + p.rounds
  }), {
    bal: 0,
    st: 0,
    net: 0,
    r: 0
  });
  return <>
    <PageH title="Players" sub="Everyone who has played at the shared table, with balance, activity and flags. Click a player for full history." src={assetUrl("shared game \xB7 data.players (transactions API)")} right={<div className="filters"><RpPeriod p={per} set={setPer} /><button className="btn" onClick={() => downloadRows('players', ['Player', 'Brand', 'Balance', 'Rounds', 'Staked', 'House'], rows.map(p => [p.name, brandName(p.brand), p.balance, p.rounds, p.staked, p.net]))}>Export CSV</button></div>} />
    <div className="page-b">
      <div className="ops-m">
        <div className="ops-mi"><span>Online now</span><b>{cnt('online')}</b><small>{scoped.filter(p => p.status === 'online').map(p => p.name).slice(0, 3).join(', ')}{cnt('online') > 3 ? '…' : ''}</small></div>
        <div className="ops-mi"><span>Players</span><b>{scoped.length}</b><small>{scoped.filter(p => p.seg === 'new').length} new · {scoped.filter(p => p.seg === 'vip').length} VIP</small></div>
        <div className="ops-mi"><span>Total balance</span><b>{money(tot.bal)}</b><small>Demo funds held by players</small></div>
        <div className="ops-mi"><span>House result</span><b className={tot.net < 0 ? 'neg' : ''}>{money(tot.net, true)}</b><small>On {money(tot.st)} staked</small></div>
        <div className={'ops-mi' + (scoped.some(p => p.flags.length) ? ' warn' : '')}><span>Flagged</span><b>{scoped.filter(p => p.flags.length).length}</b><small>{cnt('blocked')} blocked</small></div>
      </div>
      <section className="panel">
        <div className="panel-h wrap"><div className="filters">{[['all', 'All'], ['online', 'Online'], ['offline', 'Offline'], ['blocked', 'Blocked']].map(([k, l]) => <button key={k} className={'chip' + (st === k ? ' on' : '')} onClick={() => setSt(k)}>{l} <span className="n">{cnt(k)}</span></button>)}
          <select className="select" value={seg} onChange={e => setSeg(e.target.value)} aria-label="Segment"><option value="all">All segments</option>{Object.entries(PL_SEG).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="chk"><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />Only players active in the period</label>
          <select className="select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="last">Sort: last seen</option><option value="staked">Sort: staked</option><option value="house">Sort: house result</option><option value="balance">Sort: balance</option><option value="rounds">Sort: rounds</option></select></div>
          <input className="input" style={{
            width: 260
          }} placeholder="Search nickname or player ID" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="scroll-x"><table className="tbl pl-tbl">
          <thead><tr><th>Player</th><th>Status</th><th>Brand</th><th className="num">Balance</th><th className="num">Sessions</th><th className="num">Rounds</th><th className="num">Avg stake / round</th><th className="num">Staked</th><th className="num">House result</th><th>Trend</th><th>Flags</th></tr></thead>
          <tbody>{rows.map(p => <tr key={p.id} className={'click' + (sel && sel.id === p.id ? ' sel' : '')} onClick={() => setSel(p)}>
            <td><div className="pl-who"><span className="pl-av">{p.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span><span><b>{p.name}</b><small><span className="mono">{p.id.slice(0, 6)}</span> · {p.cc} · <Badge status={PL_SEG[p.seg][1]}>{PL_SEG[p.seg][0]}</Badge></small></span></div></td>
            <td>{p.status === 'online' ? <span className="pl-st"><span className="pulse"></span><span><b>Online</b><small>Privé · box {p.boxes || '—'}</small></span></span> : p.status === 'blocked' ? <span className="pl-st"><Badge status="error">Blocked</Badge></span> : <span className="pl-st"><span><b style={{
                        fontWeight: 500
                      }}>Last seen</b><small className="mono">{p.last}</small></span></span>}</td>
            <td>{brandName(p.brand)}</td>
            <td className="num mono">{money(p.balance)}</td><td className="num mono">—</td><td className="num mono">{p.rounds}</td><td className="num mono">{money(p.avg)}</td><td className="num mono">{money(p.staked)}</td>
            <td className={'num mono' + (p.net < 0 ? ' neg' : '')}>{money(p.net, true)}</td>
            <td><PlSpark v={p.trend} /></td>
            <td>{p.flags.length ? <span className="pl-flags">{p.flags.map(f => <span key={f} className={'pill' + (f === 'Blocked' ? ' pill-err' : ' pill-warn')}>{f}</span>)}</span> : <span className="muted">—</span>}</td>
          </tr>)}</tbody>
          {rows.length > 0 && <tfoot><tr><td colSpan="3"><b>{rows.length} players</b></td><td className="num mono">{money(rows.reduce((n, p) => n + p.balance, 0))}</td><td className="num mono">{rows.reduce((n, p) => n + p.sessions, 0)}</td><td className="num mono">{rows.reduce((n, p) => n + p.rounds, 0)}</td><td></td><td className="num mono">{money(rows.reduce((n, p) => n + p.staked, 0))}</td><td className="num mono">{money(rows.reduce((n, p) => n + p.net, 0), true)}</td><td colSpan="2"></td></tr></tfoot>}
        </table></div>
        {!rows.length && <EmptyState title="No players match" body="Try another status, segment or search term." />}
        <div className="note">Sessions, rounds, stakes and house result cover {IR.label}. Trend shows the house result for up to 8 sessions in the period. Red: the player won that session.</div>
      </section>
    </div>
    {sel && <PlayerDetail p={players.find(x => x.id === sel.id) || sel} per={per} onClose={() => setSel(null)} onBlock={block} toast={toast} />}
    <Confirm state={confirm} onClose={() => setConfirm(null)} />
  </>;
}
const txTable = r => r.room;
const txTableName = id => (runtime.data.tables.find(t => t.id === id) || {}).name || id;
function Transactions({
  toast,
  brand
}) {
  const [game, setGame] = React.useState('all'),
    [tbl, setTbl] = React.useState('all');
  const gameOf = id => (runtime.data.tables.find(t => t.id === id) || {}).game;
  const inScope = r => {
    const t = txTable(r);
    return (tbl === 'all' || t === tbl) && (game === 'all' || gameOf(t) === game);
  };
  const [kind, setKind] = React.useState('settlements'),
    [player, setPlayer] = React.useState(''),
    [from, setFrom] = React.useState(''),
    [to, setTo] = React.useState(''),
    [page, setPage] = React.useState(0);
  const src = (kind === 'settlements' ? MX.settlements : MX.movements).filter(r => (brand === 'all' || r.brand === brand) && (!player || r.playerId === player) && inScope(r) && (!from || r.at >= Date.parse(from + 'T00:00:00Z')) && (!to || r.at < Date.parse(to + 'T00:00:00Z') + 86400000));
  const per = 15,
    rows = src.slice(page * per, page * per + per);
  const set = MX.settlements.filter(r => (brand === 'all' || r.brand === brand) && (!player || r.playerId === player) && inScope(r) && (!from || r.at >= Date.parse(from + 'T00:00:00Z')) && (!to || r.at < Date.parse(to + 'T00:00:00Z') + 86400000));
  const stakes = set.reduce((n, r) => n + r.stakes, 0),
    pays = set.reduce((n, r) => n + r.payouts, 0),
    net = stakes - pays;
  const hold = stakes ? net / stakes * 100 : null;
  const plist = MX.players.filter(p => brand === 'all' || p.brand === brand);
  return <>
    <PageH title="Transactions" sub="Settled stakes minus total payouts, including returned stakes, side bets and insurance. Demo funds only. Game result before operating costs." src={assetUrl("transactions.mjs \xB7 /api/bo/game-audit?view=transactions")} />
    <div className="page-b">
      <section className="panel"><div className="panel-h wrap"><div className="filters">
        <select className="select" value={game} onChange={e => {
              setGame(e.target.value);
              setTbl('all');
              setPage(0);
            }} aria-label="Game"><option value="all">All games</option>{[['Blackjack', 'live'], ['Roulette', 'in development'], ['Baccarat', 'planned']].map(([g, s]) => <option key={g} value={g}>{g}{s !== 'live' ? ' · ' + s : ''}</option>)}</select>
        <select className="select" value={tbl} onChange={e => {
              setTbl(e.target.value);
              setPage(0);
            }} aria-label="Table"><option value="all">All tables</option>{runtime.data.tables.filter(t => (game === 'all' || t.game === game) && (brand === 'all' || t.brands.includes(brand))).map(t => <option key={t.id} value={t.id}>{t.name} · {t.game}</option>)}</select>
        <select className="select" value={player} onChange={e => {
              setPlayer(e.target.value);
              setPage(0);
            }} aria-label="Player"><option value="">All players</option>{plist.map(p => <option key={p.id} value={p.id}>{p.name} · astrid · {p.id.slice(0, 6)}</option>)}</select>
        <label className="filters" style={{
              fontSize: 13
            }}>From <input type="date" className="input" value={from} onChange={e => {
                setFrom(e.target.value);
                setPage(0);
              }} /></label>
        <label className="filters" style={{
              fontSize: 13
            }}>Through <input type="date" className="input" value={to} onChange={e => {
                setTo(e.target.value);
                setPage(0);
              }} /></label>
        <button className="btn" onClick={() => runtime.refresh()}>Refresh</button></div>
        <span className="muted" style={{
            fontSize: 12.5
          }}>Snapshot · {new Date(runtime.data.updatedAt).toLocaleString('sv-SE', {
              timeZone: 'Europe/Stockholm'
            })}</span></div>
        <div className="stats">
          <div className="stat lead"><div className="stat-l">{net > 0 ? 'House is winning' : net < 0 ? 'House is losing' : 'House is even'} · {from || to ? (from || 'Beginning') + ' → ' + (to || 'Now') : 'All recorded dates'}</div><div className={'stat-v' + (net < 0 ? ' neg' : '')}>{money(net, true)}</div></div>
          <div className="stat"><div className="stat-l">Settled stakes</div><div className="stat-v sm">{money(stakes)}</div></div>
          <div className="stat"><div className="stat-l">Total payouts</div><div className="stat-v sm">{money(pays)}</div></div>
          <div className="stat"><div className="stat-l">House hold</div><div className="stat-v sm">{hold == null ? '—' : hold.toFixed(2) + '%'}</div></div>
          <div className="stat"><div className="stat-l">Settled rounds</div><div className="stat-v sm">{set.length}</div></div>
        </div>
        <div className="note">Current open stakes <span className="mono">{money(MX.summary.open)}</span> · prepared bets <span className="mono">{money(MX.summary.prepared)}</span>. Both are excluded from settled results and do not follow the date filter.</div>
      </section>
      <section className="panel">
        <div className="panel-h wrap"><div className="seg">{[['settlements', 'Settled rounds'], ['movements', 'Balance movements']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => {
              setKind(k);
              setPage(0);
            }}>{l}</button>)}</div><button className="btn sm" onClick={() => downloadRows('transactions', Object.keys(src[0] ?? {}), src.map(r => Object.values(r)))}>Export CSV</button></div>
        <div className="note" style={{
          borderTop: '1px solid var(--rule)'
        }}>{kind === 'settlements' ? 'Every matching settlement receipt counts in the totals, including older pages. Each row is one player’s complete round: initial and extra stakes against total payout. Demo credits are excluded.' : 'Detailed balance movements are captured from 2026-09-26 12:04. Earlier balances appear as opening snapshots, not reconstructed transactions. Clearing an uncommitted bet does not move funds. The game has no refund flow.'}</div>
        <div className="scroll-x">{kind === 'settlements' ? <table className="tbl"><thead><tr><th>Settled at</th><th>Player / table</th><th>Brand</th><th>Round</th><th className="num">Stakes</th><th className="num">Payout</th><th className="num">House result</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.roundId + r.playerId}><td className="mono muted">{fmtAt(r.at)}</td><td><b style={{
                    fontWeight: 600
                  }}>{r.name}</b> <span className="mono muted">{r.playerId.slice(0, 6)} · {txTableName(txTable(r))}</span></td><td>{brandName(r.brand)}</td><td className="mono">{r.roundId}</td><td className="num mono">{money(r.stakes)}</td><td className="num mono">{money(r.payouts)}</td><td className={'num mono' + (r.house < 0 ? ' neg' : '')}>{money(r.house, true)}</td></tr>)}</tbody></table> : <table className="tbl"><thead><tr><th>Time</th><th>Player / table</th><th>Type</th><th>Round</th><th className="num">Balance change</th><th className="num">Before</th><th className="num">After</th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}><td className="mono muted">{fmtAt(r.at)}</td><td><b style={{
                    fontWeight: 600
                  }}>{r.name}</b> <span className="mono muted">{r.playerId.slice(0, 6)} · {txTableName(txTable(r))}</span></td><td>{MX.kindName[r.kind]}</td><td className="mono">{r.roundId || '—'}</td><td className={'num mono' + (r.amount < 0 ? ' neg' : '')}>{money(r.amount, true)}</td><td className="num mono muted">{money(r.before)}</td><td className="num mono">{money(r.after)}</td></tr>)}</tbody></table>}</div>
        {!rows.length && <EmptyState title="No transactions match these filters" body={game === 'Roulette' || game === 'Baccarat' ? game + ' has no settled rounds yet.' : 'Change the game, table, player or dates.'} />}
        <div className="pager"><button className="btn sm" disabled={!page} onClick={() => setPage(0)}>Latest transactions</button><button className="btn sm" disabled={(page + 1) * per >= src.length} onClick={() => setPage(page + 1)}>Older transactions →</button><span className="muted" style={{
            fontSize: 12.5,
            marginLeft: 'auto'
          }}>{src.length ? page * per + 1 : 0}–{Math.min(src.length, (page + 1) * per)} of {src.length}</span></div>
      </section>
    </div>
  </>;
}

// Source: v-reports.jsx at 7dee0901; see source-provenance.json.
const RP_DAYS = Array.from({
  length: 400
}, (_, i) => new Date(runtime.data.updatedAt - i * 86400000).toISOString().slice(0, 10));
const RP_DAY = RP_DAYS.map(d => ({
  d,
  rounds: 0,
  stakes: 0,
  hold: 0,
  players: 0,
  fresh: 0,
  side: 0,
  ins: 0,
  uptime: 0,
  incidents: 0,
  sess: 0
}));
const rpSc = b => b === 'all' || b === 'scout' ? 1 : 0;
const rpPeriod = p => ({
  today: 1,
  '7d': 7,
  '30d': 30
})[p] || 30;
function rpRecordedDays(days, brand, scope = {}) {
  const rows = recordedRows(brand, scope);
  return days.map(d => {
    const rr = rows.filter(r => new Date(r.at).toISOString().slice(0, 10) === d.d),
      a = aggregate(rr),
      hands = rr.flatMap(r => r.hands ?? []);
    return {
      ...d,
      rounds: a.rounds,
      stakes: a.stakes,
      payouts: a.payouts,
      hold: a.stakes ? a.result / a.stakes * 100 : 0,
      players: new Set(rr.map(r => r.playerId)).size,
      fresh: runtime.data2.players.filter(p => (brand === 'all' || p.brand === brand) && (!scope.table || scope.table === 'all' || p.room === scope.table) && (!scope.game || scope.game === 'all' || scope.game === 'Blackjack') && runtime.data2.movements.findLast(m => m.playerId === p.id)?.at && new Date(runtime.data2.movements.findLast(m => m.playerId === p.id).at).toISOString().slice(0, 10) === d.d).length,
      side: rr.length ? rr.filter(r => r.hands?.some(h => h.pp || h.tp)).length / rr.length : 0,
      ins: 0
    };
  });
}
const RP_PER = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['last', 'Last month'], ['custom', 'Custom']];
function rpRange(p) {
  let f, t;
  if (p.k === 'month') {
    f = RP_DAYS[0].slice(0, 7) + '-01';
    t = RP_DAYS[0];
  } else if (p.k === 'last') {
    const d = new Date(RP_DAYS[0] + 'T00:00:00Z');
    d.setUTCDate(0);
    t = d.toISOString().slice(0, 10);
    f = t.slice(0, 7) + '-01';
  } else if (p.k === 'custom') {
    f = p.from || RP_DAYS[6];
    t = p.to || RP_DAYS[0];
    if (f > t) [f, t] = [t, f];
  } else {
    const n = rpPeriod(p.k);
    f = RP_DAYS[n - 1];
    t = RP_DAYS[0];
  }
  let cur = RP_DAY.filter(x => x.d >= f && x.d <= t);
  if (!cur.length) cur = [{
    ...RP_DAY[0],
    d: f
  }];
  const i = RP_DAY.indexOf(cur[cur.length - 1]),
    prev = RP_DAY.slice(i + 1, i + 1 + cur.length);
  const fm = s => {
    const [, m, dd] = s.split('-');
    return +dd + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1];
  };
  return {
    cur,
    prev,
    cmp: prev.length === cur.length,
    label: cur.length === 1 ? fm(cur[0].d) : fm(cur[cur.length - 1].d) + ' – ' + fm(cur[0].d),
    days: cur.length
  };
}
function RpPeriod({
  p,
  set
}) {
  return <div className="rp-per"><select className="select" value={p.k} onChange={e => set({
      ...p,
      k: e.target.value
    })} aria-label="Period">{RP_PER.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {p.k === 'custom' && <><input type="date" className="input" aria-label="From" min={RP_DAYS[RP_DAYS.length - 1]} max={RP_DAYS[0]} value={p.from || RP_DAYS[6]} onChange={e => set({
        ...p,
        from: e.target.value
      })} /><span className="muted">to</span><input type="date" className="input" aria-label="Through" min={RP_DAYS[RP_DAYS.length - 1]} max={RP_DAYS[0]} value={p.to || RP_DAYS[0]} onChange={e => set({
        ...p,
        to: e.target.value
      })} /></>}
    <span className="muted rp-lab">{rpRange(p).label}</span></div>;
}
const RP_GS = {
  Blackjack: 1,
  Roulette: 0,
  Baccarat: 0
};
function rpScopeK(s) {
  return s.game !== 'all' && s.game !== 'Blackjack' || s.dealer !== 'all' && s.dealer !== 'astrid' ? 0 : 1;
}
function RpScope({
  s,
  set
}) {
  const T = runtime.data.tables,
    games = ['Blackjack', 'Roulette', 'Baccarat'];
  const on = s.game !== 'all' || s.table !== 'all' || s.dealer !== 'all';
  return <div className="rp-scope"><span className="muted" style={{
      fontSize: 13
    }}>Show</span>
    <select className="select" value={s.game} onChange={e => set({
      ...s,
      game: e.target.value,
      table: 'all'
    })} aria-label="Game"><option value="all">All games</option>{games.map(g => <option key={g} value={g}>{g}{RP_GS[g] ? '' : ' · no data yet'}</option>)}</select>
    <select className="select" value={s.table} onChange={e => set({
      ...s,
      table: e.target.value
    })} aria-label="Table"><option value="all">All tables</option>{T.filter(t => s.game === 'all' || t.game === s.game).map(t => <option key={t.id} value={t.id}>{t.name} · {t.limits}</option>)}</select>
    <select className="select" value={s.dealer} onChange={e => set({
      ...s,
      dealer: e.target.value
    })} aria-label="Dealer"><option value="all">All dealers</option>{runtime.data.dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
    {on && <button className="btn sm ghost" onClick={() => set({
      game: 'all',
      table: 'all',
      dealer: 'all'
    })}>Clear</button>}</div>;
}
const RP_S0 = {
  game: 'all',
  table: 'all',
  dealer: 'all'
};
const rpScaleDays = (days, k) => k === 1 ? days : days.map(x => ({
  ...x,
  rounds: x.rounds * k,
  stakes: x.stakes * k,
  players: x.players * k,
  fresh: x.fresh * k
}));
function rpAgg(days) {
  const s = days.reduce((a, x) => ({
    rounds: a.rounds + x.rounds,
    stakes: a.stakes + x.stakes,
    ggr: a.ggr + x.stakes * x.hold / 100,
    players: a.players + x.players,
    fresh: a.fresh + x.fresh,
    inc: a.inc + x.incidents
  }), {
    rounds: 0,
    stakes: 0,
    ggr: 0,
    players: 0,
    fresh: 0,
    inc: 0
  });
  s.hold = s.stakes ? s.ggr / s.stakes * 100 : 0;
  s.avg = s.rounds ? s.stakes / s.rounds : 0;
  s.uptime = days.reduce((n, x) => n + x.uptime, 0) / days.length;
  s.sess = days.reduce((n, x) => n + x.sess, 0) / days.length;
  s.side = days.reduce((n, x) => n + x.side, 0) / days.length;
  s.ins = days.reduce((n, x) => n + x.ins, 0) / days.length;
  return s;
}
const RP_CAT = [{
  cat: 'Finance',
  items: [{
    id: 'ggr-day',
    name: 'GGR by day',
    desc: 'Settled stakes, payouts, gross gaming revenue and hold per day.',
    cols: ['Day', 'Rounds', 'Stakes', 'Payouts', 'GGR', 'Hold']
  }, {
    id: 'ggr-brand',
    name: 'GGR by brand',
    desc: 'The same figures split by brand, for revenue share and invoicing.',
    cols: ['Brand', 'Rounds', 'Stakes', 'Payouts', 'GGR', 'Hold']
  }, {
    id: 'ggr-table',
    name: 'GGR by table and game',
    desc: 'Result per table, game type and limit tier.',
    cols: ['Table', 'Game', 'Rounds', 'Stakes', 'GGR', 'Hold']
  }, {
    id: 'revshare',
    name: 'Revenue share statement',
    desc: 'Monthly GGR per brand with the agreed share and the amount to invoice.',
    cols: ['Brand', 'GGR', 'Share', 'Amount due']
  }, {
    id: 'sidebets',
    name: 'Side bets and insurance',
    desc: 'Uptake, stakes, payouts and hold for Perfect Pairs, 21+3 and insurance.',
    cols: ['Bet type', 'Uptake', 'Stakes', 'Payouts', 'Hold']
  }, {
    id: 'wallet',
    name: 'Wallet reconciliation',
    desc: 'Balance movements per type and day, with opening and closing balances.',
    cols: ['Day', 'Opening', 'Stakes', 'Payouts', 'Top-ups', 'Closing']
  }]
}, {
  cat: 'Players',
  items: [{
    id: 'active',
    name: 'Active players',
    desc: 'Unique players, new players and average session length per day.',
    cols: ['Day', 'Active', 'New', 'Returning', 'Avg session']
  }, {
    id: 'player-activity',
    name: 'Player activity',
    desc: 'Every player with sessions, rounds, stakes and house result in the period.',
    cols: ['Player', 'Brand', 'Rounds', 'Staked', 'House result']
  }, {
    id: 'top',
    name: 'Top players',
    desc: 'The 20 players with the highest stakes, and the 20 with the biggest wins.',
    cols: ['Rank', 'Player', 'Brand', 'Staked', 'Player result']
  }, {
    id: 'rg',
    name: 'Blocks and responsible gambling',
    desc: 'Blocks, unblocks and flags, with who acted and why.',
    cols: ['Time', 'Player', 'Action', 'By', 'Reason']
  }]
}, {
  cat: 'Game and integrity',
  items: [{
    id: 'rounds',
    name: 'Round log',
    desc: 'Every settled round with cards, decisions, stakes and payouts. Use for disputes.',
    cols: ['Settled', 'Round', 'Player', 'Cards', 'Stake', 'Payout']
  }, {
    id: 'shoes',
    name: 'Shoe audit',
    desc: 'Every shoe with verification status, card accounting and opening commitment.',
    cols: ['Shoe', 'Opened', 'Status', 'Cards dealt', 'Commitment']
  }, {
    id: 'uptime',
    name: 'Table uptime and incidents',
    desc: 'Minutes live, paused and in error per table, with every incident.',
    cols: ['Day', 'Uptime', 'Incidents', 'Longest stop']
  }, {
    id: 'dealer',
    name: 'Dealer performance',
    desc: 'Rounds per hour, round length, clip start delay and stalls per dealer.',
    cols: ['Dealer', 'Rounds/hour', 'Avg round', 'Clip start', 'Stalls']
  }]
}, {
  cat: 'Compliance',
  items: [{
    id: 'regulator',
    name: 'Regulator round export',
    desc: 'Round-level export for the licensing authority. One file per brand and day.',
    cols: ['Round', 'Player', 'Start', 'End', 'Stake', 'Win']
  }, {
    id: 'audit',
    name: 'Back office audit log',
    desc: 'Every change made in the back office: who, when and what.',
    cols: ['Time', 'User', 'Action', 'Target']
  }]
}];
const RP_ALL = RP_CAT.flatMap(c => c.items.map(i => ({
  ...i,
  cat: c.cat
})));
function rpRows(id, brand, days, scope = {}) {
  const dates = new Set(days.map(d => d.d)),
    rr = recordedRows(brand, scope).filter(r => dates.has(new Date(r.at).toISOString().slice(0, 10))),
    mv = runtime.data2.movements.filter(r => (brand === 'all' || r.brand === brand) && dates.has(new Date(r.at).toISOString().slice(0, 10)) && (scope.table === 'all' || !scope.table || r.room === scope.table)),
    M = money,
    pct = v => v.toFixed(2) + '%',
    agg = rs => {
      const a = aggregate(rs);
      return [a.rounds, M(a.stakes), M(a.payouts), M(a.result, true), a.stakes ? pct(a.result / a.stakes * 100) : '—'];
    };
  switch (id) {
    case 'ggr-day':
      return days.map(d => [d.d, ...agg(rr.filter(r => new Date(r.at).toISOString().slice(0, 10) === d.d))]);
    case 'ggr-brand':
      return runtime.data.brands.filter(b => brand === 'all' || b.id === brand).map(b => [b.name, ...agg(rr.filter(r => r.brand === b.id))]);
    case 'ggr-table':
      return runtime.data.tables.filter(t => (scope.table === 'all' || !scope.table || t.id === scope.table) && (scope.game === 'all' || !scope.game || t.game === scope.game)).map(t => {
        const a = aggregate(rr.filter(r => r.room === t.id));
        return [t.name, t.game, a.rounds, M(a.stakes), M(a.result, true), a.stakes ? pct(a.result / a.stakes * 100) : '—'];
      });
    case 'player-activity':
    case 'top':
      return runtime.data2.players.filter(p => brand === 'all' || p.brand === brand).map(p => {
        const a = aggregate(rr.filter(r => r.playerId === p.id && r.room === p.room));
        return {
          p,
          a
        };
      }).sort((a, b) => b.a.stakes - a.a.stakes).map(({
        p,
        a
      }, i) => id === 'top' ? [i + 1, p.name, brandName(p.brand), M(a.stakes), M(-a.result, true)] : [p.name, brandName(p.brand), a.rounds, M(a.stakes), M(a.result, true)]);
    case 'rounds':
      return rr.map(r => [fmtAt(r.at), r.roundId, r.name, (r.hands ?? []).map(h => h.cards?.map(c => c.r + c.s).join(' ')).join(' / '), M(r.stakes), M(r.payouts)]);
    case 'regulator':
      return rr.map(r => [r.roundId, r.playerId, 'Not recorded', fmtAt(r.at), M(r.stakes), M(r.payouts)]);
    case 'shoes':
      return runtime.data2.shoes.filter(s => brand === 'all' || brand === 'scout').map(s => [s.id, s.first, s.status, s.dealt + ' consumed / ' + s.remaining + ' unused', s.commit ?? 'Not recorded']);
    case 'audit':
      return (runtime.raw.workspace.activity ?? []).filter(e => dates.has(e.at.slice(0, 10))).map(e => [e.at, e.username, e.action, e.target]);
    case 'active':
      return days.map(d => {
        const ids = new Set(rr.filter(r => new Date(r.at).toISOString().slice(0, 10) === d.d).map(r => r.playerId));
        return [d.d, ids.size, 'Not recorded', 'Not recorded', 'Not recorded'];
      });
    case 'wallet':
      return days.map(d => {
        const mm = mv.filter(r => new Date(r.at).toISOString().slice(0, 10) === d.d),
          sum = k => mm.filter(m => k.includes(m.kind)).reduce((n, m) => n + m.amount, 0);
        const wallets = [...new Set(mm.map(m => m.room + ':' + m.playerId))].map(k => mm.filter(m => m.room + ':' + m.playerId === k).sort((a, b) => a.at - b.at || a.id - b.id));
        return [d.d, M(wallets.reduce((n, w) => n + w[0].before, 0)), M(sum(['stake', 'insurance', 'double', 'split'])), M(sum(['payout'])), M(sum(['opening_credit', 'demo_refill'])), M(wallets.reduce((n, w) => n + w.at(-1).after, 0))];
      });
    case 'sidebets':
      return [['pp', 'Perfect Pairs'], ['tp', '21+3'], ['insured', 'Insurance']].map(([k, label]) => {
        const h = rr.flatMap(r => r.hands ?? []),
          stakes = h.reduce((n, x) => n + (x[k] ?? 0), 0),
          pays = h.reduce((n, x) => n + (x.sideResults?.[k]?.returned ?? 0), 0);
        if (k === 'insured') return [label, h.length ? pct(h.filter(x => x.insured > 0).length / h.length * 100) : '—', M(stakes), 'Included in main return', 'Not separately recorded'];
        return [label, h.length ? pct(h.filter(x => x[k] > 0).length / h.length * 100) : '—', M(stakes), M(pays), stakes ? pct((stakes - pays) / stakes * 100) : '—'];
      });
    default:
      return [];
  }
}
function ReportsLib({
  toast,
  brand
}) {
  const [scope, setScope] = React.useState(RP_S0);
  const [sel, setSel] = React.useState('ggr-day'),
    [per, setPer] = React.useState({
      k: '7d'
    }),
    [fmt, setFmt] = React.useState('CSV'),
    [q, setQ] = React.useState(''),
    [sched, setSched] = React.useState(false);
  const [exports, setExports] = React.useState(settingRead('reportExports', []));
  const [schedules, setSchedules] = React.useState(settingRead('reportSchedules', []));
  const [sf, setSf] = React.useState({
    every: 'Weekly · Monday 08:00',
    to: ''
  });
  const R = RP_ALL.find(r => r.id === sel),
    days = rpRecordedDays(rpRange(per).cur, brand, scope),
    rows = rpRows(sel, brand, days, scope).filter(row => sel !== 'ggr-table' || scope.table === 'all' || String(row[0]) === (runtime.data.tables.find(t => t.id === scope.table) || {}).name).filter(row => sel !== 'ggr-table' || scope.game === 'all' || row[1] === scope.game);
  const numCol = i => i > 0 && rows.length && /^[−+\-$0-9]/.test(String(rows[0][i]));
  const download = async () => {
    try {
      const bytes = await exportReport(R.name, R.cols, rows, fmt);
      const item = {
        at: new Date().toLocaleString('sv-SE', {
          timeZone: 'Europe/Stockholm'
        }),
        name: R.name,
        period: rpRange(per).label,
        fmt,
        by: session.user,
        size: Math.ceil(bytes / 1024) + ' KB',
        cols: R.cols,
        rows
      };
      const next = [item, ...exports].slice(0, 20);
      await settingSave('reportExports', next);
      setExports(next);
      toast('Downloaded ' + R.name);
    } catch (e) {
      notifyError(e);
    }
  };
  return <>
    <PageH title="Reports" sub="Pick a report, set the period and brand, preview it and download. Only labelled fixture CSV is available. Email delivery is not connected." src={assetUrl("transactions.mjs \xB7 game-audit.mjs \xB7 bo.mjs pay (CSV)")} />
    <div className="page-b">
      <div className="rp-grid">
        <section className="panel rp-list"><div className="panel-h"><input className="input" style={{
              width: '100%'
            }} placeholder="Find a report" value={q} onChange={e => setQ(e.target.value)} /></div>
          {RP_CAT.map(c => {
            const it = c.items.filter(i => !q || (i.name + i.desc).toLowerCase().includes(q.toLowerCase()));
            return it.length ? <div key={c.cat}><div className="tgroup">{c.cat}</div>{it.map(i => <button key={i.id} className={'tnode' + (sel === i.id ? ' on' : '')} onClick={() => setSel(i.id)}><span style={{
                  fontWeight: 600
                }}>{i.name}</span><small style={{
                  fontFamily: 'var(--ui)',
                  fontSize: 12
                }}>{i.desc}</small></button>)}</div> : null;
          })}
        </section>
        <div style={{
          display: 'grid',
          gap: 20,
          minWidth: 0
        }}>
          <section className="panel">
            <div className="panel-h wrap"><div><h2>{R.name}</h2><div className="muted" style={{
                  fontSize: 13,
                  marginTop: 2
                }}>{R.desc}</div></div></div>
            <div className="panel-h wrap" style={{
              borderTop: '1px solid var(--rule)'
            }}><div className="filters">
              <RpPeriod p={per} set={setPer} />
              <span className="muted" style={{
                  fontSize: 13
                }}>{brand === 'all' ? 'All brands' : brandName(brand)}</span></div></div>
            <div className="panel-h wrap" style={{
              borderTop: '1px solid var(--rule)',
              paddingTop: 10,
              paddingBottom: 10
            }}><RpScope s={scope} set={setScope} /><div className="filters">
              <div className="seg">{['CSV', 'XLSX', 'PDF'].map(f => <button key={f} disabled={f !== 'CSV'} title={f === 'CSV' ? 'Labelled fixture CSV' : 'Export format not connected'} className={fmt === f ? 'on' : ''} onClick={() => setFmt(f)}>{f}</button>)}</div></div>
              <div className="filters"><button className="btn" disabled title="Email delivery is not connected">Schedule</button><button className="btn primary" onClick={download}>Download {fmt}</button></div></div>
            <div className="scroll-x" style={{
              maxHeight: 460,
              overflow: 'auto'
            }}><table className="tbl"><thead><tr>{R.cols.map((c, i) => <th key={c} className={numCol(i) ? 'num' : ''}>{c}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, k) => <td key={k} className={(numCol(k) ? 'num ' : '') + (typeof v === 'string' && /^[−-]\$/.test(v) ? 'mono neg' : numCol(k) || /^\d{4}-/.test(String(v)) ? 'mono' : '')}>{v}</td>)}</tr>)}</tbody></table></div>
            <div className="note">Preview shows {rows.length} {rows.length === 1 ? 'row' : 'rows'}. Demo funds only. Only recorded receipts are included. Empty reports have no recorded source for the selected scope.</div>
          </section>
          <div className="two">
            <section className="panel"><div className="panel-h"><h2>Recent downloads</h2></div>
              <table className="tbl"><thead><tr><th>Time</th><th>Report</th><th>Period</th><th>By</th><th></th></tr></thead>
                <tbody>{exports.slice(0, 6).map((e, i) => <tr key={i}><td className="mono muted">{e.at}</td><td>{e.name} <span className="pill">{e.fmt}</span></td><td>{e.period}</td><td className="muted">{e.by}</td><td><button className="btn sm ghost" onClick={() => exportReport(e.name, e.cols, e.rows, e.fmt).catch(notifyError)}>Download</button></td></tr>)}</tbody></table></section>
            <section className="panel"><div className="panel-h"><h2>Schedule drafts</h2></div>
              <table className="tbl"><thead><tr><th>Report</th><th>When</th><th>To</th><th></th></tr></thead>
                <tbody>{schedules.map((s, i) => <tr key={i}><td>{s.name} <span className="pill">{s.fmt}</span></td><td>{s.every}</td><td className="muted">{s.to}</td><td><button className="btn sm ghost" style={{
                        color: 'var(--err)'
                      }} onClick={() => {
                        const next = schedules.filter((_, k) => k !== i);
                        settingSave('reportSchedules', next).then(() => {
                          setSchedules(next);
                          toast('Schedule removed');
                        }).catch(notifyError);
                      }}>Remove</button></td></tr>)}</tbody></table></section>
          </div>
        </div>
      </div>
    </div>
    {sched && <Modal open title={'Schedule · ' + R.name} onClose={() => setSched(false)} footer={<><button className="btn" onClick={() => setSched(false)}>Cancel</button><button className="btn primary" disabled={!/\S+@\S+/.test(sf.to)} onClick={() => {
        const next = [...schedules, {
          name: R.name,
          every: sf.every,
          to: sf.to,
          fmt,
          status: 'draft',
          brand,
          scope
        }];
        settingSave('reportSchedules', next).then(() => {
          setSchedules(next);
          setSched(false);
          toast('Schedule draft saved. Email delivery is not configured.');
        }).catch(notifyError);
      }}>Save schedule</button></>}>
      <div style={{
        display: 'grid',
        gap: 14
      }}>
        <div className="field"><label htmlFor="sc-e">Send</label><select id="sc-e" className="select" value={sf.every} onChange={e => setSf({
            ...sf,
            every: e.target.value
          })}>{['Daily · 08:00', 'Weekly · Monday 08:00', 'Monthly · 1st at 09:00'].map(o => <option key={o}>{o}</option>)}</select></div>
        <div className="field"><label htmlFor="sc-t">To</label><input id="sc-t" className="input" placeholder="finance@company.com, several separated by commas" value={sf.to} onChange={e => setSf({
            ...sf,
            to: e.target.value
          })} /></div>
        <p className="muted" style={{
          margin: 0,
          fontSize: 13
        }}>{fmt} · {brand === 'all' ? 'All brands' : brandName(brand)} · Email delivery worker is not connected. Saving stores a draft; no email is sent.</p>
      </div></Modal>}
  </>;
}
function RpBars({
  data,
  h = 140,
  fmt = v => v,
  neg,
  label
}) {
  const max = Math.max(...data.map(d => Math.abs(d.v))) || 1,
    w = 100 / data.length;
  return <div className="rp-chart"><svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{
      width: '100%',
      height: h,
      display: 'block'
    }}>
    {neg && <line x1="0" x2="100" y1={h / 2} y2={h / 2} stroke="var(--rule2)" strokeWidth=".3" vectorEffect="non-scaling-stroke"></line>}
    {data.map((d, i) => {
        const bh = Math.abs(d.v) / max * (neg ? h / 2 - 4 : h - 4);
        const y = neg ? d.v >= 0 ? h / 2 - bh : h / 2 : h - bh;
        return <rect key={i} x={i * w + w * .15} width={w * .7} y={y} height={Math.max(bh, .5)} fill={d.v < 0 ? 'var(--err)' : d.hi ? 'var(--ink)' : 'var(--steel)'} opacity={d.hi || d.v < 0 ? 1 : .55}><title>{d.k + ': ' + fmt(d.v)}</title></rect>;
      })}
  </svg><div className="rp-axis"><span>{data[0].k}</span>{label && <span>{label}</span>}<span>{data[data.length - 1].k}</span></div></div>;
}
function rpTicks(min, max, n = 4) {
  const span = max - min || 1,
    raw = span / n,
    mag = Math.pow(10, Math.floor(Math.log10(raw))),
    step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const lo = Math.floor(min / step) * step,
    hi = Math.ceil(max / step) * step,
    t = [];
  for (let v = lo; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6));
  return t;
}
const rpShort = v => {
  const a = Math.abs(v),
    s = v < 0 ? '−' : '';
  return s + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k' : Math.round(a));
};
function RpChart({
  data,
  kind = 'bar',
  h = 190,
  fmt = v => v,
  money: isM
}) {
  const ref = React.useRef(null),
    [w, setW] = React.useState(600),
    [hov, setHov] = React.useState(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => setW(el.clientWidth);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const vals = kind === 'cum' ? data.reduce((a, d) => [...a, (a.length ? a[a.length - 1] : 0) + d.v], []) : data.map(d => d.v);
  const ticks = rpTicks(Math.min(0, ...vals), Math.max(0, ...vals)),
    lo = ticks[0],
    hi = ticks[ticks.length - 1];
  const L = 44,
    R = 8,
    T = 10,
    B = 24,
    iw = Math.max(10, w - L - R),
    ih = h - T - B;
  const y = v => T + ih - (v - lo) / (hi - lo || 1) * ih,
    step = iw / data.length,
    x = i => L + step * i + step / 2;
  const pts = vals.map((v, i) => [x(i), y(v)]),
    line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L' + x(vals.length - 1).toFixed(1) + ' ' + y(Math.max(lo, 0)) + ' L' + x(0).toFixed(1) + ' ' + y(Math.max(lo, 0)) + ' Z';
  const lab = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(data.length * 3 / 4), data.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const move = e => {
    const bx = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - bx.left - L) / step);
    setHov(i >= 0 && i < data.length ? i : null);
  };
  return <div ref={ref} className="rpc" style={{
    position: 'relative'
  }}>
    <svg width={w} height={h} onMouseMove={move} onMouseLeave={() => setHov(null)} style={{
      display: 'block'
    }}>
      {ticks.map(t => <g key={t}><line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'rgba(10,11,13,.28)' : 'rgba(10,11,13,.08)'}></line><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5A6470" fontFamily="JetBrains Mono">{isM ? '$' : ''}{rpShort(t)}</text></g>)}
      {kind === 'bar' && vals.map((v, i) => {
        const y0 = y(0),
          y1 = y(v),
          bw = Math.max(2, step * .64);
        return <rect key={i} x={x(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={Math.min(3, bw / 3)} fill={v < 0 ? 'var(--err)' : i === vals.length - 1 || hov === i ? 'var(--ink)' : '#9AA1A9'}></rect>;
      })}
      {kind !== 'bar' && <>{kind !== 'line' && <path d={area} fill="var(--ink)" opacity=".07"></path>}<path d={line} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"></path>
        {kind === 'area' && vals.map((v, i) => v < 0 && <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r="3.5" fill="var(--err)" stroke="#fff" strokeWidth="1.5"></circle>)}
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--lime)" stroke="var(--ink)" strokeWidth="1.5"></circle></>}
      {hov != null && <g><line x1={x(hov)} x2={x(hov)} y1={T} y2={T + ih} stroke="rgba(10,11,13,.25)" strokeDasharray="3 3"></line>{kind !== 'bar' && <circle cx={pts[hov][0]} cy={pts[hov][1]} r="4.5" fill="#fff" stroke="var(--ink)" strokeWidth="2"></circle>}</g>}
      {lab.map(i => <text key={i} x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#5A6470" fontFamily="JetBrains Mono">{data[i].k}</text>)}
    </svg>
    {hov != null && <div className="rpc-tip" style={{
      left: Math.min(Math.max(x(hov), 70), w - 70),
      top: Math.max(0, pts[hov][1] - 52)
    }}><small>{data[hov].k}</small><b>{fmt(vals[hov])}</b>{kind === 'cum' && <span className="muted">day {fmt(data[hov].v)}</span>}</div>}
  </div>;
}
function RpHeat({
  rows
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    f = [.82, .8, .86, .92, 1.25, 1.4, 1.1];
  const m = days.map((_, d) => Array.from({
      length: 24
    }, (_, h) => new Set(rows.filter(r => (new Date(r.at).getUTCDay() + 6) % 7 === d && new Date(r.at).getUTCHours() === h).map(r => r.room + ':' + r.roundId)).size)),
    max = Math.max(1, ...m.flat());
  const [hov, setHov] = React.useState(null);
  return <div className="rph"><div className="rph-g">{m.map((row, d) => <React.Fragment key={d}><span className="rph-d">{days[d]}</span>{row.map((v, h) => <span key={h} className="rph-c" style={{
          background: 'rgba(10,11,13,' + (0.05 + v / max * .9).toFixed(3) + ')'
        }} onMouseEnter={() => setHov([d, h, v])} onMouseLeave={() => setHov(null)}></span>)}</React.Fragment>)}
    <span></span>{Array.from({
        length: 24
      }).map((_, h) => <span key={h} className="rph-x">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)}</div>
    <div className="rph-f"><span className="muted">{hov ? days[hov[0]] + ' ' + String(hov[1]).padStart(2, '0') + ':00 · ' + hov[2] + ' rounds' : 'Hover a cell for the count'}</span><span className="rph-l"><span>Fewer</span>{[.1, .3, .5, .7, .95].map(o => <i key={o} style={{
          background: 'rgba(10,11,13,' + o + ')'
        }}></i>)}<span>More</span></span></div></div>;
}
function RpSeg({
  v,
  set,
  opts
}) {
  return <div className="seg">{opts.map(([k, l]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}</div>;
}
const DS_W = [['stay', 'Average stay', 35], ['ret', 'Came back within 7 days', 25], ['chat', 'Chat with the dealer', 20], ['pos', 'Positive chat', 20]];
function DealerStats({
  RG,
  brand,
  scope
}) {
  const rr = recordedRows(brand, scope).filter(r => RG.cur.some(d => d.d === new Date(r.at).toISOString().slice(0, 10)));
  const rows = runtime.data.dealers.filter(d => !scope?.dealer || scope.dealer === 'all' || d.id === scope.dealer).map(d => ({
    ...d,
    tables: runtime.data.tables.filter(t => t.dealer === d.id && (brand === 'all' || t.brands.includes(brand)) && (!scope?.table || scope.table === 'all' || scope.table === t.id)).length,
    players: new Set(rr.map(r => r.playerId)).size,
    score: null,
    stay: null,
    ret: null,
    chat: null,
    pos: null,
    follow: null,
    early: null,
    rph: null,
    topics: [],
    quotes: []
  }));
  const best = () => null;
  const bar = () => <span className="bar" style={{
    display: 'block',
    flex: 1
  }}><i style={{
      width: 0
    }} /></span>;
  return <>
    <div className="ds-cards">{rows.map((d, i) => <article key={d.id} className="ds-card">
      <div className="ds-h"><img src={assetUrl('/bo/img/' + d.id + '-portrait.jpg')} alt="" /><div><b>{d.name}</b><small>{d.tables} {d.tables === 1 ? 'table' : 'tables'}</small></div><div className="ds-sc"><span>{d.score ?? '—'}</span><small>score</small></div></div>
      <div className="ds-parts">{DS_W.map(([k, l]) => <div key={k}><span>{l}</span>{bar(k === 'stay' ? d.stay : k === 'chat' ? d.chat : d[k], k === 'stay' ? 40 : k === 'chat' ? 20 : 100, best(k) === d.id)}<b className="mono">Not recorded</b></div>)}</div>
    </article>)}</div>
    <section className="panel"><div className="panel-h"><h2>Compare dealers</h2><span className="muted" style={{
          fontSize: 12.5
        }}>{RG.label} · {brand === 'all' ? 'All brands' : brandName(brand)}</span></div>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Dealer</th><th className="num">Players</th><th className="num">Avg stay</th><th className="num">Came back ≤ 7 d</th><th className="num">Chat / hour</th><th className="num">Positive chat</th><th className="num">Followed to new table</th><th className="num">Left in first 5 min</th><th className="num">Rounds / hour</th><th className="num">Score</th></tr></thead>
        <tbody>{rows.map(d => <tr key={d.id}><td><span className="who-row" style={{
                  gap: 8
                }}><img className="pic" style={{
                    width: 26,
                    height: 26
                  }} src={assetUrl('/bo/img/' + d.id + '-portrait.jpg')} alt="" /><b style={{
                    fontWeight: 600
                  }}>{d.name}</b></span></td>
          <td className="num mono">{d.players}</td>
          {[['stay', v => v + ' min'], ['ret', v => v + '%'], ['chat', v => v.toFixed(1)], ['pos', v => v + '%'], ['follow', v => v + '%']].map(([k, fm]) => <td key={k} className={'num mono' + (best(k) === d.id ? ' ds-best' : '')}>Not recorded</td>)}
          <td className={'num mono' + (d.early === Math.min(...rows.map(x => x.early)) ? ' ds-best' : d.early > 15 ? ' neg' : '')}>Not recorded</td>
          <td className="num mono">Not recorded</td><td className="num"><b className="mono" style={{
                  fontSize: 15
                }}>{d.score ?? '—'}</b></td></tr>)}</tbody></table></div>
      <div className="note">A score requires recorded session and chat metrics. These are not supplied by the current game service.</div></section>
    <div className="two">
      <section className="panel"><div className="panel-h"><h2>Average stay</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Minutes per session</span></div>
        <div className="rows">{rows.map(d => <div key={d.id} style={{
            alignItems: 'center'
          }}><span style={{
              width: 70,
              flex: 'none',
              color: 'var(--ink)'
            }}>{d.name}</span>{bar(d.stay, 40, best('stay') === d.id)}<span className="mono" style={{
              width: 60,
              textAlign: 'right'
            }}>Not recorded</span></div>)}</div></section>
      <section className="panel"><div className="panel-h"><h2>What players say</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Table chat, grouped by topic</span></div>
        <div className="ds-say">{rows.map(d => <div key={d.id}><b>{d.name}</b><div className="rp-stack" style={{
              height: 10
            }}>{d.topics.map(([t, v]) => <span key={t} title={t + ' ' + v + '%'} style={{
                width: v + '%',
                background: {
                  Praise: '#0A0B0D',
                  'Rules questions': '#8E9096',
                  'Small talk': '#C9C7C1',
                  Complaints: 'var(--err)'
                }[t]
              }}></span>)}</div><small className="muted">Chat history has not been recorded.</small></div>)}
          <div className="rp-leg">{[['Praise', '#0A0B0D'], ['Rules questions', '#8E9096'], ['Small talk', '#C9C7C1'], ['Complaints', 'var(--err)']].map(([k, c]) => <div key={k}><i style={{
                background: c
              }}></i><span>{k}</span></div>)}</div></div></section>
    </div>
    <div className="note" style={{
      borderRadius: 8,
      border: '1px solid var(--rule)'
    }}>Only Astrid runs in the shared game. Player counts come from settled rounds; unavailable telemetry is left empty.</div>
  </>;
}
function Statistics({
  brand
}) {
  const [tab, setTab] = React.useState('overview'),
    [scope, setScope] = React.useState(RP_S0);
  const [gk, setGk] = React.useState('area'),
    [pk, setPk] = React.useState('line'),
    [hk, setHk] = React.useState('heat');
  const [per, setPer] = React.useState({
    k: '30d'
  });
  const RG = rpRange(per),
    cur = rpRecordedDays(RG.cur, brand, scope),
    n = cur.length,
    sc = 1,
    prev = rpRecordedDays(RG.prev, brand, scope),
    selected = recordedRows(brand, scope).filter(r => RG.cur.some(d => d.d === new Date(r.at).toISOString().slice(0, 10))),
    hands = selected.flatMap(r => r.hands ?? []),
    RP_HOURS = Array.from({
      length: 24
    }, (_, h) => new Set(selected.filter(r => new Date(r.at).getUTCHours() === h).map(r => r.room + ':' + r.roundId)).size);
  const A = rpAgg(cur),
    P = rpAgg(prev),
    ch = (a, b) => b ? (a - b) / Math.abs(b) * 100 : 0;
  const kpis = [['GGR', money(A.ggr * sc, true), ch(A.ggr, P.ggr)], ['Hold', A.hold.toFixed(2) + '%', A.hold - P.hold, 'pt'], ['Settled stakes', money(A.stakes * sc), ch(A.stakes, P.stakes)], ['Rounds', Math.round(A.rounds * sc).toLocaleString('en-US'), ch(A.rounds, P.rounds)], ['Active players', Math.round(A.players / Math.max(1, n) * sc) + ' / day', ch(A.players, P.players)], ['Average stake / round', money(A.avg), ch(A.avg, P.avg)], ['Avg session', 'Not recorded', 0], ['Table uptime', 'Not recorded', 0]];
  const chron = [...cur].reverse(),
    short = d => d.slice(5).replace('-', '/');
  const pc = f => hands.length ? hands.filter(f).length / hands.length * 100 : 0;
  const out = [['Player wins', pc(h => handOutcome(h) === 'Win')], ['Blackjack', pc(h => handOutcome(h) === 'Blackjack')], ['Push', pc(h => handOutcome(h) === 'Push')], ['Player loses', pc(h => handOutcome(h) === 'Lose')], ['Player busts', pc(h => handOutcome(h) === 'Bust')], ['Includes insurance', pc(h => !!h.insured)]];
  const bets = [5, 10, 25, 50, 100, 250].map((v, i, a) => ['$' + v + (i === 5 ? '+' : ''), Math.round(pc(h => h.stake >= v && (i === 5 || h.stake < a[i + 1])))]);
  const peak = RP_HOURS.indexOf(Math.max(...RP_HOURS));
  return <>
    <PageH title="Statistics" sub="The key figures for the live casino over a period, compared with the period before." src={assetUrl("transactions.mjs summary \xB7 game-audit.mjs \xB7 shared game")} right={<div className="filters"><div className="seg">{[['overview', 'Overview'], ['dealers', 'Dealers']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div><RpPeriod p={per} set={setPer} /></div>} />
    {tab === 'dealers' ? <div className="page-b"><div className="panel" style={{
        padding: '10px 16px'
      }}><RpScope s={scope} set={setScope} /></div><DealerStats RG={RG} brand={brand} scope={scope} /></div> : <div className="page-b">
      <div className="panel" style={{
        padding: '10px 16px'
      }}><RpScope s={scope} set={setScope} /></div>
      {rpScopeK(scope) === 0 && <div className="legacy-note"><Badge status="closed">No data</Badge><div>There are no settled rounds for this selection yet.</div></div>}
      <div className="metrics4">{kpis.map(([l, v, d, u]) => <div key={l} className="metric"><span>{l}</span><b>{v}</b>{typeof v === 'string' && v === 'Not recorded' ? <small className="muted">No telemetry source</small> : RG.cmp ? <small className={'rp-d' + (d < 0 ? ' down' : '')}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}{u ? ' ' + u : '%'} vs previous {n} {n === 1 ? 'day' : 'days'}</small> : <small className="muted" style={{
            fontSize: 12
          }}>No earlier period to compare</small>}</div>)}</div>
      <div className="two">
        <section className="panel"><div className="panel-h wrap"><div><h2>GGR per day</h2><div className="rp-sum"><span>Total <b>{money(chron.reduce((n, x) => n + x.stakes * x.hold / 100 * sc, 0), true)}</b></span><span>Best <b>{money(Math.max(...chron.map(x => x.stakes * x.hold / 100 * sc)), true)}</b></span><span>Days lost <b className={chron.some(x => x.hold < 0) ? 'neg' : ''}>{chron.filter(x => x.hold < 0).length}</b></span></div></div><RpSeg v={gk} set={setGk} opts={[['bar', 'Bars'], ['area', 'Line'], ['cum', 'Running total']]} /></div><div style={{
            padding: '0 12px 12px'
          }}><RpChart money kind={gk} data={chron.map(x => ({
              k: short(x.d),
              v: x.stakes * x.hold / 100 * sc
            }))} fmt={v => money(v, true)} /></div></section>
        <section className="panel"><div className="panel-h wrap"><div><h2>Active players per day</h2><div className="rp-sum"><span>Average <b>{Math.round(chron.reduce((n, x) => n + x.players, 0) / chron.length * sc)}</b></span><span>Peak <b>{Math.round(Math.max(...chron.map(x => x.players)) * sc)}</b></span><span>New <b>{Math.round(A.fresh * sc)}</b></span></div></div><RpSeg v={pk} set={setPk} opts={[['bar', 'Bars'], ['line', 'Line']]} /></div><div style={{
            padding: '0 12px 12px'
          }}><RpChart kind={pk === 'line' ? 'area' : 'bar'} data={chron.map(x => ({
              k: short(x.d),
              v: Math.round(x.players * sc)
            }))} fmt={v => v + ' players'} /></div></section>
      </div>
      <div className="two">
        <section className="panel"><div className="panel-h wrap"><div><h2>Busiest hours</h2><div className="rp-sum"><span>Peak <b>UTC {String(peak).padStart(2, '0')}:00</b></span><span>Quietest <b>{String(RP_HOURS.indexOf(Math.min(...RP_HOURS))).padStart(2, '0')}:00</b></span></div></div><RpSeg v={hk} set={setHk} opts={[['heat', 'Week × hour'], ['bar', 'By hour']]} /></div><div style={{
            padding: '0 16px 16px'
          }}>{hk === 'heat' ? <RpHeat rows={selected} /> : <RpChart kind="bar" h={170} data={RP_HOURS.map((v, h) => ({
              k: String(h).padStart(2, '0') + ':00',
              v: Math.round(v * sc)
            }))} fmt={v => v + ' rounds'} />}</div></section>
        <section className="panel"><div className="panel-h"><h2>Hand outcomes</h2><span className="muted" style={{
              fontSize: 12.5
            }}>Share of player hands</span></div>
          <div style={{
            padding: '0 16px 14px',
            display: 'grid',
            gap: 12
          }}><div className="rp-stack">{out.map(([k, v], i) => <span key={k} title={k + ' ' + v + '%'} style={{
                width: v + '%',
                background: ['#0A0B0D', '#D6FF3A', '#C9C7C1', '#8E9096', 'var(--err)', '#9778b5'][i]
              }}></span>)}</div>
            <div className="rp-leg">{out.map(([k, v], i) => <div key={k}><i style={{
                  background: ['#0A0B0D', '#D6FF3A', '#C9C7C1', '#8E9096', 'var(--err)', '#9778b5'][i]
                }}></i><span>{k}</span><b className="mono">{v.toFixed(1)}%</b></div>)}</div></div>
          <div className="note">Recorded hand results. Dealer aggregate statistics are not available in historical receipts.</div></section>
      </div>
      <div className="two">
        <section className="panel"><div className="panel-h"><h2>Bet sizes</h2><span className="muted" style={{
              fontSize: 12.5
            }}>Share of main bets</span></div>
          <div className="rows">{bets.map(([k, v]) => <div key={k} style={{
              alignItems: 'center'
            }}><span className="mono" style={{
                width: 60,
                flex: 'none',
                color: 'var(--ink)'
              }}>{k}</span><span style={{
                flex: 1
              }}><span className="bar" style={{
                  display: 'block'
                }}><i style={{
                    width: v * 3 + '%'
                  }}></i></span></span><span className="mono" style={{
                width: 48,
                textAlign: 'right'
              }}>{v}%</span></div>)}</div></section>
        <section className="panel"><div className="panel-h"><h2>Game features</h2></div>
          <div className="rows">
            <div><span>Rounds with a side bet</span><span className="mono">{(A.side * 100).toFixed(1)}%</span></div>
            <div><span>Insurance taken when offered</span><span className="mono">Not recorded</span></div>
            <div><span>Hands doubled</span><span className="mono">{pc(h => h.doubled).toFixed(1)}%</span></div>
            <div><span>Hands split</span><span className="mono">{pc(h => h.splitFrom != null).toFixed(1)}%</span></div>
            <div><span>Decisions timed out</span><span className="mono">Not recorded</span></div>
            <div><span>Players on more than one box</span><span className="mono">{selected.length ? (selected.filter(r => new Set((r.hands ?? []).map(h => h.box)).size > 1).length / selected.length * 100).toFixed(1) : 0}%</span></div>
            <div><span>New players</span><span className="mono">{Math.round(A.fresh * sc)}</span></div>
            <div><span>Incidents</span><span className="mono">Not recorded</span></div>
          </div></section>
      </div>
      <section className="panel"><div className="panel-h"><h2>By brand</h2></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Brand</th><th className="num">Active players</th><th className="num">Rounds</th><th className="num">Stakes</th><th className="num">GGR</th><th className="num">Hold</th><th className="num">Avg stake / round</th></tr></thead>
          <tbody>{runtime.data.brands.filter(b => brand === 'all' || b.id === brand).map((b, i) => {
                const s = b.id === 'scout' ? 1 : 0,
                  h = A.hold;
                return <tr key={b.id}><td>{b.name}</td><td className="num mono">{Math.round(A.players / n * s)}</td><td className="num mono">{Math.round(A.rounds * s).toLocaleString('en-US')}</td><td className="num mono">{money(A.stakes * s)}</td><td className="num mono">{money(A.stakes * s * h / 100, true)}</td><td className="num mono">{s && A.stakes ? h.toFixed(2) + '%' : '—'}</td><td className="num mono">{money(A.avg * s)}</td></tr>;
              })}</tbody></table></div>
        <div className="note">Recorded demo settlements only. Operator brand attribution is not recorded; the shared demo is shown under Scout Gaming.</div></section>
    </div>}
  </>;
}

// Source: v-settings.jsx at 7dee0901; see source-provenance.json.
const SX = runtime.data2;
const ROLE_D = {
  reader: 'Read-only legacy libraries and design previews. Only this fictional operator is shown.',
  staff: 'Content and design previews. Live dealer changes and player blocks are not supported.',
  admin: 'Game reporting, shared design drafts and API keys. Team changes require superadmin.',
  superadmin: 'All supported backoffice endpoints, including account administration.'
};
const ROLE_N = {
  reader: 'Reader',
  staff: 'Staff',
  admin: 'Admin',
  superadmin: 'Super admin'
};
const TM_PERMS = [['Casino live, players, statistics', [1, 1, 1, 1]], ['Change dealer, block players', [0, 1, 1, 1]], ['Test tables', [0, 1, 1, 1]], ['Transactions and reports', [1, 1, 1, 1]], ['Export and schedule reports', [0, 0, 1, 1]], ['Games, tables and limits', [0, 0, 1, 1]], ['Branding and publishing', [0, 0, 1, 1]], ['API keys and wallet', [0, 0, 1, 1]], ['Team & access', [0, 0, 1, 1]], ['Change other admins', [0, 0, 0, 1]]];
const TM_EXTRA = {};
const TM_LOG = (runtime.raw.workspace.activity ?? []).map(e => [e.at, e.username, e.action, e.target]);
const TM_LV = [['none', 'No access'], ['view', 'View'], ['edit', 'Edit']];
const tmRank = v => ({
  none: 0,
  view: 1,
  edit: 2
})[v] || 0;
const tmClamp = (acc, max) => Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, tmRank(v) > tmRank(max[k]) ? max[k] : v]));
const tmSame = (a, b) => Object.keys(b).every(k => (a[k] || 'none') === b[k]);
function AccessEditor({
  value,
  onChange,
  max
}) {
  const groups = [...NAV.map(g => [g.group, g.items]), ['Studio', STUDIO]];
  const setAll = (items, v) => {
    const nx = {
      ...value
    };
    items.forEach(i => {
      nx[i[0]] = tmRank(v) > tmRank(max[i[0]]) ? max[i[0]] : v;
    });
    onChange(nx);
  };
  return <div className="acc-ed">{groups.map(([g, items]) => {
      const lv = items.map(i => value[i[0]] || 'none'),
        same = lv.every(x => x === lv[0]) ? lv[0] : null;
      return <div key={g} className="acc-g">
    <div className="acc-gh"><b>{g}</b><div className="acc-seg">{TM_LV.map(([k, l]) => <button key={k} className={same === k ? 'on' : ''} disabled={items.every(i => tmRank(k) > tmRank(max[i[0]]))} onClick={() => setAll(items, k)}>{l}</button>)}</div></div>
    {items.map(([id, l]) => <div key={id} className="acc-r"><span>{l}</span><div className="acc-seg">{TM_LV.map(([k, lab]) => {
              const dis = tmRank(k) > tmRank(max[id]);
              return <button key={k} className={(value[id] || 'none') === k ? 'on' : ''} disabled={dis} title={dis ? 'You cannot give more access than you have' : ''} onClick={() => onChange({
                ...value,
                [id]: k
              })}>{lab}</button>;
            })}</div></div>)}
  </div>;
    })}</div>;
}
function TeamInvite({
  onClose,
  onSend,
  myRole
}) {
  const max = tmMine(myRole),
    roles = ['reader', 'staff', 'admin'].filter(r => myRole === 'superadmin' || r !== 'admin' || true);
  const [emails, setEmails] = React.useState(''),
    [role, setRole] = React.useState('staff'),
    [brands, setBrands] = React.useState('all'),
    [acc, setAcc] = React.useState(() => tmClamp(tmPreset('staff'), max)),
    [custom, setCustom] = React.useState(false);
  const list = emails.split(/[\s,;]+/).filter(Boolean),
    bad = list.filter(e => !/^\S+@\S+\.\S+$/.test(e));
  const pickRole = r => {
    setRole(r);
    setAcc(tmClamp(tmPreset(r), max));
  };
  const clamped = !tmSame(tmClamp(tmPreset(role), max), tmPreset(role));
  return <Modal open title="Invite people" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!list.length || bad.length > 0} onClick={() => onSend(list, role, brands, acc)}>Send {list.length > 1 ? list.length + ' invites' : 'invite'}</button></>}>
    <div style={{
      display: 'grid',
      gap: 16
    }}>
      <div className="field"><label htmlFor="tm-e">Email addresses</label><textarea id="tm-e" className="input" style={{
          height: 56,
          padding: 10,
          resize: 'vertical'
        }} placeholder="name@company.com, another@company.com" value={emails} onChange={e => setEmails(e.target.value)}></textarea>{bad.length > 0 && <span className="row-issue is-error">Check: {bad.join(', ')}</span>}</div>
      <div className="field"><label>Start from a role</label><div className="seg">{roles.map(r => <button key={r} className={role === r ? 'on' : ''} onClick={() => pickRole(r)}>{ROLE_N[r]}</button>)}</div><span className="muted" style={{
          fontSize: 12.5
        }}>{ROLE_D[role]}{clamped ? ' Limited to what you can do yourself.' : ''}</span></div>
      <div className="field"><label>Brand access</label><div className="filters"><button className={'chip' + (brands === 'all' ? ' on' : '')} onClick={() => setBrands('all')}>All brands</button>{runtime.data.brands.map(b => {
            const on = Array.isArray(brands) && brands.includes(b.id);
            return <button key={b.id} className={'chip' + (on ? ' on' : '')} onClick={() => {
              const cur = Array.isArray(brands) ? brands : [];
              const nx = on ? cur.filter(x => x !== b.id) : [...cur, b.id];
              setBrands(nx.length ? nx : 'all');
            }}>{b.name}</button>;
          })}</div></div>
      <div className="field"><label style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>Pages they can use<button className="btn sm ghost" onClick={() => setCustom(!custom)}>{custom ? 'Hide' : 'Customise'}</button></label>
        {custom ? <AccessEditor value={acc} onChange={setAcc} max={max} /> : <span className="muted" style={{
          fontSize: 12.5
        }}>{Object.values(acc).filter(v => v === 'edit').length} pages with edit, {Object.values(acc).filter(v => v === 'view').length} view only{!tmSame(acc, tmClamp(tmPreset(role), max)) ? ' · customised' : ''}.</span>}</div>
    </div></Modal>;
}
function Team({
  toast,
  role: myRole = 'superadmin'
}) {
  return <ScopedTeamPreview />;
}
function LegacyTeamReference({
  toast,
  role: myRole = 'superadmin'
}) {
  const [users, setUsers] = React.useState(() => SX.users.map(u => ({
      ...u,
      ...(TM_EXTRA[u.username] || {})
    }))),
    [tab, setTab] = React.useState('members'),
    [inv, setInv] = React.useState(false),
    [confirm, setConfirm] = React.useState(null),
    [q, setQ] = React.useState(''),
    [accFor, setAccFor] = React.useState(null),
    [accDraft, setAccDraft] = React.useState(null),
    [, rer] = React.useState(0);
  const myMax = tmMine(myRole),
    accOf = u => tmAccessOf(u.username, u.role);
  const openAcc = u => {
    setAccFor(u);
    setAccDraft(accOf(u));
  };
  const canEdit = u => !u.self && myRole === 'superadmin';
  const act = users.filter(u => u.active),
    pend = users.filter(u => !u.active);
  const shown = act.filter(u => !q || (u.name + u.email + u.username).toLowerCase().includes(q.toLowerCase()));
  const brandCell = b => b === 'all' ? <span className="muted">All brands</span> : <BrandTags ids={b} />;
  const av = u => (u.name || u.username).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return <>
    <PageH title="Team & access" sub="Who can sign in to the back office, what they can do, and for which brands." src={assetUrl("bo.mjs \xB7 users \xB7 /api/bo/users")} right={<div className="td-actions"><Badge status="paused">Admins only</Badge><button className="btn primary" disabled={myRole !== 'superadmin'} onClick={() => setInv(true)}>Invite people</button></div>} />
    <div className="page-b">
      <div className="ops-m">
        <div className="ops-mi"><span>Members</span><b>{act.length}</b><small>{act.filter(u => isAdmin(u.role)).length} admins</small></div>
        <div className={'ops-mi' + (pend.length ? ' warn' : '')}><span>Pending invites</span><b>{pend.length}</b><small>Expire after 72 hours</small></div>
        <div className={'ops-mi' + (act.some(u => !u.mfa) ? ' warn' : '')}><span>Two-step sign-in</span><b>Not recorded</b><small>No MFA telemetry from this service</small></div>
        <div className="ops-mi"><span>Active today</span><b>—</b><small>Last sign-in is not recorded</small></div>
      </div>
      <section className="panel">
        <div style={{
          padding: '4px 16px 0',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap'
        }}>{[['members', 'Members', act.length], ['invites', 'Invites', pend.length], ['roles', 'Roles & permissions'], ['log', 'Activity']].map(([k, l, n]) => <button key={k} className={'pv-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>)}</div>
        {tab === 'members' && <>
          <div className="panel-h"><input className="input" style={{
              width: 280
            }} placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} /><span className="muted" style={{
              fontSize: 12.5
            }}>You are signed in as {ROLE_N[myRole]}</span></div>
          <div className="scroll-x"><table className="tbl pl-tbl"><thead><tr><th>Member</th><th>Role</th><th>Brands</th><th>Two-step sign-in</th><th>Last active</th><th></th></tr></thead>
            <tbody>{shown.map(u => <tr key={u.username}>
              <td><div className="pl-who"><span className="pl-av">{av(u)}</span><span><b>{u.name || u.username}{u.self && <span className="pill" style={{
                            marginLeft: 8
                          }}>You</span>}</b><small>{u.email}</small></span></div></td>
              <td>{canEdit(u) ? <select className="select" value={u.role} onChange={e => {
                      const r = e.target.value;
                      setConfirm({
                        title: 'Change role for ' + (u.name || u.username),
                        body: ROLE_N[u.role] + ' → ' + ROLE_N[r] + '. ' + ROLE_D[r],
                        cta: 'Change role',
                        ok: () => {
                          api('/api/bo/users/role', {
                            username: u.username,
                            role: r
                          }).then(() => {
                            setUsers(us => us.map(x => x.username === u.username ? {
                              ...x,
                              role: r
                            } : x));
                            toast('Role updated');
                          }).catch(notifyError);
                        }
                      });
                    }}>{Object.keys(ROLE_N).filter(r => myRole === 'superadmin' || r !== 'superadmin').map(r => <option key={r} value={r}>{ROLE_N[r]}</option>)}</select> : <span className="tm-role">{ROLE_N[u.role]}</span>}{u.role !== 'superadmin' && !tmSame(accOf(u), tmPreset(u.role)) && <span className="pill" style={{
                      marginLeft: 6
                    }}>Custom</span>}</td>
              <td>{brandCell(u.brands || 'all')}</td>
              <td><span className="muted">Not recorded</span></td>
              <td className="mono muted">{u.last || 'Not recorded'}</td>
              <td style={{
                    textAlign: 'right'
                  }}><div style={{
                      display: 'inline-flex',
                      gap: 6
                    }}>{canEdit(u) && u.role !== 'superadmin' && <button className="btn sm" onClick={() => openAcc(u)}>Access</button>}<button className="btn sm" onClick={() => api('/api/bo/users/resend', {
                        username: u.username
                      }).then(r => toast(r.emailSent ? 'Password reset sent' : 'Not sent: ' + r.reason)).catch(notifyError)}>Reset password</button>{canEdit(u) && <button className="btn sm ghost" style={{
                        color: 'var(--err)'
                      }} onClick={() => setConfirm({
                        title: 'Remove ' + (u.name || u.username),
                        danger: true,
                        body: 'They lose access immediately and are signed out on every device.',
                        cta: 'Remove member',
                        ok: () => {
                          api('/api/bo/users/remove', {
                            username: u.username
                          }).then(() => {
                            setUsers(us => us.filter(x => x.username !== u.username));
                            toast('Member removed');
                          }).catch(notifyError);
                        }
                      })}>Remove</button>}</div></td>
            </tr>)}</tbody></table></div></>}
        {tab === 'invites' && (pend.length ? <div className="scroll-x"><table className="tbl"><thead><tr><th>Email</th><th>Role</th><th>Brands</th><th>Sent</th><th></th></tr></thead>
          <tbody>{pend.map(u => <tr key={u.username}><td>{u.email}</td><td>{ROLE_N[u.role]}</td><td>{brandCell(u.brands || 'all')}</td><td className="mono muted">{u.since}</td><td style={{
                  textAlign: 'right'
                }}><div style={{
                    display: 'inline-flex',
                    gap: 6
                  }}><button className="btn sm" onClick={() => api('/api/bo/users/resend', {
                      username: u.username
                    }).then(r => toast(r.emailSent ? 'Invite sent' : 'Not sent: ' + r.reason)).catch(notifyError)}>Resend</button><button className="btn sm ghost" style={{
                      color: 'var(--err)'
                    }} onClick={() => {
                      api('/api/bo/users/remove', {
                        username: u.username
                      }).then(() => {
                        setUsers(us => us.filter(x => x.username !== u.username));
                        toast('Invite revoked');
                      }).catch(notifyError);
                    }}>Revoke</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No pending invites" body="Invite someone and they appear here until they accept." action={<button className="btn primary" disabled={myRole !== 'superadmin'} onClick={() => setInv(true)}>Invite people</button>} />)}
        {tab === 'roles' && <div className="scroll-x"><table className="tbl tm-perm"><thead><tr><th>Page</th>{Object.keys(ROLE_N).map(r => <th key={r} className="num">{ROLE_N[r]}</th>)}</tr></thead>
          <tbody><tr className="tm-desc"><td className="muted">What the role is for</td>{Object.keys(ROLE_N).map(r => <td key={r} className="muted">{ROLE_D[r]}</td>)}</tr>
            {[...NAV.map(g => [g.group, g.items]), ['Studio', STUDIO]].map(([g, items]) => <React.Fragment key={g}><tr className="ops-grp"><td colSpan="5">{g}</td></tr>{items.map(([id, l]) => <tr key={id}><td>{l}</td>{Object.keys(ROLE_N).map(r => {
                    const v = tmPreset(r)[id];
                    return <td key={r} className="num">{v === 'edit' ? <span className="tm-yes">Edit</span> : v === 'view' ? <span className="tm-view">View</span> : <span className="muted">—</span>}</td>;
                  })}</tr>)}</React.Fragment>)}</tbody></table>
          <div className="note">These are starting points. The server enforces role-based access. The page-level matrix is a preview; custom overrides are not active.</div></div>}
        {tab === 'log' && <table className="tbl"><thead><tr><th>Time</th><th>Member</th><th>Action</th><th>Details</th></tr></thead><tbody>{TM_LOG.map((l, i) => <tr key={i}><td className="mono muted">{l[0]}</td><td>{l[1]}</td><td>{l[2]}</td><td className="muted">{l[3]}</td></tr>)}</tbody></table>}
      </section>
    </div>
    {inv && <TeamInvite myRole={myRole} onClose={() => setInv(false)} onSend={async (list, r, b, acc) => {
      try {
        if (!tmSame(acc, tmPreset(r))) throw Error('Custom page permissions are not supported by the server. Select a standard role.');
        if (b !== 'all') throw Error('Brand-restricted accounts require an operator tenancy connection.');
        for (const email of list) {
          const reply = await api('/api/bo/users/invite', {
            email,
            role: r
          });
          setUsers(us => [...us, {
            username: email,
            email,
            role: r,
            active: false,
            since: new Date().toISOString(),
            brands: 'all'
          }]);
          toast(reply.emailSent ? 'Invite sent to ' + email : 'Account created; email not sent: ' + reply.reason);
        }
        setInv(false);
        setTab('invites');
      } catch (e) {
        notifyError(e);
      }
    }} />}
    {accFor && <Drawer open onClose={() => setAccFor(null)} width={620}>
      <div className="dr-h"><div><div className="muted" style={{
            fontSize: 12.5
          }}>{ROLE_N[accFor.role]} · {accFor.email}</div><h2>Access for {accFor.name || accFor.username}</h2></div><button className="btn ghost sm" onClick={() => setAccFor(null)}>Close</button></div>
      <div className="dr-issue is-live">Preview page access for {accFor.name || accFor.username}. Custom overrides are not active on the server. {myRole !== 'superadmin' ? 'You can only give access you have yourself.' : 'As super admin you can give any access.'}</div>
      <div className="dr-b" style={{
        paddingTop: 16
      }}>
        <div className="filters" style={{
          marginBottom: 12
        }}><span className="muted" style={{
            fontSize: 13
          }}>Reset to</span>{['reader', 'staff', 'admin'].map(r => <button key={r} className="btn sm" onClick={() => setAccDraft(tmClamp(tmPreset(r), myMax))}>{ROLE_N[r]}</button>)}</div>
        <AccessEditor value={accDraft} onChange={setAccDraft} max={myMax} />
      </div>
      <div className="modal-f" style={{
        position: 'sticky',
        bottom: 0,
        borderRadius: 0
      }}><button className="btn" onClick={() => setAccFor(null)}>Cancel</button><button className="btn primary" onClick={() => {
          unavailable('Custom page permissions');
        }}>Save access</button></div>
    </Drawer>}
    <Confirm state={confirm} onClose={() => setConfirm(null)} />
  </>;
}
function Emails({
  toast
}) {
  return <>
    <PageH title="Emails" sub="Player email templates. Transactional and lifecycle. Preview only." src={assetUrl("bo.mjs \xB7 emails \xB7 /bo/emails/*.html")} />
    <div className="page-b">
      <div className="legacy-note"><Badge status="warning">Question</Badge><div><b>Scout branding in player emails</b>The templates use the Scout brand and link to bettalotto.se. Operators normally send player emails in their own brand.</div></div>
      <div className="grid-cards" style={{
        gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))'
      }}>{SX.emails.map(([f, label]) => <article key={f} className="vcard">
        <iframe className="email-frame" src={assetUrl('/bo/emails/' + f + '.html')} title={label} scrolling="no" style={{
            pointerEvents: 'none'
          }}></iframe>
        <div className="vcard-f" style={{
            alignItems: 'center'
          }}><span style={{
              fontWeight: 600,
              fontSize: 13.5
            }}>{label}</span><a className="btn sm" style={{
              marginLeft: 'auto',
              textDecoration: 'none'
            }} href={'/bo/emails/' + f + '.html'} target="_blank" rel="noopener">Open</a></div>
      </article>)}</div>
    </div>
  </>;
}
function ApiKeys({
  toast
}) {
  const [keys, setKeys] = React.useState(SX.keys),
    [fresh, setFresh] = React.useState(null),
    [launch, setLaunch] = React.useState(null),
    [confirm, setConfirm] = React.useState(null);
  const [f, setF] = React.useState({
    name: '',
    wallet: '',
    ip: '',
    brand: runtime.data.brands[0].id,
    scopes: SX.scopes.map(s => s[0])
  });
  const reloadKeys = async () => {
    const r = await api('/api/bo/apikeys');
    setKeys(r.keys.map(k => ({
      ...k,
      wallet: k.wallet_url,
      revoked: k.revoked_at,
      lastUsed: k.last_used ?? 'never',
      created: k.created_at,
      by: k.created_by
    })));
  };
  const create = async () => {
    try {
      if (!f.name.trim()) throw Error('Enter a partner name');
      const r = await api('/api/bo/apikeys/create', {
        name: f.name,
        scopes: f.scopes,
        walletUrl: f.wallet,
        ipAllow: f.ip
      });
      setFresh(r.key);
      await reloadKeys();
      setF({
        ...f,
        name: '',
        wallet: '',
        ip: ''
      });
      toast('Key created by server');
    } catch (e) {
      notifyError(e);
    }
  };
  return <>
    <PageH title="API keys" sub="Partner integrations. Signed keys and seamless wallet for the partner backend. Shared-table operator brand attribution is not configured." src={assetUrl("bo.mjs \xB7 apikeys \xB7 partner-api.mjs")} right={<a className="btn" href="#api" target="_blank" rel="noopener" style={{
      textDecoration: 'none'
    }}>Partner API docs</a>} />
    <div className="page-b">
      {fresh && <section className="panel" style={{
        borderColor: 'var(--ink)'
      }}><div className="panel-h"><h2>New key · {fresh.name}</h2><Badge status="warning">Secret shown once</Badge></div>
        <div className="vcard-b" style={{
          paddingTop: 0
        }}><div className="secret">X-Api-Key: <b>{fresh.key}</b><br />Secret: <b>{fresh.secret}</b><br />Scopes: {fresh.scopes.join(', ')}{fresh.wallet && <><br />Wallet URL: {fresh.wallet}</>}</div>
          <p className="muted" style={{
            margin: 0,
            fontSize: 13
          }}>Send both to the partner over a secure channel. Copy the secret now. It is not included in later key listings.</p>
          <div><button className="btn sm" onClick={() => {
              navigator.clipboard && navigator.clipboard.writeText(fresh.key + '\n' + fresh.secret).catch(() => {});
              toast('Copied');
            }}>Copy</button> <button className="btn sm ghost" onClick={() => setFresh(null)}>Done</button></div></div></section>}
      <section className="panel"><div className="panel-h"><h2>Keys <span className="count">{keys.filter(k => !k.revoked).length}</span></h2></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Name</th><th>Brand</th><th>Key</th><th>Scopes</th><th>Wallet</th><th>Last used</th><th>Status</th><th></th></tr></thead>
          <tbody>{keys.map(k => <React.Fragment key={k.id}><tr style={k.revoked ? {
                  color: 'var(--steel)'
                } : null}>
            <td><b style={{
                      fontWeight: 600
                    }}>{k.name}</b><div className="muted" style={{
                      fontSize: 12
                    }}>by {k.by} · {k.created}</div></td>
            <td>{k.brand ? brandName(k.brand) : <span className="muted">—</span>}</td><td className="mono">{k.key}</td>
            <td><div className="btags">{k.scopes.map(s => <span key={s} className="btag">{s}</span>)}</div></td>
            <td>{k.wallet ? 'Seamless' : <span className="muted">Internal demo</span>}</td><td className="mono muted">{k.lastUsed}</td>
            <td>{k.revoked ? <Badge status="closed">Revoked</Badge> : <Badge status="live">Active</Badge>}</td>
            <td style={{
                    textAlign: 'right'
                  }}>{!k.revoked && <div style={{
                      display: 'inline-flex',
                      gap: 6
                    }}>
              <button className="btn sm" onClick={() => api('/api/bo/apikeys/launch', {
                        id: k.id,
                        currency: 'USD'
                      }).then(r => setLaunch({
                        ...r,
                        id: k.id,
                        player: r.playerId,
                        bal: r.balance
                      })).catch(notifyError)}>Test token</button>
              <button className="btn sm" onClick={() => {
                        api('/api/bo/apikeys/rotate', {
                          id: k.id
                        }).then(r => {
                          setFresh({
                            ...k,
                            ...r
                          });
                          toast('Secret rotated');
                        }).catch(notifyError);
                      }}>Rotate secret</button>
              <button className="btn sm ghost" style={{
                        color: 'var(--err)'
                      }} onClick={() => setConfirm({
                        title: 'Revoke ' + k.name,
                        danger: true,
                        body: 'The partner loses access immediately. Players in a round finish it.',
                        cta: 'Revoke key',
                        ok: () => {
                          api('/api/bo/apikeys/revoke', {
                            id: k.id
                          }).then(() => {
                            reloadKeys();
                            toast('Key revoked');
                          }).catch(notifyError);
                        }
                      })}>Revoke</button></div>}</td></tr>
            {launch && launch.id === k.id && <tr><td colSpan="8" style={{
                    whiteSpace: 'normal',
                    height: 'auto',
                    padding: '12px 16px',
                    background: 'var(--paper)'
                  }}>
              <div style={{
                      display: 'grid',
                      gap: 8
                    }}>
                <div className="muted" style={{
                        fontSize: 12.5
                      }}>Test player <span className="mono" style={{
                          color: 'var(--ink)'
                        }}>{launch.player}</span> · USD {launch.bal.toFixed(2)} · token valid 6 h</div>
                <div style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}><a href={launch.url} target="_blank" rel="noopener">Open partner test session →</a><button className="btn sm" onClick={() => navigator.clipboard.writeText(launch.url).then(() => toast('Launch URL copied')).catch(notifyError)}>Copy URL</button><button className="btn sm" onClick={() => {
                          api('/api/bo/apikeys/credit', {
                            id: k.id,
                            playerId: launch.player,
                            amount: 500
                          }).then(r => {
                            setLaunch({
                              ...launch,
                              bal: r.balance
                            });
                            toast('Demo funds added');
                          }).catch(notifyError);
                        }}>Add $500 demo</button></div>
                <pre className="curl">{launch.curlLines?.join(' \\n')}</pre>
              </div></td></tr>}</React.Fragment>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-h"><h2>Create partner key</h2></div>
        <div className="vcard-b" style={{
          paddingTop: 0,
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          maxWidth: 900
        }}>
          <div className="field"><label htmlFor="k-n">Partner name</label><input id="k-n" className="input" placeholder="e.g. Acme Aggregator" value={f.name} onChange={e => setF({
              ...f,
              name: e.target.value
            })} /></div>
          <div className="field"><label htmlFor="k-b">Brand</label><select disabled title="Operator brand mapping is not supported by this partner adapter" id="k-b" className="select" value={f.brand} onChange={e => setF({
              ...f,
              brand: e.target.value
            })}>{runtime.data.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="field"><label htmlFor="k-w">Seamless wallet URL <span className="muted" style={{
                fontWeight: 400
              }}>optional</span></label><input id="k-w" className="input" placeholder="Blank = internal demo wallet" value={f.wallet} onChange={e => setF({
              ...f,
              wallet: e.target.value
            })} /></div>
          <div className="field"><label htmlFor="k-i">IP allowlist <span className="muted" style={{
                fontWeight: 400
              }}>optional</span></label><input id="k-i" className="input" placeholder="Comma separated" value={f.ip} onChange={e => setF({
              ...f,
              ip: e.target.value
            })} /></div>
          <div className="field" style={{
            gridColumn: '1/-1'
          }}><label>Scopes</label><div style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap'
            }}>{SX.scopes.map(([k, l, d]) => <label key={k} className="chk" title={d}><input type="checkbox" checked={f.scopes.includes(k)} onChange={e => setF({
                  ...f,
                  scopes: e.target.checked ? [...f.scopes, k] : f.scopes.filter(s => s !== k)
                })} />{l} <span className="muted">· {d}</span></label>)}</div></div>
          <div><button className="btn primary" onClick={create}>Create key</button></div>
        </div></section>
    </div>
    <Confirm state={confirm} onClose={() => setConfirm(null)} />
  </>;
}

// Source: v-studio.jsx at 7dee0901; see source-provenance.json.
const ST_LOCAL = new Set(['greeting_1', 'placebets_1', 'goodluck_2', 'peek_2', 'double_2', 'bust_2', 'blackjack_1', 'dealerblackjack_1', 'dealerbust_1', 'win_1', 'push_3', 'lose_2', 'sidebet_2', 'chatter2_1']);
const ST_EVENT = {
  greeting: 'Player joins',
  placebets: 'New round, bets open',
  goodluck: 'Bets closed',
  sidebet: 'A side bet wins',
  insurance: 'Insurance offered',
  double: 'Player doubles',
  bust: 'Player hand over 21',
  blackjack: 'Player blackjack wins',
  dealerblackjack: 'Dealer has blackjack',
  dealerbust: 'Dealer over 21',
  win: 'Player wins',
  push: 'Push',
  lose: 'Player loses',
  peek: 'Dealer checks for blackjack',
  farewell: 'Player leaves',
  chatter1: 'Idle chatter',
  chatter2: 'Waiting for a decision'
};
const ST_IDLE = {
  still: 'Still, breathing',
  blink: 'Blinks',
  breath: 'Deeper breath',
  glance: 'Glances aside',
  cheek: 'Hand to cheek',
  insulted: 'Brief offended look'
};
const ST_CONTACT = {
  1: [39, 68],
  2: [38, 63],
  3: [34, 64],
  4: [31, 64],
  5: [27, 60],
  6: [26, 60],
  7: [31, 67],
  dealer: [26, 51],
  hole: [28, 45],
  flip: [31, 33]
};
const ST_PARTS = [['box0', 'Box 0 (far left)', 'deal_pos1'], ['box1', 'Box 1', 'deal_pos2'], ['box2', 'Box 2', 'deal_pos3'], ['box3', 'Box 3 (centre)', 'deal_pos4'], ['box4', 'Box 4', 'deal_pos5'], ['box5', 'Box 5', 'deal_pos6'], ['box6', 'Box 6 (far right)', 'deal_pos7'], ['dealer-up', 'Dealer upcard', 'deal_posdealer'], ['dealer-hole', 'Face-down hole card', 'deal_hole'], ['dealer-flip', 'Hole-card reveal', 'deal_flip'], ['return', 'Return to idle', null], ['idle', 'Idle', 'idle pool · 6 clips']];
const stLocalUrl = id => {
  const m = runtime.raw.game.manifest,
    clip = [...(m?.deal ?? []), ...(m?.idle ?? []), ...(m?.repliker ?? [])].find(x => x.id === id);
  const live = runtime.raw.media?.media?.find(x => (x.id === id || x.sourceUrl === clip?.url) && x.available);
  if (live) return live.url;
  return null;
};
const stExportUrl = () => null;
const stMB = b => (b / 1048576).toFixed(1) + ' MB';
function Preview({
  state,
  onClose
}) {
  if (!state) return null;
  return <div className="scrim center" onClick={onClose}><div className="modal" style={{
      width: 'auto'
    }} onClick={e => e.stopPropagation()}>
    <div className="modal-h"><h2 className="mono" style={{
          fontFamily: 'var(--mono)',
          fontSize: 14
        }}>{state.id}</h2><button className="btn ghost sm" onClick={onClose}>Close</button></div>
    <div className="modal-b" style={{
        display: 'grid',
        gap: 10
      }}><video src={assetUrl(state.url)} controls autoPlay playsInline style={{
          height: 'min(64vh,560px)',
          aspectRatio: '9/16',
          background: '#000',
          borderRadius: 6,
          display: 'block'
        }}></video>{state.text && <p style={{
          margin: 0,
          maxWidth: 315,
          fontSize: 13.5
        }}>“{state.text}”</p>}</div>
  </div></div>;
}
const PlayBtn = ({
  id,
  text,
  on
}) => {
  const u = stLocalUrl(id);
  return u ? <button className="btn sm" onClick={() => on({
    id,
    url: u,
    text
  })}>Play</button> : <button className="btn sm" disabled title="Runtime media is unavailable">Play</button>;
};
function VoiceLines({
  toast
}) {
  const active = runtime.raw.game.manifest,
    prov = useJson('/bo/clip-provenance.json'),
    registered = (runtime.raw.media.media ?? []).filter(m => m.event);
  const man = active ? {
    ...active,
    repliker: registered
  } : null;
  const [ev, setEv] = React.useState('all'),
    [rv, setRv] = React.useState('all'),
    [q, setQ] = React.useState(''),
    [pv, setPv] = React.useState(null);
  const [review, setReview] = React.useState(runtime.raw.config.voiceReview?.astrid || {});
  if (!man) return <PageH title="Voice lines" sub="Runtime manifest unavailable. Check the game connection." />;
  const emil = {};
  (prov && prov.contributions || []).filter(c => c.kind === 'speech').forEach(c => {
    emil[c.events[0]] = c.text;
  });
  const lines = man.repliker.filter(l => (ev === 'all' || l.event === ev) && (rv === 'all' || (rv === 'todo' ? !review[l.id] : review[l.id] === rv)) && (!q || (l.text + l.id).toLowerCase().includes(q.toLowerCase())));
  const events = [...new Set(man.repliker.map(l => l.event))];
  const rc = k => man.repliker.filter(l => k === 'all' || (k === 'todo' ? !review[l.id] : review[l.id] === k)).length;
  const set = async (id, v) => {
    try {
      const verdict = review[id] === v ? null : v;
      await api('/api/bo/voiceline-review', {
        dealer: 'astrid',
        line: id,
        verdict
      });
      const next = {
        ...review,
        [id]: verdict
      };
      runtime.raw.config.voiceReview ??= {};
      runtime.raw.config.voiceReview.astrid = next;
      setReview(next);
      toast('Review saved');
    } catch (e) {
      notifyError(e);
    }
  };
  return <>
    <PageH title="Voice lines" sub={'Registered Astrid lines. Gameplay and training status comes from the current runtime registry. Voice: ' + man.rost.leverantor + ' · ' + man.rost.namn + '.'} src={assetUrl("astrid/public/media/manifest.json \xB7 repliker")} right={<div className="page-kpis"><div><span>Lines</span><b>{man.repliker.length}</b></div><div><span>Events</span><b>{events.length}</b></div><div><span>Confirmed</span><b>{rc('approved')}</b></div></div>} />
    <div className="page-b">
      <section className="panel">
        <div className="panel-h wrap"><div className="filters">
          <select className="select" value={ev} onChange={e => setEv(e.target.value)} aria-label="Event"><option value="all">All events</option>{events.map(e => <option key={e} value={e}>{e} · {ST_EVENT[e]}</option>)}</select>
          <div className="seg">{[['all', 'All'], ['todo', 'Unreviewed'], ['approved', 'Confirmed'], ['rejected', 'Rejected']].map(([k, l]) => <button key={k} className={rv === k ? 'on' : ''} onClick={() => setRv(k)}>{l} {rc(k)}</button>)}</div></div>
          <input className="input" style={{
            width: 240
          }} placeholder="Search text or clip ID" value={q} onChange={e => setQ(e.target.value)} /></div>
        {events.filter(e => lines.some(l => l.event === e)).map(e => <div key={e}>
          <div className="panel-h" style={{
            borderTop: '1px solid var(--rule)',
            background: 'var(--paper)',
            padding: '10px 16px'
          }}><h3>{ST_EVENT[e]} <span className="mono muted" style={{
                fontWeight: 400
              }}>{e}</span></h3>{emil[e] && <span className="muted" style={{
              fontSize: 12.5,
              maxWidth: 460,
              textAlign: 'right'
            }}>Emil’s source take: “{emil[e]}”</span>}</div>
          {lines.filter(l => l.event === e).map(l => <div key={l.id} className="line-card">
            <div style={{
              display: 'grid',
              gap: 4
            }}><p>{l.text}</p><div className="meta"><span className="mono">{l.id}</span><span className="mono">{l.dur.toFixed(2)} s</span><span className="pill">{l.category === 'gameplay' ? 'Gameplay' : 'Legacy · training'}</span>{review[l.id] === 'approved' && <Badge status="live">Confirmed</Badge>}{review[l.id] === 'rejected' && <Badge status="error">Rejected</Badge>}</div></div>
            <div style={{
              display: 'flex',
              gap: 6
            }}><PlayBtn id={l.id} text={l.text} on={setPv} /><button className={'btn sm' + (review[l.id] === 'approved' ? ' on-ok' : '')} onClick={() => set(l.id, 'approved')}>Confirm</button><button className={'btn sm' + (review[l.id] === 'rejected' ? ' on-err' : '')} onClick={() => set(l.id, 'rejected')}>Reject</button></div>
          </div>)}
        </div>)}
        {!lines.length && <EmptyState title="No lines match" body="Change the event, review status or search." />}
      </section>
    </div>
    <Preview state={pv} onClose={() => setPv(null)} />
  </>;
}
function DealingClips({
  toast
}) {
  const man = runtime.raw.game.manifest,
    cat = useJson('/bo/jakob-catalog.json'),
    prov = useJson('/bo/clip-provenance.json');
  const [pv, setPv] = React.useState(null);
  if (!man || !cat || !prov) return <PageH title="Dealing clips" sub="Runtime manifest or catalog unavailable." />;
  const size = {};
  cat.items.forEach(i => {
    const m = /deal_(pos\w+)\//.exec(i.relativePath);
    if (m) size['deal_' + m[1]] = i.size;
  });
  const emil = prov.contributions.filter(c => c.kind !== 'speech');
  return <>
    <PageH title="Dealing clips" sub="Which clip plays when a card goes to each part of the table, and where the card lands in the frame." src={assetUrl("astrid manifest.json \xB7 deal \xB7 card-table-layout.js \xB7 clip-provenance.json")} />
    <div className="page-b">
      <section className="panel"><div className="panel-h"><h2>Assignments · Astrid</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Runtime bindings in the shared game</span></div>
        <div className="parts">{ST_PARTS.map(([k, l, c]) => <div key={k} className={'part' + (c ? '' : ' empty')}><small>{l}</small><span className={c && c.startsWith('deal') ? 'mono' : ''} style={{
              fontSize: 12.5
            }}>{c || 'Legacy · none'}</span></div>)}</div></section>
      <section className="panel"><div className="panel-h"><h2>Deal clips</h2><span className="muted" style={{
            fontSize: 12.5
          }}>1080 × 1920 · 24 fps · card size 63 × 85 px</span></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Clip</th><th>Deals to</th><th className="num">Length</th><th className="num">Manifest position</th><th className="num">Reference contact</th><th className="num">Reference clear</th><th className="num">Size</th><th>Last change</th><th></th></tr></thead>
          <tbody>{man.deal.map(d => {
                const k = {
                    deal_hole: 'hole',
                    deal_flip: 'flip'
                  }[d.id] ?? d.id.replace('deal_pos', ''),
                  [cf, cl] = ST_CONTACT[k] ?? [],
                  p = prov.runtime['public' + d.url];
                return <tr key={d.id}>
            <td className="mono">{d.id}</td><td>{k === 'hole' ? 'Dealer · face down' : k === 'flip' ? 'Dealer · reveal' : k === 'dealer' ? 'Dealer upcard / hit' : 'Box ' + k}</td><td className="num mono">{d.dur.toFixed(2)} s</td><td className="num mono">{d.kort.cx}, {d.kort.cy}</td>
            <td className="num mono">f{cf} · {(cf / 24).toFixed(2)} s</td><td className="num mono">f{cl} · {(cl / 24).toFixed(2)} s</td><td className="num mono">{size[d.id] || p?.bytes ? stMB(size[d.id] || p.bytes) : '—'}</td>
            <td>{p ? <a href={p.url} target="_blank" rel="noreferrer">{p.author} · <span className="muted">{p.subject}</span> ↗</a> : '—'}</td><td><PlayBtn id={d.id} on={setPv} /></td></tr>;
              })}</tbody></table></div>
        <div className="note">Contact and fingers-clear timings above are the exported design reference. Current runtime calibration may differ; card placement is controlled by the game build, not this design editor.</div></section>
      <div className="two">
        <section className="panel"><div className="panel-h"><h2>Idle pool</h2><span className="muted" style={{
              fontSize: 12.5
            }}>Picked by weight between events</span></div>
          <table className="tbl"><thead><tr><th>Clip</th><th>What happens</th><th className="num">Weight</th><th className="num">Length</th><th></th></tr></thead>
            <tbody>{man.idle.map(i => {
                const tot = man.idle.reduce((n, x) => n + x.vikt, 0);
                return <tr key={i.id}><td className="mono">{i.id}</td><td>{ST_IDLE[i.id]}</td><td className="num mono">{Math.round(i.vikt / tot * 100)}%</td><td className="num mono">{i.dur.toFixed(2)} s</td><td><PlayBtn id={i.id} on={setPv} /></td></tr>;
              })}</tbody></table></section>
        <section className="panel"><div className="panel-h"><h2>Source takes · Emil</h2><span className="muted" style={{
              fontSize: 12.5
            }}>dealklipp-v1 · {emil.length} files</span></div>
          <div className="scroll-x" style={{
            maxHeight: 360,
            overflow: 'auto'
          }}><table className="tbl"><thead><tr><th>File</th><th>Kind</th><th>Status</th></tr></thead>
            <tbody>{emil.map(c => <tr key={c.id}><td className="mono">{c.title.replace('Emil · ', '')}</td><td>{c.kind}</td><td className="muted">Contribution · not a runtime assignment</td></tr>)}</tbody></table></div></section>
      </div>
    </div>
    <Preview state={pv} onClose={() => setPv(null)} />
  </>;
}
function GameMedia({
  toast
}) {
  const man = runtime.raw.game.manifest,
    prov = useJson('/bo/clip-provenance.json');
  const [use, setUse] = React.useState('gameplay'),
    [q, setQ] = React.useState(''),
    [n, setN] = React.useState(60),
    [pv, setPv] = React.useState(null);
  if (!man || !prov) return <PageH title="Game media" sub="Runtime manifest or media provenance unavailable." />;
  const pr = p => prov.runtime['public' + p];
  const game = (runtime.raw.media.media ?? []).filter(m => m.category === 'gameplay').map(m => ({
    kind: m.event ? 'Speech' : m.id.startsWith('deal_') ? 'Deal' : m.id === 'ambience' ? 'Audio' : 'Idle',
    id: m.id,
    use: m.binding,
    dur: m.dur,
    path: m.sourceUrl,
    text: m.text,
    p: pr(m.sourceUrl),
    scope: 'gameplay'
  }));
  const registeredLegacy = (runtime.raw.media.media ?? []).filter(m => m.category === 'legacy_training').map(m => ({
    kind: m.event ? 'Speech' : /\.(mp3|wav|ogg)$/.test(m.sourceUrl) ? 'Audio' : 'Video',
    id: m.id,
    use: m.binding,
    dur: m.dur,
    path: m.sourceUrl,
    text: m.text,
    preview: m.available ? m.url : null,
    p: pr(m.sourceUrl),
    scope: 'legacy'
  }));
  const legacy = [...registeredLegacy, ...Object.values(prov.library).map(v => ({
    kind: /\.(mp4|h264|webm)$/.test(v.path) ? 'Video' : /\.(mp3|wav|ogg)$/.test(v.path) ? 'Audio' : 'File',
    id: v.path.split('/').pop(),
    use: v.path.split('/').slice(2, -1).join('/'),
    dur: null,
    path: v.path,
    p: {
      url: v.url,
      author: '—',
      subject: 'Legacy library · ' + v.ref.slice(0, 8)
    },
    scope: 'legacy'
  }))];
  const all = use === 'gameplay' ? game : use === 'legacy' ? legacy : [...game, ...legacy];
  const rows = all.filter(r => !q || (r.id + r.use + (r.text || '')).toLowerCase().includes(q.toLowerCase()));
  return <>
    <PageH title="Game media" sub="Gameplay bindings come from the runtime manifest. Unbound takes are registered as legacy training material and are never picked at runtime. Original files are preserved." src={assetUrl("astrid manifest.json \xB7 clip-provenance.json (runtime + library)")} right={<div className="page-kpis"><div><span>Gameplay</span><b>{game.length}</b></div><div><span>Legacy · training</span><b>{legacy.length}</b></div></div>} />
    <div className="page-b">
      <section className="panel">
        <div className="panel-h wrap"><div className="filters"><div className="seg">{[['gameplay', 'Gameplay'], ['all', 'All media'], ['legacy', 'Legacy · training']].map(([k, l]) => <button key={k} className={use === k ? 'on' : ''} onClick={() => {
                setUse(k);
                setN(60);
              }}>{l}</button>)}</div></div>
          <input className="input" style={{
            width: 260
          }} placeholder="Clip name or event" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Kind</th><th>Name</th><th>Event / use</th><th className="num">Length</th><th>Last change</th><th>Use</th><th></th></tr></thead>
          <tbody>{rows.slice(0, n).map(r => <tr key={r.scope + r.path}>
            <td>{r.kind}</td><td className="mono">{r.id}</td><td style={{
                  maxWidth: 320,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }} title={r.text || r.use}>{r.use}</td>
            <td className="num mono">{r.dur ? r.dur.toFixed(2) + ' s' : '—'}</td>
            <td style={{
                  maxWidth: 340,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }} title={r.p && r.p.subject}>{r.p ? <>{r.p.author !== '—' && <b style={{
                      fontWeight: 600
                    }}>{r.p.author} · </b>}<span className="muted">{r.p.subject}</span></> : <span className="muted">—</span>}</td>
            <td>{r.scope === 'gameplay' ? <Badge status="live">Gameplay</Badge> : <Badge status="closed">Legacy · training</Badge>}</td>
            <td style={{
                  textAlign: 'right'
                }}><div style={{
                    display: 'inline-flex',
                    gap: 6
                  }}>{r.preview && <button className="btn sm" onClick={() => setPv({
                      id: r.id,
                      url: r.preview,
                      text: r.text
                    })}>Play training clip</button>}{r.scope === 'gameplay' && <PlayBtn id={r.id} text={r.text} on={setPv} />}{r.p && r.p.url && <a className="btn sm" href={r.p.url} target="_blank" rel="noopener" style={{
                      textDecoration: 'none'
                    }}>GitLab</a>}</div></td></tr>)}</tbody></table></div>
        {!rows.length && <EmptyState title="No media match" body="Try another name or event." />}
        <div className="pager"><span className="muted" style={{
            fontSize: 12.5
          }}>Showing {Math.min(n, rows.length)} of {rows.length}</span>{n < rows.length && <button className="btn sm" style={{
            marginLeft: 'auto'
          }} onClick={() => setN(n + 100)}>Show 100 more</button>}</div>
      </section>
    </div>
    <Preview state={pv} onClose={() => setPv(null)} />
  </>;
}
function ActionTree() {
  return <><PageH title="Action tree" sub="Intern arbetsyta för presentationshändelser och kopplingar. Förhandsvisningen har ingen spelanslutning." src={assetUrl("Current game manifest + pinned GitLab event catalogue")} /><div className="page-b"><RecordedActionTree /></div></>;
}
function Generations({
  toast
}) {
  const gens = useJson('/bo/generations.json');
  const [st, setSt] = React.useState({
    q: '',
    model: '',
    croupier: true,
    v: 'todo',
    n: 24
  });
  const [verd, setVerd] = React.useState(Object.fromEntries(Object.entries(runtime.raw.config.genVerdicts || {}).map(([id, v]) => [id, v.verdict]))),
    [open, setOpen] = React.useState({});
  if (!Array.isArray(gens)) return <PageH title="Generations" sub={gens?.error || 'Loading…'} />;
  const models = [...new Set(gens.map(g => g.model))].sort();
  const base = gens.filter(g => (!st.croupier || g.croupier) && (!st.model || g.model === st.model) && (!st.q || (g.prompt + g.id).toLowerCase().includes(st.q.toLowerCase())));
  const cnt = k => base.filter(g => k === 'all' || (k === 'todo' ? !verd[g.id] : verd[g.id] === k)).length;
  const list = base.filter(g => st.v === 'all' || (st.v === 'todo' ? !verd[g.id] : verd[g.id] === st.v));
  const setV = async (id, v) => {
    try {
      const r = await api('/api/bo/gen-verdict', {
        id,
        verdict: verd[id] === v ? null : v
      });
      runtime.raw.config.genVerdicts = r.genVerdicts;
      setVerd(Object.fromEntries(Object.entries(r.genVerdicts).map(([id, x]) => [id, x.verdict])));
      toast('Review saved');
    } catch (e) {
      notifyError(e);
    }
  };
  const mname = m => m.replace(/_/g, ' ').replace(/(\d) (\d)/, '$1.$2');
  return <>
    <PageH title="Generations" sub="Granskning av genererat innehåll. Inga produktionsjobb eller media är anslutna i förhandsvisningen." src={assetUrl("bo/generations.json")} right={<div className="page-kpis"><div><span>Videos</span><b>{gens.length}</b></div><div><span>Dealer videos</span><b>{gens.filter(g => g.croupier).length}</b></div><div><span>Models</span><b>{models.length}</b></div></div>} />
    <div className="page-b">
      <section className="panel">
        <div className="panel-h wrap"><div className="filters">
          <select className="select" value={st.model} onChange={e => setSt({
              ...st,
              model: e.target.value,
              n: 24
            })} aria-label="Model"><option value="">All models</option>{models.map(m => <option key={m} value={m}>{mname(m)}</option>)}</select>
          <label className="chk"><input type="checkbox" checked={st.croupier} onChange={e => setSt({
                ...st,
                croupier: e.target.checked,
                n: 24
              })} />Dealer videos only</label>
          <div className="seg">{[['todo', 'Unreviewed'], ['want', 'Want'], ['no', "Don't want"], ['all', 'All']].map(([k, l]) => <button key={k} className={st.v === k ? 'on' : ''} onClick={() => setSt({
                ...st,
                v: k,
                n: 24
              })}>{l} {cnt(k)}</button>)}</div></div>
          <input className="input" style={{
            width: 240
          }} placeholder="Search prompts" value={st.q} onChange={e => setSt({
            ...st,
            q: e.target.value,
            n: 24
          })} /></div>
        <div className="gen-grid">{list.slice(0, st.n).map(g => <article key={g.id} className={'gen' + (verd[g.id] ? ' ' + verd[g.id] : '')}>
          <div className="gen-th">{g.thumb && <img src={assetUrl(g.thumb)} alt="" loading="lazy" onError={e => {
                e.currentTarget.style.display = 'none';
              }} />}{verd[g.id] === 'want' && <Badge status="live">Want</Badge>}{verd[g.id] === 'no' && <Badge status="error">Don't want</Badge>}</div>
          <div className="gen-b">
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 6
              }}><span className="mono">{g.at.replace('T', ' ')}</span><span className="pill">{mname(g.model)}</span></div>
            <div className="muted mono" style={{
                fontSize: 11.5
              }}>{g.duration ? g.duration + ' s · ' : ''}{g.aspect} · {g.id.slice(0, 8)}</div>
            <div className={'gen-p' + (open[g.id] ? ' open' : '')} onClick={() => setOpen(o => ({
                ...o,
                [g.id]: !o[g.id]
              }))} title="Click to expand">{g.prompt || 'No prompt'}</div>
          </div>
          <div className="gen-f"><button className={'btn sm' + (verd[g.id] === 'want' ? ' on-ok' : '')} onClick={() => setV(g.id, 'want')}>Want</button><button className={'btn sm' + (verd[g.id] === 'no' ? ' on-err' : '')} onClick={() => setV(g.id, 'no')}>Don't want</button><button className="btn sm ghost" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(g.prompt);
                  toast('Prompt copied');
                } catch {
                  toast('Copy failed');
                }
              }}>Copy prompt</button><a className="btn sm ghost" href={g.url} target="_blank" rel="noopener" style={{
                textDecoration: 'none',
                marginLeft: 'auto'
              }}>MP4</a></div>
        </article>)}</div>
        {!list.length && <EmptyState title="Nothing here" body="No generations match these filters." />}
        <div className="pager"><span className="muted" style={{
            fontSize: 12.5
          }}>Showing {Math.min(st.n, list.length)} of {list.length}</span>{st.n < list.length && <button className="btn sm" style={{
            marginLeft: 'auto'
          }} onClick={() => setSt({
            ...st,
            n: st.n + 48
          })}>Show 48 more</button>}</div>
      </section>
    </div>
  </>;
}
function RecordedActionTree() {
  return <section className="panel"><div className="panel-h"><h2>Presentationshändelser och kopplingar</h2></div><div className="note">Spelhändelse → presentationsprofil → uppspelningsplan → spelklient. Kopplingen är inte ansluten i förhandsvisningen. Använd den befintliga Studio-ytan för redigering.</div><div className="panel-h"><a className="btn" href={runtime.studioUrl('/tree')}>Öppna presentationshändelser</a></div></section>;
}

// Source: theme.jsx at 7dee0901; see source-provenance.json.
const th = {
  rgb: h => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  },
  hex: (r, g, b) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase(),
  lum(h) {
    const c = th.rgb(h).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  },
  cr(a, b) {
    const [x, y] = [th.lum(a), th.lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  },
  on: h => th.cr(h, '#0A0B0D') >= th.cr(h, '#FFFFFF') ? '#0A0B0D' : '#FFFFFF',
  mix(a, b, t) {
    const A = th.rgb(a),
      B = th.rgb(b);
    return th.hex(...A.map((v, i) => v + (B[i] - v) * t));
  },
  sat(h) {
    const [r, g, b] = th.rgb(h).map(v => v / 255),
      mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    return mx ? (mx - mn) / mx : 0;
  },
  hue(h) {
    const [r, g, b] = th.rgb(h).map(v => v / 255),
      mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn;
    if (!d) return 0;
    let x = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  },
  dist(a, b) {
    const A = th.rgb(a),
      B = th.rgb(b);
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  }
};
const TH_VALUES = [5, 10, 25, 50, 100, 500];
const TH_FONTS = ['Inter', 'Space Grotesk', 'DM Sans', 'Manrope', 'IBM Plex Sans', 'Work Sans', 'Figtree'];
const TH_SCOUT = {
  name: 'Scout',
  primary: '#D6FF3A',
  surface: '#0A0B0D',
  text: '#F2F1ED',
  accent: '#DBC18A',
  secondary: '#F2F1ED',
  font: 'Inter',
  radius: 'pill',
  chipMode: 'auto',
  chips: {},
  cardBack: '#0A0B0D',
  cardAccent: '#D6FF3A',
  cardPattern: 'border',
  faces: 'classic',
  logo: null,
  wordmark: 'scout/gaming'
};
const TH_DEFAULTS = {
  scout: {
    ...TH_SCOUT
  },
  nrk: {
    ...TH_SCOUT,
    name: 'Norrsken',
    primary: '#7FE3B8',
    surface: '#0B1F1A',
    text: '#EEF6F2',
    accent: '#E9DDB8',
    secondary: '#EEF6F2',
    font: 'Manrope',
    cardBack: '#0B1F1A',
    cardAccent: '#7FE3B8',
    cardPattern: 'lines',
    wordmark: 'Norrsken Casino'
  },
  bfj: {
    ...TH_SCOUT,
    name: 'BetFjord',
    primary: '#4C8DFF',
    surface: '#0D1526',
    text: '#F3F6FB',
    accent: '#F2C14E',
    secondary: '#F3F6FB',
    font: 'DM Sans',
    radius: 'rounded',
    cardBack: '#13244A',
    cardAccent: '#F3F6FB',
    cardPattern: 'border',
    faces: 'four',
    wordmark: 'BetFjord'
  },
  aur: {
    ...TH_SCOUT,
    name: 'Aurora',
    primary: '#FF6B8B',
    surface: '#1B0D14',
    text: '#FBF1F4',
    accent: '#E9DDB8',
    secondary: '#FBF1F4',
    font: 'Work Sans',
    radius: 'rounded',
    cardBack: '#5A1A2C',
    cardAccent: '#E9DDB8',
    cardPattern: 'monogram',
    wordmark: 'Aurora Spel'
  }
};
const TH_SETS = [{
  id: 'scout',
  name: 'Scout',
  fills: ['#F2F1ED', '#5A6470', '#D6FF3A', '#DBC18A', '#0A0B0D', '#0A0B0D'],
  rims: {
    100: '#F2F1ED',
    500: '#D6FF3A'
  },
  texts: {
    500: '#D6FF3A'
  }
}, {
  id: 'classic',
  name: 'Casino classic',
  fills: ['#C8102E', '#1F4E9E', '#1E7A45', '#E07A1F', '#111111', '#5B2A86'],
  rims: {
    all: '#F2F1ED'
  }
}, {
  id: 'mono',
  name: 'Monochrome',
  fills: ['#F2F1ED', '#C9C7C1', '#8E9096', '#5A6470', '#2A2D33', '#0A0B0D']
}, {
  id: 'nordic',
  name: 'Nordic',
  fills: ['#E8EEF2', '#7FA7C9', '#2F6F8F', '#C9A96E', '#1D3B4A', '#0B1F2A'],
  rims: {
    500: '#C9A96E'
  },
  texts: {
    500: '#C9A96E'
  }
}, {
  id: 'emerald',
  name: 'Emerald & gold',
  fills: ['#F4EEDC', '#3F8F6B', '#145C43', '#D4AF37', '#0E2E24', '#111111'],
  rims: {
    100: '#D4AF37',
    500: '#D4AF37'
  },
  texts: {
    500: '#D4AF37'
  }
}, {
  id: 'ocean',
  name: 'Ocean',
  fills: ['#DFF3F7', '#54B6D1', '#1C7FA6', '#F2C14E', '#0D3B66', '#081C33'],
  rims: {
    500: '#F2C14E'
  },
  texts: {
    500: '#F2C14E'
  }
}, {
  id: 'sunset',
  name: 'Sunset',
  fills: ['#FFE3C2', '#FF9F5A', '#E8505B', '#B83280', '#5B2A86', '#1F1235'],
  rims: {
    500: '#FF9F5A'
  },
  texts: {
    500: '#FF9F5A'
  }
}, {
  id: 'berry',
  name: 'Berry',
  fills: ['#FBE4EA', '#F28AA9', '#C2185B', '#7B1FA2', '#3E1045', '#140A1A'],
  rims: {
    500: '#F28AA9'
  },
  texts: {
    500: '#F28AA9'
  }
}, {
  id: 'neon',
  name: 'Neon',
  fills: ['#F2F1ED', '#00E0FF', '#D6FF3A', '#FF3DA8', '#7A5CFF', '#0A0B0D'],
  rims: {
    500: '#00E0FF'
  },
  texts: {
    500: '#00E0FF'
  }
}, {
  id: 'burgundy',
  name: 'Burgundy luxe',
  fills: ['#F4E8D8', '#B08D57', '#7A1F2B', '#C9A96E', '#3A0D14', '#1A0508'],
  rims: {
    100: '#C9A96E',
    500: '#C9A96E'
  },
  texts: {
    500: '#C9A96E'
  }
}];
const TH_KEY = 'bo.brandThemes';
function thLoad() {
  let s = runtime.designStore.read('themes');
  const o = {};
  for (const b of runtime.data.brands) o[b.id] = s[b.id] || {
    draft: {
      ...TH_DEFAULTS[b.id]
    },
    published: {
      ...TH_DEFAULTS[b.id]
    }
  };
  return o;
}
function thSetChips(s) {
  const o = {};
  TH_VALUES.forEach((v, i) => {
    const f = s.fills[i],
      tx = s.texts && s.texts[v] || th.on(f);
    o[v] = {
      fill: f,
      text: tx,
      rim: s.rims && (s.rims[v] || s.rims.all) || tx
    };
  });
  return o;
}
function thChips(t) {
  if (t.chipMode === 'set') return thSetChips(TH_SETS.find(s => s.id === t.chipSet) || TH_SETS[0]);
  const auto = {
    5: t.text,
    10: th.mix(t.surface, t.text, .42),
    25: t.primary,
    50: t.accent,
    100: t.surface,
    500: t.surface
  };
  const o = {};
  TH_VALUES.forEach(v => {
    const c = t.chipMode === 'custom' && t.chips[v] ? t.chips[v] : auto[v];
    const txt = v === 500 && t.chipMode !== 'custom' ? t.primary : th.on(c);
    o[v] = {
      fill: c,
      text: txt,
      rim: v === 500 && t.chipMode !== 'custom' ? t.primary : v === 100 ? t.text : txt
    };
  });
  return o;
}
const thRad = r => ({
  pill: 20,
  rounded: 8,
  square: 3
})[r];
function thFont() {/* Local system fonts only; no Google Fonts requests. */}
function ThChip({
  c,
  v,
  s = 44
}) {
  return <svg width={s} height={s} viewBox="-22 -22 44 44" aria-label={'Chip ' + v}>
    <circle r="21.5" fill={c.fill} stroke={th.lum(c.fill) < .2 ? 'rgba(242,241,237,.45)' : 'rgba(10,11,13,.35)'} strokeWidth="1"></circle>
    {[0, 60, 120, 180, 240, 300].map(a => <rect key={a} x="-3" y="-21.5" width="6" height="7" rx="1" fill={c.rim} transform={`rotate(${a})`}></rect>)}
    <circle r="14" fill="none" stroke={c.rim} strokeOpacity=".45" strokeWidth="1"></circle>
    <text y="4.5" textAnchor="middle" fontWeight="700" fontSize={v > 99 ? 11 : 13} fill={c.text} style={{
      fontFamily: 'inherit'
    }}>{v}</text>
  </svg>;
}
function ThCard({
  t,
  r,
  s,
  x = 0,
  y = 0,
  back,
  w = 63
}) {
  const h = w * 85 / 63,
    k = w / 63;
  if (back) {
    const ini = (t.wordmark || '?').trim()[0].toUpperCase();
    return <g transform={`translate(${x} ${y}) scale(${k})`}>
      <rect x="-31.5" y="-42.5" width="63" height="85" rx="4" fill={t.cardBack} stroke="rgba(255,255,255,.35)" strokeWidth="1"></rect>
      {t.cardPattern === 'border' && <rect x="-25" y="-36" width="50" height="72" rx="2" fill="none" stroke={t.cardAccent} strokeWidth="1.5"></rect>}
      {t.cardPattern === 'lines' && <g stroke={t.cardAccent} strokeOpacity=".35" strokeWidth="1.2">{Array.from({
          length: 11
        }, (_, i) => <line key={i} x1={-31 + i * 8} y1="-42" x2={-31 + i * 8 - 30} y2="42"></line>)}</g>}
      {t.cardPattern === 'monogram' && <><rect x="-25" y="-36" width="50" height="72" rx="2" fill="none" stroke={t.cardAccent} strokeOpacity=".6" strokeWidth="1"></rect><text y="10" textAnchor="middle" fontSize="30" fontWeight="700" fill={t.cardAccent} style={{
          fontFamily: t.font
        }}>{ini}</text></>}
      {t.cardPattern === 'logo' && (t.cardLogo || t.logo ? <image href={t.cardLogo || t.logo} x="-20" y="-20" width="40" height="40" preserveAspectRatio="xMidYMid meet"></image> : <text y="6" textAnchor="middle" fontSize="11" fontWeight="600" fill={t.cardAccent} style={{
        fontFamily: t.font
      }}>LOGO</text>)}
    </g>;
  }
  const col = t.faces === 'four' ? {
    '♠': '#171B1B',
    '♥': '#C0262D',
    '♦': '#1F5FD1',
    '♣': '#1E7A45'
  }[s] : s === '♥' || s === '♦' ? '#AE2025' : '#171B1B';
  return <g transform={`translate(${x} ${y}) scale(${k})`}>
    <rect x="-31.5" y="-42.5" width="63" height="85" rx="4" fill="#F7F6F2" stroke="#C9C3AF" strokeWidth=".8"></rect>
    <text x="-19" y="-20" textAnchor="middle" fontWeight="700" fontSize="17" fill={col} style={{
      fontFamily: t.font
    }}>{r}</text>
    <text x="-19" y="-5" textAnchor="middle" fontSize="15" fill={col}>{s}</text>
    <text y="18" textAnchor="middle" fontSize="30" fill={col}>{s}</text>
  </g>;
}
const TH_W = [110, 253, 396, 540, 684, 827, 970],
  TH_Y = [1025, 1075, 1105, 1115, 1105, 1075, 1025];
function ThStack({
  c,
  v,
  x,
  y
}) {
  return <g>{[0, 1, 2].map(i => <g key={i} transform={`translate(${x} ${y - i * 5})`}><ellipse cy="4" rx="38" ry="23" fill={c.fill} stroke="rgba(10,11,13,.5)"></ellipse><ellipse rx="38" ry="23" fill={c.fill} stroke="rgba(10,11,13,.35)"></ellipse><ellipse rx="30" ry="17" fill="none" stroke={c.rim} strokeOpacity=".5" strokeWidth="2" strokeDasharray="8 7"></ellipse></g>)}
    <text x={x} y={y - 3} textAnchor="middle" fontWeight="700" fontSize="24" fill={c.text}>{v}</text></g>;
}
function ThTotal({
  t,
  x,
  y,
  v,
  act
}) {
  return <g transform={`translate(${x} ${y})`}><rect x="-36" y="-22" width="72" height="44" rx="22" fill={act ? t.primary : t.surface} fillOpacity={act ? 1 : .85}></rect><text y="10" textAnchor="middle" fontSize="29" fontWeight="500" fill={act ? th.on(t.primary) : t.text} style={{
      fontFamily: 'JetBrains Mono'
    }}>{v}</text></g>;
}
function ThFrame({
  t,
  st
}) {
  const C = thChips(t),
    op = th.on(t.primary),
    os = th.on(t.secondary),
    rad = thRad(t.radius);
  const bet = st === 'set' ? 50 : 25,
    act = st === 'dec' ? 4 : 0;
  const vars = {
    '--tp': t.primary,
    '--top': op,
    '--ts': t.surface,
    '--ttx': t.text,
    '--tsec': t.secondary,
    '--tos': os,
    '--tr': rad + 'px',
    fontFamily: `'${t.font}', Inter, sans-serif`
  };
  const B = {
    bet: null,
    dec: [['9', '♣'], 'hole'],
    ins: [['A', '♠'], 'hole'],
    set: [['10', '♠'], ['7', '♦']]
  }[st];
  const P = {
    bet: null,
    dec: [['8', '♥'], ['6', '♠']],
    ins: [['K', '♦'], ['9', '♣']],
    set: [['Q', '♥'], ['9', '♣']]
  }[st];
  const wal = (b, y, r) => <div className="thf-wal"><div><div className="thf-top"><small>Balance</small><button>+ $1,000 demo</button></div><strong>{b}</strong></div><div><small>Your bet</small><strong>{y}</strong></div><div><small>Last return</small><strong>{r}</strong></div></div>;
  return <div className="thf" style={vars}>
    <img className="thf-still" src={assetUrl("/bo/design-studio/astrid/startbild.png")} alt="Astrid at the table" />
    <svg className="thf-svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMin slice" style={{
      fontFamily: vars.fontFamily
    }}>
      {TH_W.map((x, i) => {
        const y = TH_Y[i] + 108,
          n = i + 1,
          on = act === n,
          has = n === 4;
        return <g key={n}>
        <g transform={`translate(${x} ${y})`}>
          <ellipse rx="48" ry="30" fill={on ? t.primary : 'none'} fillOpacity={on ? .14 : 0} stroke={on ? t.primary : t.text} strokeOpacity={on ? 1 : .45} strokeWidth={on ? 3.5 : 1.8}></ellipse>
          {!has && <g fill="none" stroke={t.text} strokeOpacity=".45" strokeWidth="2.4"><circle cx="-4" cy="-7" r="6"></circle><path d="M -16 12 C -16 0 8 0 8 12 M 16 -4 H 26 M 21 -9 V 1"></path></g>}
          <text y="56" textAnchor="middle" fontWeight="600" fontSize="19" fill={t.text} fillOpacity=".7">{n}</text>
          {['PP', '21+3'].map((l, k) => <g key={l} transform={`translate(${k ? 40 : -40} -40)`}><ellipse rx="26" ry="17" fill="none" stroke={t.text} strokeOpacity=".35" strokeWidth="1.6"></ellipse><text y="5.5" textAnchor="middle" fontWeight="600" fontSize={k ? 14 : 16} fill={t.text} fillOpacity=".6">{l}</text></g>)}
        </g>
        {has && <ThStack c={C[bet]} v={bet} x={x} y={y} />}
      </g>;
      })}
      {B && <><ThCard t={t} r={B[0][0]} s={B[0][1]} x={510} y={869} />{B[1] === 'hole' ? <ThCard t={t} back x={540} y={895} /> : B[1] ? <ThCard t={t} r={B[1][0]} s={B[1][1]} x={540} y={895} /> : null}
        <ThTotal t={t} x={540 - 30 - 73} y={895} v={st === 'set' ? 17 : st === 'ins' ? 11 : 9} /></>}
      {P && <><ThCard t={t} r={P[0][0]} s={P[0][1]} x={510} y={1089} /><ThCard t={t} r={P[1][0]} s={P[1][1]} x={540} y={1115} /><ThTotal t={t} x={540} y={1175} v={st === 'dec' ? 14 : 19} act={st === 'dec'} /></>}
    </svg>
    <div className="thf-hd"><div><div className="thf-brand">{t.logo ? <img src={assetUrl(t.logo)} alt="" /> : null}<span>{t.wordmark}</span></div><div className="thf-tbl">Privé Blackjack · $5 – $2,000 · Astrid</div></div><div className="thf-ics"><span>Boxes</span><span>Sound on</span><span>Settings</span></div></div>
    <div className="thf-cap">{{
        bet: 'Bets are open. Place your chips whenever you’re ready.',
        dec: 'Take your time. The cards aren’t going anywhere.',
        ins: 'Ace showing. Would anyone like insurance?',
        set: 'Well played. That hand is yours.'
      }[st]}</div>
    <div className="thf-dock">
      {st === 'bet' && <><div className="thf-st"><b>Place your bets</b><span>Closes in 14 s</span></div><div className="thf-prog"><i style={{
            width: '70%'
          }}></i></div>
        <div className="thf-chips">{TH_VALUES.map(v => <span key={v} className={'thf-chip' + (v === 25 ? ' on' : '')}><ThChip c={C[v]} v={v} /></span>)}</div>
        <div className="thf-row"><button className="thf-b">↶ Undo</button><button className="thf-b">Clear</button><button className="thf-b">2× bets</button><button className="thf-b pri">Deal now →</button></div>{wal('$975.00', '$25.00', '–')}</>}
      {st === 'dec' && <><div className="thf-st"><b>Box 4 · 14 · your decision</b><span>42 s</span></div><div className="thf-prog"><i style={{
            width: '70%'
          }}></i></div>
        <div className="thf-acts"><button className="thf-act"><i>2×</i>Double</button><button className="thf-act pri"><i>+</i>Hit</button><button className="thf-act sec"><i>−</i>Stand</button><button className="thf-act dis"><i>↔</i>Split</button></div>{wal('$975.00', '$25.00', '–')}</>}
      {st === 'ins' && <><div className="thf-st"><b>Astrid shows an ace</b><span>12 s</span></div><div className="thf-prog"><i style={{
            width: '60%'
          }}></i></div>
        <div className="thf-msg">Insurance costs half your main bets and pays 2 to 1 if Astrid has blackjack.</div><div className="thf-row"><button className="thf-b eq">Insurance $12.50</button><button className="thf-b eq">No thanks</button></div>{wal('$975.00', '$25.00', '–')}</>}
      {st === 'set' && <><div className="thf-st"><b>Box 4 wins</b><span>R-20481</span></div><div className="thf-res">+$25.00</div><div className="thf-msg" style={{
          paddingTop: 2
        }}>19 against 17. Returned $50.00.</div>
        <div className="thf-row"><button className="thf-b">Rebet $25</button><button className="thf-b pri">Next round →</button></div>{wal('$1,025.00', '$0.00', '$50.00')}</>}
    </div>
  </div>;
}
async function thReadBook(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw Error('Use PNG, JPG or WebP. PDF import is not connected.');
  if (file.size > 2100000) throw Error('Use an image under 2 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas'),
      k = 240 / img.width;
    c.width = 240;
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return {
      canvases: [c],
      pages: 1
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
function thPalette(canvases) {
  const m = new Map();
  canvases.forEach(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 12) {
      if (d[i + 3] < 200) continue;
      const k = d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4;
      const e = m.get(k) || [0, 0, 0, 0];
      e[0] += d[i];
      e[1] += d[i + 1];
      e[2] += d[i + 2];
      e[3]++;
      m.set(k, e);
    }
  });
  const all = [...m.values()].sort((a, b) => b[3] - a[3]),
    tot = all.reduce((n, e) => n + e[3], 0),
    out = [];
  for (const e of all) {
    const h = th.hex(e[0] / e[3], e[1] / e[3], e[2] / e[3]);
    if (out.every(o => th.dist(o.hex, h) > 60)) out.push({
      hex: h,
      share: e[3] / tot
    });
    if (out.length >= 10) break;
  }
  return out;
}
function thRoles(pal) {
  const by = f => [...pal].sort(f);
  const dark = by((a, b) => th.lum(a.hex) - th.lum(b.hex))[0],
    light = by((a, b) => th.lum(b.hex) - th.lum(a.hex))[0];
  const vivid = by((a, b) => th.sat(b.hex) * (0.4 + th.lum(b.hex)) - th.sat(a.hex) * (0.4 + th.lum(a.hex))).filter(p => th.sat(p.hex) > .25);
  const surface = dark && th.lum(dark.hex) < .06 ? dark.hex : dark ? th.mix(dark.hex, '#000000', .6) : '#0A0B0D';
  const text = light && th.lum(light.hex) > .7 ? light.hex : '#F2F1ED';
  const primary = (vivid.find(p => th.cr(p.hex, surface) >= 4.5) || vivid[0] || {
    hex: '#D6FF3A'
  }).hex;
  const accent = (vivid.find(p => p.hex !== primary && Math.abs(th.hue(p.hex) - th.hue(primary)) > 30) || {
    hex: th.mix(primary, text, .5)
  }).hex;
  return {
    primary,
    surface,
    text,
    accent
  };
}
function ThCol({
  k,
  label,
  hint,
  value,
  onChange
}) {
  const [txt, setTxt] = React.useState(value);
  React.useEffect(() => {
    setTxt(value);
  }, [value]);
  return <div className="th-col"><label htmlFor={'thc-' + k}><b>{label}</b>{hint && <span>{hint}</span>}</label>
    <div className="th-colin"><input id={'thc-' + k} type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} />
      <input className="input mono" value={txt} aria-label={label + ' hex'} onChange={e => {
        const v = e.target.value.trim();
        setTxt(v);
        const full = /^#?[0-9a-fA-F]{6}$/.test(v) ? (v[0] === '#' ? v : '#' + v).toUpperCase() : null;
        if (full) onChange(full);
      }} onBlur={() => setTxt(value)} /></div></div>;
}
function BrandTheme({
  brand: scope,
  toast
}) {
  const [all, setAll] = React.useState(thLoad),
    [brand, setBrand] = React.useState(scope === 'all' ? 'scout' : scope),
    [st, setSt] = React.useState('bet');
  const [book, setBook] = React.useState(null),
    [busy, setBusy] = React.useState(false),
    [pub, setPub] = React.useState(false);
  const pvRef = React.useRef(null),
    [sc, setSc] = React.useState(1);
  React.useEffect(() => {
    const el = pvRef.current;
    if (!el) return;
    const fit = () => setSc(Math.min(1, el.clientHeight / 720, el.clientWidth / 405));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    if (scope !== 'all') setBrand(scope);
  }, [scope]);
  const cur = all[brand],
    t = cur.draft,
    dirty = JSON.stringify(t) !== JSON.stringify(cur.published);
  React.useEffect(() => {
    thFont(t.font);
  }, [t.font]);
  const saveT = React.useRef(null);
  const commit = n => {
    setAll(n);
    runtime.designStore.write('themes', n);
  };
  const set = p => commit({
    ...all,
    [brand]: {
      ...cur,
      draft: {
        ...t,
        ...p
      }
    }
  });
  const C = thChips(t);
  const readBook = async f => {
    if (!f) return;
    setBusy(true);
    setBook(null);
    try {
      const r = await thReadBook(f);
      const pal = thPalette(r.canvases);
      setBook({
        name: f.name,
        pages: r.pages,
        thumbs: r.canvases.slice(0, 4).map(c => c.toDataURL('image/jpeg', .7)),
        pal,
        roles: thRoles(pal)
      });
    } catch (e) {
      toast('Could not read the file. Use a PNG, JPG or WebP under 2 MB. PDF import is not connected.');
    }
    setBusy(false);
  };
  const logo = async f => {
    try {
      set({
        logo: await imageFile(f)
      });
      toast('Logo added');
    } catch (e) {
      notifyError(e);
    }
  };
  const checks = [['Primary button text', th.cr(t.primary, th.on(t.primary)), 4.5], ['Secondary button text', th.cr(t.secondary, th.on(t.secondary)), 4.5], ['Dock text on surface', th.cr(t.surface, t.text), 4.5], ['Main action against the dock', th.cr(t.primary, t.surface), 3], ...TH_VALUES.map(v => ['Chip $' + v + ' value', th.cr(C[v].fill, C[v].text), 4.5])];
  const similar = [];
  TH_VALUES.forEach((a, i) => TH_VALUES.slice(i + 1).forEach(b => {
    if (th.dist(C[a].fill, C[b].fill) < 45 && th.dist(C[a].rim, C[b].rim) < 45) similar.push('$' + a + ' and $' + b);
  }));
  const fails = checks.filter(c => c[1] < c[2]).length + similar.length;
  return <>
    <header className="page-h">
      <div style={{
        display: 'grid',
        gap: 6
      }}><h1>Brand theme</h1><a className="btn sm" href="#test">Open local preview ↗</a><div className="muted" style={{
          fontSize: 13,
          maxWidth: 680
        }}>Chips, cards, buttons and the control dock in the brand’s colours. Start from a brand book or set the colours yourself. Preview amounts and cards are examples. The filmed Astrid card back stays Scout for a seamless deal and flip. Custom back designs and table geometry remain in the design preview. Felt and table layout are set in <a href="#design">Table design</a>.</div></div>
      <div className="td-actions">{dirty ? <Badge status="warning">Local changes</Badge> : <Badge status="live">Local preview</Badge>}
        <button className="btn" disabled={!dirty} onClick={() => {
          commit({
            ...all,
            [brand]: {
              ...cur,
              draft: {
                ...cur.published
              }
            }
          });
          toast('Changes discarded');
        }}>Discard changes</button>
        <button className="btn primary" onClick={() => setPub(true)}>Apply locally</button></div>
    </header>
    <div className="page-b">
      <div className="th-grid">
        <div className="th-ed">
          <section className="panel"><div className="panel-h wrap">
            <div className="field" style={{
                minWidth: 200,
                flex: 1
              }}><label htmlFor="th-brand">Brand</label><select id="th-brand" className="select" value={brand} onChange={e => {
                  setBrand(e.target.value);
                  setBook(null);
                }}>{runtime.data.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div className="field" style={{
                minWidth: 160,
                flex: 1
              }}><label htmlFor="th-wm">Name on the table</label><input id="th-wm" className="input" value={t.wordmark} onChange={e => set({
                  wordmark: e.target.value
                })} /></div>
          </div></section>

          <section className="panel"><div className="panel-h"><h2>Start from a brand book</h2><span className="muted" style={{
                fontSize: 12.5
              }}>PNG, JPG or WebP · PDF not connected</span></div>
            <div className="th-sec">
              <label className="th-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => readBook(e.target.files[0])} /><b>{busy ? 'Reading brand book…' : 'Upload brand book'}</b><span>We read the colours on the first pages and suggest a theme. Nothing is changed until you apply it.</span></label>
              {book && <div className="th-book">
                <div className="th-thumbs">{book.thumbs.map((s, i) => <img key={i} src={assetUrl(s)} alt={'Page ' + (i + 1)} />)}</div>
                <div className="muted" style={{
                  fontSize: 12.5
                }}>{book.name} · {book.pages} {book.pages === 1 ? 'page' : 'pages'} · {book.pal.length} colours found</div>
                <div className="th-pal">{book.pal.map(p => <span key={p.hex} title={p.hex + ' · ' + Math.round(p.share * 100) + '%'} style={{
                    background: p.hex
                  }}></span>)}</div>
                <div className="th-roles">{[['primary', 'Main action'], ['accent', 'Accent'], ['surface', 'Dock surface'], ['text', 'Text']].map(([k, l]) => <div key={k}><span className="th-sw" style={{
                      background: book.roles[k]
                    }}></span><span>{l}</span><select className="select" value={book.roles[k]} onChange={e => setBook({
                      ...book,
                      roles: {
                        ...book.roles,
                        [k]: e.target.value
                      }
                    })}>{[...new Set([book.roles[k], ...book.pal.map(p => p.hex)])].map(h => <option key={h} value={h}>{h}</option>)}</select></div>)}</div>
                <div style={{
                  display: 'flex',
                  gap: 8
                }}><button className="btn primary" onClick={() => {
                    const r = book.roles;
                    set({
                      ...r,
                      secondary: r.text,
                      cardBack: r.surface,
                      cardAccent: r.primary,
                      chipMode: 'auto'
                    });
                    toast('Brand book colours applied');
                  }}>Apply to theme</button><button className="btn ghost" onClick={() => setBook(null)}>Dismiss</button></div>
              </div>}
            </div></section>

          <section className="panel"><div className="panel-h"><h2>Colours</h2><button className="btn sm ghost" onClick={() => {
                set({
                  ...TH_SCOUT,
                  wordmark: t.wordmark,
                  logo: t.logo
                });
                toast('Scout colours applied');
              }}>Use Scout colours</button></div>
            <div className="th-sec th-cols"><ThCol k="primary" value={t.primary} onChange={v => set({
                primary: v
              })} label="Main action" hint="Deal, Hit, Next round" /><ThCol k="secondary" value={t.secondary} onChange={v => set({
                secondary: v
              })} label="Second action" hint="Stand" /><ThCol k="accent" value={t.accent} onChange={v => set({
                accent: v
              })} label="Accent" hint="$50 chip" /><ThCol k="surface" value={t.surface} onChange={v => set({
                surface: v
              })} label="Dock surface" /><ThCol k="text" value={t.text} onChange={v => set({
                text: v
              })} label="Text" /></div></section>

          <section className="panel"><div className="panel-h wrap"><h2>Chips</h2><div className="seg">{[['set', 'Ready sets'], ['auto', 'From colours'], ['custom', 'Custom']].map(([k, l]) => <button key={k} className={t.chipMode === k ? 'on' : ''} onClick={() => set({
                  chipMode: k,
                  chipSet: t.chipSet || 'scout',
                  chips: k === 'custom' ? Object.fromEntries(TH_VALUES.map(v => [v, C[v].fill])) : t.chips
                })}>{l}</button>)}</div></div>
            {t.chipMode === 'set' && <div className="th-sets">{TH_SETS.map(s => {
                const sc = thSetChips(s),
                  on = t.chipSet === s.id;
                return <button key={s.id} className={'th-set' + (on ? ' on' : '')} aria-pressed={on} onClick={() => set({
                  chipSet: s.id
                })}>
              <span className="th-set-n">{s.name}{on && <Badge status="live">In use</Badge>}</span>
              <span className="th-set-c">{TH_VALUES.map(v => <ThChip key={v} c={sc[v]} v={v} s={30} />)}</span></button>;
              })}</div>}
            <div className="th-sec th-chipgrid">{TH_VALUES.map(v => <div key={v} className="th-chiprow"><ThChip c={C[v]} v={v} s={40} /><b className="mono">${v}</b>{t.chipMode === 'custom' ? <input type="color" value={C[v].fill} onChange={e => set({
                  chips: {
                    ...t.chips,
                    [v]: e.target.value.toUpperCase()
                  }
                })} aria-label={'Colour for $' + v} /> : <span className="mono muted">{C[v].fill}</span>}</div>)}</div>
            {similar.length > 0 && <div className="note" style={{
              color: 'var(--warn)'
            }}>Hard to tell apart: {similar.join(', ')}. Change one of the colours.</div>}</section>

          <section className="panel"><div className="panel-h"><h2>Cards</h2></div>
            <div className="th-sec" style={{
              display: 'grid',
              gap: 12
            }}>
              <div className="field"><label>Back pattern</label><div className="seg">{[['plain', 'Plain'], ['border', 'Border'], ['lines', 'Lines'], ['monogram', 'Monogram'], ['logo', 'Logo']].map(([k, l]) => <button key={k} className={t.cardPattern === k ? 'on' : ''} onClick={() => set({
                    cardPattern: k
                  })}>{l}</button>)}</div></div>
              {t.cardPattern === 'logo' && (() => {
                const tl = typeof loadDesigns === 'function' ? (loadDesigns()[brand] || {}).draft : null,
                  tableLogo = tl && tl.logo,
                  cur = t.cardLogo || t.logo;
                const opts = [tableLogo && ['table', 'Table logo', tableLogo], t.logo && ['theme', 'Logo on this page', t.logo], t.cardLogo && t.cardLogo !== tableLogo && t.cardLogo !== t.logo && ['own', 'Uploaded for cards', t.cardLogo]].filter(Boolean);
                return <div className="field"><label>Logo on the card back</label>
                  <div className="th-logos">{opts.map(([k, l, src]) => <button key={k} className={'th-logo' + (cur === src ? ' on' : '')} onClick={() => set({
                      cardLogo: src
                    })}><span style={{
                        background: t.cardBack
                      }}><img src={assetUrl(src)} alt="" /></span><small>{l}</small></button>)}
                    <label className="th-logo up"><input type="file" accept="image/*" hidden onChange={async e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        try {
                          const src = await imageFile(f),
                            o = await tdPrepLogo(src);
                          set({
                            cardLogo: o.src
                          });
                          toast('Logo added to the card back');
                        } catch (e) {
                          notifyError(e);
                        }
                      }} /><span>+</span><small>Upload logo</small></label></div>
                  {!opts.length && <span className="muted" style={{
                    fontSize: 12.5
                  }}>No logo yet. Upload one, or add a logo under <a href="#design">Table</a>.</span>}</div>;
              })()}
              <div className="th-cols"><ThCol k="cardBack" value={t.cardBack} onChange={v => set({
                  cardBack: v
                })} label="Back colour" /><ThCol k="cardAccent" value={t.cardAccent} onChange={v => set({
                  cardAccent: v
                })} label="Pattern colour" /></div>
              <svg viewBox="-10 -52 330 104" width="100%" style={{
                display: 'block',
                background: '#2B2622',
                borderRadius: 6,
                fontFamily: t.font,
                maxWidth: 420
              }}><ThCard t={t} back x={40} y={0} /><ThCard t={t} r="A" s="♠" x={120} y={0} /><ThCard t={t} r="K" s="♥" x={200} y={0} /><ThCard t={t} r="7" s="♦" x={280} y={0} /></svg>
              <div className="field"><label>Suits</label><div className="seg">{[['classic', 'Red and black'], ['four', 'Four colours']].map(([k, l]) => <button key={k} className={t.faces === k ? 'on' : ''} onClick={() => set({
                    faces: k
                  })}>{l}</button>)}</div></div>
            </div></section>

          <section className="panel"><div className="panel-h"><h2>Type, shape and logo</h2></div>
            <div className="th-sec" style={{
              display: 'grid',
              gap: 12
            }}>
              <div className="field"><label htmlFor="th-font">Font</label><select id="th-font" className="select" value={t.font} onChange={e => set({
                  font: e.target.value
                })}>{TH_FONTS.map(f => <option key={f}>{f}</option>)}</select><span className="muted" style={{
                  fontSize: 12.5
                }}>Amounts always use JetBrains Mono.</span></div>
              <div className="field"><label>Button shape</label><div className="seg">{[['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']].map(([k, l]) => <button key={k} className={t.radius === k ? 'on' : ''} onClick={() => set({
                    radius: k
                  })}>{l}</button>)}</div></div>
              <div className="field"><label>Logo</label><div style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center'
                }}>{t.logo && <img src={assetUrl(t.logo)} alt="" style={{
                    height: 32,
                    maxWidth: 120,
                    objectFit: 'contain',
                    background: t.surface,
                    borderRadius: 4,
                    padding: 4
                  }} />}<label className="btn sm">{t.logo ? 'Replace' : 'Upload logo'}<input type="file" accept="image/*" hidden onChange={e => logo(e.target.files[0])} /></label>{t.logo && <button className="btn sm ghost" onClick={() => set({
                    logo: null
                  })}>Remove</button>}</div></div>
            </div></section>
          <section className="panel" id="th-checks"><div className="panel-h"><h2>Checks</h2><span className="muted" style={{
                fontSize: 12
              }}>Contrast, WCAG</span></div>
            <div className="rows">{checks.map(([l, v, min]) => <div key={l}><span>{l}</span><span style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center'
                }}><span className="mono">{v.toFixed(1)}:1</span>{v >= min ? <Badge status="live">Pass</Badge> : <Badge status="error">Below {min}</Badge>}</span></div>)}</div></section>
        </div>

        <div className="th-pv">
          <div className="th-pvh"><div className="seg">{[['bet', 'Betting'], ['dec', 'Decision'], ['ins', 'Insurance'], ['set', 'Settled']].map(([k, l]) => <button key={k} className={st === k ? 'on' : ''} onClick={() => setSt(k)}>{l}</button>)}</div><button className="btn ghost sm" style={{
              padding: 0,
              height: 'auto'
            }} onClick={() => {
              const e = document.getElementById('th-checks');
              if (e) window.scrollTo({
                top: e.getBoundingClientRect().top + window.scrollY - 16,
                behavior: 'smooth'
              });
            }}>{fails ? <Badge status="warning">{fails} {fails === 1 ? 'check' : 'checks'} to fix</Badge> : <Badge status="live">All checks pass</Badge>}</button></div>
          <div className="th-fit" ref={pvRef}><div style={{
              width: 405 * sc,
              height: 720 * sc
            }}><div style={{
                transform: 'scale(' + sc + ')',
                transformOrigin: '0 0'
              }}><ThFrame t={t} st={st} /></div></div></div>

        </div>
      </div>
    </div>
    {pub && <Modal open title={'Apply local brand preview · ' + brandName(brand)} onClose={() => setPub(false)} footer={<><button className="btn" onClick={() => setPub(false)}>Cancel</button><button className="btn primary" onClick={async () => {
        try {
          const next = {
            ...all,
            [brand]: {
              ...cur,
              published: {
                ...t
              }
            }
          };
          runtime.designStore.write('themes', next);
          await runtime.designStore.save('themes');
          setAll(next);
          setPub(false);
          toast('Local preview updated for ' + brandName(brand));
        } catch (e) {
          notifyError(e);
        }
      }}>Apply locally</button></>}>
      <p style={{
        margin: '0 0 10px'
      }}>This applies the design to this local preview only. No players, games or shared profiles are changed.</p>
      {fails > 0 && <p className="row-issue is-warning" style={{
        margin: 0
      }}>{fails} {fails === 1 ? 'check does' : 'checks do'} not pass. You can still apply this local preview.</p>}
    </Modal>}
  </>;
}

// Source: v-dealers.jsx at 7dee0901; see source-provenance.json.
const DL_LOOKS = [{
  id: 'astrid',
  name: 'Astrid',
  img: '/bo/img/astrid-portrait.jpg',
  footage: true,
  room: 'Dark Hall'
}, {
  id: 'vera',
  name: 'Vera',
  img: '/bo/img/vera-portrait.jpg',
  footage: false,
  room: 'Mahogany Privé'
}, {
  id: 'amira',
  name: 'Amira',
  img: '/bo/img/amira-portrait.jpg',
  footage: false,
  room: 'Golden Salon'
}, {
  id: 'mei',
  name: 'Mei',
  img: '/bo/img/mei-portrait.jpg',
  footage: false,
  room: 'Azure Venue'
}];
const DL_VOICES = [{
  id: 'freja',
  name: 'Freja – Informative Host',
  provider: 'Cartesia sonic-3.5',
  note: 'English with a Swedish accent',
  pitch: 1,
  rate: 1
}, {
  id: 'vera',
  name: 'Vera',
  provider: '',
  note: 'Low, measured',
  pitch: .85,
  rate: .92
}, {
  id: 'helena',
  name: 'Helena',
  provider: '',
  note: 'Bright, friendly',
  pitch: 1.1,
  rate: 1.02
}, {
  id: 'soraya',
  name: 'Soraya',
  provider: '',
  note: 'Warm, slow',
  pitch: .95,
  rate: .9
}, {
  id: 'kaia',
  name: 'Kaia',
  provider: '',
  note: 'Crisp, quick',
  pitch: 1.05,
  rate: 1.08
}, {
  id: 'clone',
  name: 'Your own voice',
  provider: 'Voice clone',
  note: 'Upload 2 minutes of clean speech',
  pitch: 1,
  rate: 1
}];
const DL_LANGS = [['en', 'English', 'en-GB'], ['sv', 'Swedish', 'sv-SE'], ['no', 'Norwegian', 'nb-NO'], ['da', 'Danish', 'da-DK'], ['fi', 'Finnish', 'fi-FI'], ['de', 'German', 'de-DE'], ['es', 'Spanish', 'es-ES'], ['pt', 'Portuguese', 'pt-PT']];
const DL_PRESETS = {
  warm: {
    name: 'Warm host',
    t: {
      warmth: 80,
      humour: 45,
      chat: 60,
      formality: 35,
      energy: 55
    }
  },
  calm: {
    name: 'Calm professional',
    t: {
      warmth: 55,
      humour: 20,
      chat: 30,
      formality: 65,
      energy: 35
    }
  },
  playful: {
    name: 'Playful',
    t: {
      warmth: 75,
      humour: 85,
      chat: 80,
      formality: 15,
      energy: 80
    }
  },
  formal: {
    name: 'Formal croupier',
    t: {
      warmth: 35,
      humour: 5,
      chat: 15,
      formality: 95,
      energy: 30
    }
  }
};
const DL_TRAITS = [['warmth', 'Warmth', 'Reserved', 'Warm'], ['humour', 'Humour', 'Serious', 'Joking'], ['chat', 'Chattiness', 'Only game calls', 'Talks a lot'], ['formality', 'Formality', 'Casual', 'Formal'], ['energy', 'Energy', 'Calm', 'Lively']];
const DL_BEHAV = [['wins', 'Comments on big wins'], ['losses', 'Comforts after losing streaks'], ['returning', 'Greets returning players by name'], ['chat', 'Answers the table chat'], ['rg', 'Reminds players to take a break after 60 min'], ['advice', 'Never gives betting advice']];
const DL_LINES = {
  en: {
    warm: ['Good evening, and welcome to the table. Take any seat you like.', 'Well played. That hand is yours.', 'Not this time. The next one could be yours.'],
    calm: ['Welcome. Place your bets when you are ready.', 'Player wins. Paid in full.', 'Dealer wins this round.'],
    playful: ['Look who’s here! Pull up a chair, the cards feel generous tonight.', 'Now that’s how it’s done!', 'Ouch. The house got lucky there.'],
    formal: ['Good evening. The table is open.', 'The player wins.', 'The house wins this hand.']
  },
  sv: {
    warm: ['God kväll och välkommen till bordet. Ta vilken plats du vill.', 'Snyggt spelat. Den handen är din.', 'Inte den här gången. Nästa kan bli din.'],
    calm: ['Välkommen. Lägg era insatser när ni är redo.', 'Spelaren vinner. Utbetalt i sin helhet.', 'Dealern vinner den här rundan.'],
    playful: ['Se vem som är här! Dra fram en stol, korten känns generösa i kväll.', 'Så ska det se ut!', 'Aj. Huset hade tur där.'],
    formal: ['God kväll. Bordet är öppet.', 'Spelaren vinner.', 'Huset vinner den här handen.']
  }
};
const DL_READY = [{
  id: 'r-astrid',
  look: 'astrid',
  name: 'Astrid',
  preset: 'warm',
  langs: ['en'],
  primary: 'en',
  voice: 'freja',
  status: 'live',
  intro: 'Warm and calm. Explains the rules when asked and keeps the game moving.',
  lines: 51,
  clips: 33
}, {
  id: 'r-vera',
  look: 'vera',
  name: 'Vera',
  preset: 'formal',
  langs: ['en'],
  primary: 'en',
  voice: 'vera',
  status: 'soon',
  intro: 'Classic croupier. Short game calls, no small talk.',
  lines: 32,
  clips: 0
}, {
  id: 'r-amira',
  look: 'amira',
  name: 'Amira',
  preset: 'playful',
  langs: ['en'],
  primary: 'en',
  voice: 'soraya',
  status: 'soon',
  intro: 'Playful and quick. Reacts to wins and chat.',
  lines: 9,
  clips: 0
}, {
  id: 'r-mei',
  look: 'mei',
  name: 'Mei',
  preset: 'calm',
  langs: ['en'],
  primary: 'en',
  voice: 'kaia',
  status: 'soon',
  intro: 'Precise and calm. Game calls only.',
  lines: 0,
  clips: 0
}];
const DL_KEY = 'bo.customDealers';
const dlLoad = () => settingRead('dealerDrafts', []);
const dlLook = id => DL_LOOKS.find(l => l.id === id) || DL_LOOKS[0];
const dlVoice = id => DL_VOICES.find(v => v.id === id) || DL_VOICES[0];
const dlLang = id => DL_LANGS.find(l => l[0] === id) || DL_LANGS[0];
function dlSay() {
  return false; /* Provider/browser speech is deliberately disconnected. */
}
function dlLinesFor(d) {
  const set = DL_LINES[d.primary] || DL_LINES.en;
  const p = d.traits ? Object.entries(DL_PRESETS).sort((a, b) => dlDist(a[1].t, d.traits) - dlDist(b[1].t, d.traits))[0][0] : d.preset;
  return {
    lines: set[p],
    translated: !DL_LINES[d.primary]
  };
}
const dlDist = (a, b) => Object.keys(a).reduce((n, k) => n + Math.abs(a[k] - b[k]), 0);
const DL_EVENTS = ['Player joins', 'Player wins', 'Player loses'];
function DealerCard({
  d,
  ready,
  onUse,
  onDup,
  onEdit,
  onDel,
  toast
}) {
  const L = dlLook(d.look),
    V = dlVoice(d.voice),
    st = ready ? d.status === 'live' ? ['live', 'Ready'] : ['closed', 'Coming soon'] : d.status === 'sent' ? ['warning', 'Generation brief'] : ['closed', 'Draft'];
  const personality = d.traits ? Object.entries(DL_PRESETS).sort((a, b) => dlDist(a[1].t, d.traits) - dlDist(b[1].t, d.traits))[0][1].name : DL_PRESETS[d.preset].name;
  return <article className="vcard">
    <div className="vcard-img" style={{
      aspectRatio: '4/3'
    }}><img src={assetUrl(L.img)} alt={d.name} style={{
        objectPosition: 'center 20%'
      }} /><Badge status={st[0]}>{st[1]}</Badge>{ready && <span className="dl-lock">Locked</span>}</div>
    <div className="vcard-b">
      <div><h3>{d.name}</h3><div className="muted" style={{
          fontSize: 13,
          marginTop: 2
        }}>{personality}{!ready && d.look ? ' · ' + L.name + ' look' : ''}</div></div>
      {d.intro && <p style={{
        margin: 0,
        fontSize: 13,
        textWrap: 'pretty'
      }}>{d.intro}</p>}
      <dl className="dl"><dt>Languages</dt><dd>{d.langs.map(l => dlLang(l)[1]).join(', ')}</dd><dt>Voice</dt><dd>{V.name}{V.provider && <span className="muted"> · {V.provider}</span>}</dd>{ready && <><dt>Material</dt><dd className="mono">{d.lines} lines · {d.clips} clips</dd></>}</dl>
    </div>
    <div className="vcard-f">
      <button className="btn sm" onClick={() => dlSay(dlLinesFor(d).lines[0], d) || toast('Voice preview is not available in this browser')}>Hear browser preview</button>
      {ready ? <><button className="btn sm" onClick={() => onDup(d)}>Duplicate and edit</button><button className="btn sm primary" style={{
          marginLeft: 'auto'
        }} disabled={d.status !== 'live'} title={d.status !== 'live' ? 'No gameplay clips yet' : ''} onClick={() => onUse(d)}>Use this dealer</button></> : <><button className="btn sm" onClick={() => onEdit(d)}>Edit</button><button className="btn sm ghost" style={{
          color: 'var(--err)'
        }} onClick={() => onDel(d)}>Delete</button></>}
    </div>
  </article>;
}
function DealerBuilder({
  init,
  onCancel,
  onSave,
  toast
}) {
  const [d, setD] = React.useState(init);
  const set = p => setD(x => ({
    ...x,
    ...p
  }));
  const L = dlLook(d.look),
    V = dlVoice(d.voice),
    {
      lines,
      translated
    } = dlLinesFor(d);
  const presetOf = Object.entries(DL_PRESETS).find(([, p]) => dlDist(p.t, d.traits) === 0);
  const tables = runtime.data.tables.filter(t => t.game === 'Blackjack');
  const checks = [[L.footage, L.footage ? 'Look: uses Astrid’s filmed footage' : 'Look: needs a new filmed set (about 33 clips)'], [d.voice !== 'clone' || d.cloneAudio, d.voice === 'clone' ? d.cloneAudio ? 'Voice sample saved with draft' : 'Voice: upload a voice sample' : 'Voice: ' + V.name], [false, 'Lines to generate in ' + d.langs.length + ' ' + (d.langs.length === 1 ? 'language' : 'languages')], [false, 'Lip sync requires generation and review'], [false, 'Review in Dealer test before going live']];
  return <>
    <PageH title={init.id ? 'Edit dealer · ' + init.name : 'Create dealer'} sub="Choose a look, then set personality, languages and voice. Changes are shown on the right." right={<div className="td-actions"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn" onClick={() => onSave({
        ...d,
        status: 'draft'
      })}>Save draft</button><button className="btn primary" disabled={!d.name.trim()} onClick={() => onSave({
        ...d,
        status: 'sent'
      })}>Save generation brief</button></div>} />
    <div className="page-b"><div className="dl-grid">
      <div className="th-ed">
        <section className="panel"><div className="panel-h"><h2>1 · Look</h2></div>
          <div className="dl-looks">{DL_LOOKS.map(l => <button key={l.id} className={'dl-look' + (d.look === l.id ? ' on' : '')} onClick={() => set({
                look: l.id
              })}><img src={assetUrl(l.img)} alt={l.name} /><span><b>{l.name}</b><small>{l.footage ? 'Filmed footage ready' : 'Needs new footage'}</small></span></button>)}</div></section>
        <section className="panel"><div className="panel-h"><h2>2 · Name and intro</h2></div>
          <div className="th-sec" style={{
              display: 'grid',
              gap: 12
            }}>
            <div className="field"><label htmlFor="dl-n">Dealer name</label><input id="dl-n" className="input" value={d.name} onChange={e => set({
                  name: e.target.value
                })} placeholder="e.g. Linnea" /></div>
            <div className="field"><label htmlFor="dl-i">Short description <span className="muted" style={{
                    fontWeight: 400
                  }}>shown to your team</span></label><input id="dl-i" className="input" value={d.intro} onChange={e => set({
                  intro: e.target.value
                })} /></div>
          </div></section>
        <section className="panel"><div className="panel-h"><h2>3 · Personality</h2></div>
          <div className="th-sec" style={{
              display: 'grid',
              gap: 14
            }}>
            <div className="field"><label>Start from</label><div className="seg" style={{
                  flexWrap: 'wrap',
                  maxWidth: '100%'
                }}>{Object.entries(DL_PRESETS).map(([k, p]) => <button key={k} className={presetOf && presetOf[0] === k ? 'on' : ''} onClick={() => set({
                    traits: {
                      ...p.t
                    }
                  })}>{p.name}</button>)}</div></div>
            {DL_TRAITS.map(([k, l, lo, hi]) => <div key={k} className="dl-slider"><div className="dl-sl-h"><b>{l}</b><span className="mono muted">{d.traits[k]}</span></div><input type="range" min="0" max="100" value={d.traits[k]} onChange={e => set({
                  traits: {
                    ...d.traits,
                    [k]: +e.target.value
                  }
                })} aria-label={l} /><div className="dl-sl-f"><span>{lo}</span><span>{hi}</span></div></div>)}
            <div className="field"><label>Behaviour</label><div style={{
                  display: 'grid',
                  gap: 8
                }}>{DL_BEHAV.map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={!!d.behav[k]} disabled={k === 'advice'} onChange={e => set({
                      behav: {
                        ...d.behav,
                        [k]: e.target.checked
                      }
                    })} />{l}{k === 'advice' && <span className="muted">· always on</span>}</label>)}</div></div>
          </div></section>
        <section className="panel"><div className="panel-h"><h2>4 · Languages</h2></div>
          <div className="th-sec" style={{
              display: 'grid',
              gap: 12
            }}>
            <div className="filters">{DL_LANGS.map(([k, l]) => {
                  const on = d.langs.includes(k);
                  return <button key={k} className={'chip' + (on ? ' on' : '')} onClick={() => {
                    const langs = on ? d.langs.filter(x => x !== k) : [...d.langs, k];
                    if (!langs.length) return;
                    set({
                      langs,
                      primary: langs.includes(d.primary) ? d.primary : langs[0]
                    });
                  }}>{l}</button>;
                })}</div>
            <div className="field"><label htmlFor="dl-p">Main language</label><select id="dl-p" className="select" value={d.primary} onChange={e => set({
                  primary: e.target.value
                })}>{d.langs.map(k => <option key={k} value={k}>{dlLang(k)[1]}</option>)}</select></div>
            <label className="chk"><input type="checkbox" checked={d.autoLang} onChange={e => set({
                  autoLang: e.target.checked
                })} />Switch to the player’s language when it is one of the above</label>
          </div></section>
        <section className="panel"><div className="panel-h"><h2>5 · Voice</h2></div>
          <div className="dl-voices">{DL_VOICES.map(v => <label key={v.id} className={'dl-voice' + (d.voice === v.id ? ' on' : '')}><input type="radio" name="dl-voice" checked={d.voice === v.id} onChange={() => set({
                  voice: v.id
                })} /><span><b>{v.name}</b><small>{[v.provider, v.note].filter(Boolean).join(' · ')}</small></span><button className="btn sm" onClick={e => {
                  e.preventDefault();
                  dlSay(lines[0], {
                    ...d,
                    voice: v.id
                  }) || toast('Voice preview is not available in this browser');
                }}>Hear browser preview</button></label>)}</div>
          {d.voice === 'clone' && <div className="th-sec"><label className="th-drop"><input type="file" accept="audio/*" onChange={async e => {
                  const f = e.target.files[0];
                  if (!f) return;
                  if (!f.type.startsWith('audio/') || f.size > 4000000) return toast('Use an audio sample under 4 MB');
                  const rd = new FileReader();
                  rd.onload = () => {
                    set({
                      cloneFile: f.name,
                      cloneAudio: rd.result
                    });
                    toast('Sample attached to this draft. Save to keep it.');
                  };
                  rd.onerror = () => toast('Sample could not be read');
                  rd.readAsDataURL(f);
                }} /><b>{d.cloneFile || 'Upload voice sample'}</b><span>MP3 or WAV, at least 2 minutes, one speaker, no music. You need the speaker’s written consent.</span></label></div>}
          <div className="note">Preview uses your browser’s voice with the chosen pitch and speed. The real voice is generated by the provider.</div></section>
        <section className="panel"><div className="panel-h"><h2>6 · Where she deals</h2></div>
          <div className="th-sec" style={{
              display: 'grid',
              gap: 12
            }}>
            <div className="field"><label>Brands</label><div className="filters">{runtime.data.brands.map(b => {
                    const on = d.brands.includes(b.id);
                    return <button key={b.id} className={'chip' + (on ? ' on' : '')} onClick={() => set({
                      brands: on ? d.brands.filter(x => x !== b.id) : [...d.brands, b.id]
                    })}>{b.name}</button>;
                  })}</div></div>
            <div className="field"><label>Tables</label><div style={{
                  display: 'grid',
                  gap: 6
                }}>{tables.map(t => <label key={t.id} className="chk"><input type="checkbox" checked={d.tables.includes(t.id)} onChange={e => set({
                      tables: e.target.checked ? [...d.tables, t.id] : d.tables.filter(x => x !== t.id)
                    })} />{t.name} <span className="muted">· {t.limits}</span></label>)}</div></div>
          </div></section>
      </div>
      <div className="dl-pv">
        <section className="panel" style={{
            overflow: 'hidden'
          }}>
          <img src={assetUrl(L.img)} alt="" style={{
              width: '100%',
              aspectRatio: '4/3',
              objectFit: 'cover',
              objectPosition: 'center 20%',
              display: 'block'
            }} />
          <div className="vcard-b">
            <div><h3 style={{
                  fontFamily: 'var(--head)',
                  fontSize: 20,
                  margin: 0
                }}>{d.name || 'Unnamed dealer'}</h3><div className="muted" style={{
                  fontSize: 13
                }}>{presetOf ? presetOf[1].name : 'Custom personality'} · {d.langs.map(l => dlLang(l)[1]).join(', ')}</div></div>
            <div style={{
                display: 'grid',
                gap: 6
              }}>{DL_TRAITS.map(([k, l]) => <div key={k} className="dl-tr"><span>{l}</span><span className="bar"><i style={{
                      width: d.traits[k] + '%'
                    }}></i></span></div>)}</div>
            <div><div style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 6
                }}>Sample lines{translated ? ' · translated when generated' : ''}</div>
              {lines.map((ln, i) => <div key={i} className="dl-line"><div><small>{DL_EVENTS[i]}</small><span>“{ln}”</span></div><button className="btn sm" onClick={() => dlSay(ln, d) || toast('Voice preview is not available in this browser')}>Hear browser preview</button></div>)}</div>
            <div><div style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 6
                }}>Before she can deal</div>
              {checks.map(([ok, l], i) => <div key={i} className="dl-chk"><span className={ok ? 'ok' : ''}>{ok ? '✓' : '·'}</span>{l}</div>)}</div>
          </div>
        </section>
      </div>
    </div></div>
  </>;
}
function DealersHub({
  toast
}) {
  if (runtime.surface === 'partner') return <PartnerDealerSelection toast={toast} />;
  const [mine, setMine] = React.useState(dlLoad),
    [edit, setEdit] = React.useState(null),
    [use, setUse] = React.useState(null),
    [confirm, setConfirm] = React.useState(null);
  const cat = useJson('/bo/jakob-catalog.json');
  const save = async list => {
    await settingSave('dealerDrafts', list);
    setMine(list);
  };
  const blank = {
    name: '',
    intro: '',
    look: 'astrid',
    traits: {
      ...DL_PRESETS.warm.t
    },
    behav: {
      wins: true,
      losses: true,
      returning: false,
      chat: true,
      rg: true,
      advice: true
    },
    langs: ['en'],
    primary: 'en',
    autoLang: true,
    voice: 'freja',
    brands: [],
    tables: []
  };
  const dup = r => setEdit({
    ...blank,
    name: r.name + ' (copy)',
    intro: r.intro,
    look: r.look,
    traits: {
      ...DL_PRESETS[r.preset].t
    },
    langs: [...r.langs],
    primary: r.primary,
    voice: r.voice
  });
  if (edit) return <DealerBuilder init={edit} toast={toast} onCancel={() => setEdit(null)} onSave={async d => {
    try {
      const id = d.id || 'c' + crypto.randomUUID();
      await save(d.id ? mine.map(x => x.id === d.id ? d : x) : [{
        ...d,
        id
      }, ...mine]);
      setEdit(null);
      toast(d.status === 'sent' ? 'Generation brief saved. Generation has not started.' : 'Dealer draft saved');
    } catch (e) {
      notifyError(e);
    }
  }} />;
  return <>
    <PageH title="Dealers" sub="Current filmed dealer and character concepts. Save local drafts with personality, languages and voice; generation and game activation are separate steps." src={assetUrl("bo.mjs \xB7 dealers \xB7 server.mjs dealerScan \xB7 jakob-catalog.json")} right={<div className="td-actions"><a className="btn" href="#test" style={{
        textDecoration: 'none'
      }}>Test a dealer</a><button className="btn primary" onClick={() => setEdit(blank)}>Create dealer</button></div>} />
    <div className="page-b">
      <section style={{
        display: 'grid',
        gap: 12
      }}><div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12
        }}><h2 style={{
            margin: 0,
            fontSize: 16
          }}>Ready dealers</h2><span className="muted" style={{
            fontSize: 13
          }}>Made by Scout. Locked, but you can duplicate one and edit the copy.</span></div>
        <div className="grid-cards">{DL_READY.map(base => {
            const m = runtime.raw.game.manifest,
              archive = runtime.data2.archive.find(a => a.key === base.look);
            const d = {
              ...base,
              lines: base.look === 'astrid' ? m?.repliker.length ?? '—' : archive?.voiceLines ?? '—',
              clips: base.look === 'astrid' ? (m?.deal.length ?? 0) + (m?.idle.length ?? 0) : archive?.speak ?? 0
            };
            return <DealerCard key={d.id} d={d} ready toast={toast} onUse={setUse} onDup={dup} />;
          })}</div></section>
      <section style={{
        display: 'grid',
        gap: 12
      }}><h2 style={{
          margin: 0,
          fontSize: 16
        }}>Your dealers</h2>
        {mine.length ? <div className="grid-cards">{mine.map(d => <DealerCard key={d.id} d={d} toast={toast} onEdit={setEdit} onDel={x => setConfirm({
            title: 'Delete ' + x.name,
            danger: true,
            body: 'Removes this saved character draft. Existing media files are kept.',
            cta: 'Delete dealer',
            ok: async () => {
              try {
                await save(mine.filter(m => m.id !== x.id));
                toast('Draft deleted');
              } catch (e) {
                notifyError(e);
              }
            }
          })} />)}</div> : <section className="panel"><EmptyState title="No dealers of your own yet" body="Create a dealer, or duplicate a ready one and change her personality, languages or voice." action={<button className="btn primary" onClick={() => setEdit(blank)}>Create dealer</button>} /></section>}</section>
      <section className="panel"><div className="panel-h"><h2>How Astrid runs today</h2></div>
        <div className="rows">
          <div><span>Game logic</span><span>The server owns the shoe, draws, rules and payouts. Clips present server events.</span></div>
          <div><span>Catalog</span><span className="mono">{cat && cat.project ? cat.project.events.length + ' events · ' + cat.families.length + ' families · ' + cat.items.length + ' media' : '…'}</span></div>
          <div><span>Voice</span><span>{runtime.raw.game.manifest?.rost?.leverantor || 'Unavailable'} · {runtime.raw.game.manifest?.rost?.namn || 'Unavailable'}</span></div>
          <div><span>Presentation</span><span>OpenClaw direction. Production activation not verified.</span></div>
        </div></section>
    </div>
    {use && <Modal open title={'Use ' + use.name} onClose={() => setUse(null)} footer={<><button className="btn" onClick={() => setUse(null)}>Cancel</button><button className="btn primary" disabled title="The connected runtime does not support dealer reassignment">Assign</button></>}>
      <div style={{
        display: 'grid',
        gap: 10
      }}><p style={{
          margin: 0,
          fontSize: 13.5
        }}>Choose the tables where {use.name} deals. The current game runs Astrid. Dealer reassignment is not exposed by this runtime.</p>
        {runtime.data.tables.filter(t => t.game === 'Blackjack').map(t => <label key={t.id} className="chk"><input type="checkbox" defaultChecked={t.dealer === 'astrid'} />{t.name} <span className="muted">· {t.limits}</span></label>)}</div></Modal>}
    <Confirm state={confirm} onClose={() => setConfirm(null)} />
  </>;
}

// Source: v-games.jsx at 7dee0901; see source-provenance.json.
const GM = {
  bj: {
    name: 'Blackjack',
    key: 'Blackjack',
    status: 'live',
    note: null,
    sides: [['pp', 'Perfect Pairs'], ['tp', '21+3']],
    seats: 7,
    rules: [['Decks', '8, cut at draw 312'], ['Dealer stands', 'All 17s'], ['Blackjack pays', '3 : 2'], ['Insurance', '2 : 1'], ['Split', 'Any pair, up to 4 hands'], ['Double after split', 'Allowed'], ['Betting window', '20 s after first bet'], ['Decision time', '60 s']]
  },
  roulette: {
    name: 'Roulette',
    key: 'Roulette',
    status: 'dev',
    note: 'Roulette is in development. You can prepare tables, limits and dealers now. Tables open when the game is released.',
    sides: [],
    seats: 0,
    rules: [['Wheel', 'European, single zero'], ['Straight up', '35 : 1'], ['Split', '17 : 1'], ['Red / black', '1 : 1'], ['Betting window', '15 s'], ['Players', 'No seat limit']]
  },
  baccarat: {
    name: 'Baccarat',
    key: 'Baccarat',
    status: 'soon',
    note: 'Baccarat is planned. Tables can be prepared once the game is in testing.',
    sides: [['pp', 'Player pair'], ['bp', 'Banker pair']],
    seats: 7,
    rules: [['Decks', '8'], ['Banker', '0.95 : 1 (5% commission)'], ['Player', '1 : 1'], ['Tie', '8 : 1'], ['Betting window', '15 s']]
  }
};
const GM_TIERS = {
  bj: [['classic', 'Classic', 5, 2000], ['high', 'High roller', 100, 50000], ['vip', 'VIP Salon', 1000, 1000000]],
  roulette: [['classic', 'Classic', 1, 1000], ['high', 'High roller', 25, 25000]],
  baccarat: [['classic', 'Classic', 10, 5000], ['vip', 'VIP', 500, 250000]]
};
const GM_ROOMS = [['Dark Hall', '/bo/img/darkhall-room.jpg'], ['Mahogany Privé', '/bo/img/prive-room.jpg'], ['Golden Salon', '/bo/img/goldensalon-room.jpg'], ['Azure Venue', '/bo/img/azure-room.jpg']];
const gmMoney = n => '$' + Number(n).toLocaleString('en-US');
const gmTierOf = (g, t) => {
  const m = /\$([\d,]+)\s*–\s*\$([\d,]+)/.exec(t.limits || '');
  if (!m) return null;
  const lo = +m[1].replace(/,/g, '');
  return (GM_TIERS[g].find(x => x[2] === lo) || [null])[0];
};
function GamePage({
  game,
  toast,
  brand,
  tables = [],
  setTables
}) {
  const G = GM[game],
    [tiers, setTiers] = React.useState(() => settingRead('tiers', {})[game] || GM_TIERS[game]),
    [edit, setEdit] = React.useState(null),
    [drafts, setDrafts] = React.useState(() => settingRead('tableDrafts', []));
  const saveTiers = async () => {
    try {
      if (tiers.some(t => !t[1].trim() || t[2] < 0 || t[3] < t[2])) throw Error('Enter valid tier names and limits');
      await settingSave('tiers', {
        ...settingRead('tiers', {}),
        [game]: tiers
      });
      toast('Limit tier drafts saved');
    } catch (e) {
      notifyError(e);
    }
  };
  const rows = [...tables, ...drafts].filter(t => t.game === G.key && (brand === 'all' || t.brands.includes(brand)));
  const custom = typeof dlLoad === 'function' ? dlLoad() : [];
  const dealers = [...runtime.data.dealers.map(d => ({
    id: d.id,
    name: d.name,
    note: d.id === 'astrid' ? 'Shared game' : 'Legacy clips'
  })), ...custom.map(c => ({
    id: c.id,
    name: c.name,
    note: 'Your dealer · ' + (c.status === 'sent' ? 'generating' : 'draft')
  }))];
  const dName = id => (dealers.find(d => d.id === id) || {}).name;
  const save = async t => {
    try {
      const id = t.runtime ? 'draft-' + t.id : t.id,
        draft = {
          ...t,
          id,
          sourceTable: t.sourceTable || (t.runtime ? t.id : null),
          runtime: false,
          status: 'closed',
          phase: 'Draft',
          issue: 'Design draft',
          open: 0,
          prepared: 0,
          today: 0,
          seats: Array(G.seats).fill(0),
          seatInfo: []
        };
      const next = drafts.some(x => x.id === id) ? drafts.map(x => x.id === id ? draft : x) : [...drafts, draft];
      await settingSave('tableDrafts', next);
      setDrafts(next);
      setEdit(null);
      toast(t.name + ' design draft saved');
    } catch (e) {
      notifyError(e);
    }
  };
  const blank = () => ({
    id: (game === 'bj' ? 'BJ-' : game === 'roulette' ? 'RL-' : 'BC-') + crypto.randomUUID().slice(0, 8),
    name: G.name + ' ' + (rows.length + 1),
    room: 'Dark Hall',
    game: G.key,
    sides: '—',
    dealer: null,
    since: null,
    status: G.status === 'live' ? 'closed' : 'closed',
    issue: G.status === 'live' ? 'Not opened yet' : 'Waiting for game release',
    seats: G.seats ? Array(G.seats).fill(0) : [],
    seatInfo: [],
    phase: 'Closed',
    timer: '—',
    round: '—',
    open: 0,
    today: 0,
    limits: gmMoney(tiers[0][2]) + ' – ' + gmMoney(tiers[0][3]),
    brands: runtime.data.brands.map(b => b.id),
    isNew: true
  });
  const stB = {
    live: ['live', 'Live'],
    dev: ['warning', 'In development'],
    soon: ['closed', 'Planned']
  }[G.status];
  return <>
    <PageH title={G.name} sub="Live tables and shared design drafts: limits, dealer, background and brands. Saving a draft does not change active game rules." right={<div className="td-actions"><Badge status={stB[0]}>{stB[1]}</Badge><a className="btn" href="#test" style={{
        textDecoration: 'none'
      }}>Test a table</a><button className="btn primary" onClick={() => setEdit(blank())}>Add table</button></div>} />
    <div className="page-b">
      {G.note && <div className="legacy-note"><Badge status={stB[0]}>{stB[1]}</Badge><div>{G.note}</div></div>}
      <section className="panel"><div className="panel-h"><h2>Tables <span className="count">{rows.length}</span></h2><span className="muted" style={{
            fontSize: 12.5
          }}>{rows.filter(t => t.status === 'live').length} live now</span></div>
        {rows.length ? <div className="scroll-x"><table className="tbl"><thead><tr><th>Table</th><th>Status</th><th>Limit tier</th><th>Limits</th><th>Dealer</th><th>Background</th><th>Brands</th>{G.sides.length > 0 && <th>Side bets</th>}<th></th></tr></thead>
          <tbody>{rows.map(t => {
                const tr = gmTierOf(game, t);
                return <tr key={t.id} className="click" onClick={() => setEdit({
                  ...t
                })}>
            <td><b style={{
                      fontWeight: 600
                    }}>{t.name}{!t.runtime && ' · Draft'}</b> <span className="mono muted">{t.id}</span></td><td><Badge status={t.status} /></td>
            <td>{tr ? (tiers.find(x => x[0] === tr) || [0, 'Custom'])[1] : 'Custom'}</td><td className="mono">{t.limits}</td>
            <td>{t.dealer ? <span className="who-row" style={{
                      gap: 8
                    }}>{runtime.data.dealers.some(d => d.id === t.dealer) && <img className="pic" style={{
                        width: 24,
                        height: 24
                      }} src={assetUrl('/bo/img/' + t.dealer + '-portrait.jpg')} alt="" />}{dName(t.dealer)}</span> : <span className="muted">None</span>}</td>
            <td>{t.room}</td><td><BrandTags ids={t.brands} /></td>{G.sides.length > 0 && <td className="muted">{t.sides}</td>}<td><button className="btn sm" onClick={e => {
                      e.stopPropagation();
                      setEdit({
                        ...t
                      });
                    }}>Edit</button></td></tr>;
              })}</tbody></table></div> : <EmptyState title={'No ' + G.name.toLowerCase() + ' tables yet'} body="Add a table to set its limits, dealer and background." action={<button className="btn primary" onClick={() => setEdit(blank())}>Add table</button>} />}
      </section>
      <div className="two">
        <section className="panel"><div className="panel-h"><h2>Limit tiers</h2><button className="btn sm" onClick={saveTiers}>Save tiers</button><button className="btn sm" onClick={() => {
              setTiers([...tiers, ['t' + Date.now(), 'New tier', 10, 1000]]);
              toast('Tier added to draft. Save tiers to keep it.');
            }}>Add tier</button></div>
          <table className="tbl"><thead><tr><th>Tier</th><th className="num">Min bet</th><th className="num">Max bet</th><th className="num">Tables</th></tr></thead>
            <tbody>{tiers.map((tr, i) => <tr key={tr[0]}><td><input className="input" style={{
                    width: 150
                  }} value={tr[1]} onChange={e => setTiers(tiers.map((x, k) => k === i ? [x[0], e.target.value, x[2], x[3]] : x))} aria-label="Tier name" /></td>
              <td className="num"><input className="input mono" style={{
                    width: 100,
                    textAlign: 'right'
                  }} value={tr[2]} onChange={e => setTiers(tiers.map((x, k) => k === i ? [x[0], x[1], +e.target.value || 0, x[3]] : x))} aria-label="Min bet" /></td>
              <td className="num"><input className="input mono" style={{
                    width: 120,
                    textAlign: 'right'
                  }} value={tr[3]} onChange={e => setTiers(tiers.map((x, k) => k === i ? [x[0], x[1], x[2], +e.target.value || 0] : x))} aria-label="Max bet" /></td>
              <td className="num mono">{rows.filter(t => gmTierOf(game, t) === tr[0]).length}</td></tr>)}</tbody></table></section>
        <section className="panel"><div className="panel-h"><h2>Game rules</h2><span className="muted" style={{
              fontSize: 12.5
            }}>Same on every table</span></div><div className="rows">{G.rules.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}</div></section>
      </div>
    </div>
    {edit && <Drawer open onClose={() => setEdit(null)} width={560}>
      <div className="dr-h"><div><div className="mono muted">{edit.id} · {G.name} · DESIGN DRAFT</div><h2>{edit.isNew ? 'New table' : edit.name}</h2></div><button className="btn ghost sm" onClick={() => setEdit(null)}>Close</button></div>
      <div className="dr-b" style={{
        display: 'grid',
        gap: 16,
        paddingTop: 20
      }}>
        <div className="field"><label htmlFor="gt-n">Table name</label><input id="gt-n" className="input" value={edit.name} onChange={e => setEdit({
            ...edit,
            name: e.target.value
          })} /></div>
        <div className="field"><label>Limit tier</label><div className="opts">{tiers.map(tr => {
              const lim = gmMoney(tr[2]) + ' – ' + gmMoney(tr[3]);
              return <label key={tr[0]} className={'opt' + (edit.limits === lim ? ' on' : '')}><input type="radio" name="gt-tier" checked={edit.limits === lim} onChange={() => setEdit({
                  ...edit,
                  limits: lim
                })} /><span style={{
                  fontWeight: 600
                }}>{tr[1]}</span><span className="mono muted" style={{
                  marginLeft: 'auto'
                }}>{lim}</span></label>;
            })}</div></div>
        <div className="field"><label>Dealer</label><div className="opts">{[{
              id: null,
              name: 'No dealer yet',
              note: ''
            }, ...dealers].map(d => <label key={d.id || 'none'} className={'opt' + (edit.dealer === d.id ? ' on' : '')}><input type="radio" name="gt-d" checked={edit.dealer === d.id} onChange={() => setEdit({
                ...edit,
                dealer: d.id
              })} />{d.id && runtime.data.dealers.some(x => x.id === d.id) && <img className="pic" style={{
                width: 26,
                height: 26
              }} src={assetUrl('/bo/img/' + d.id + '-portrait.jpg')} alt="" />}<span style={{
                fontWeight: 600
              }}>{d.name}</span><span className="muted" style={{
                marginLeft: 'auto',
                fontSize: 12.5
              }}>{d.note}</span></label>)}</div><a href="#dealers" style={{
            fontSize: 12.5
          }}>View available dealers →</a></div>
        <div className="field"><label>Background</label><div className="gm-bgs">{GM_ROOMS.map(([n, img]) => <button key={n} className={'gm-bg' + (edit.room === n ? ' on' : '')} onClick={() => setEdit({
              ...edit,
              room: n
            })}><img src={assetUrl(img)} alt="" /><span>{n}</span></button>)}</div><a href="#background" style={{
            fontSize: 12.5
          }}>Manage casino backgrounds →</a></div>
        <div className="field"><label>Offered on</label><div className="filters">{runtime.data.brands.map(b => {
              const on = edit.brands.includes(b.id);
              return <button key={b.id} className={'chip' + (on ? ' on' : '')} onClick={() => setEdit({
                ...edit,
                brands: on ? edit.brands.filter(x => x !== b.id) : [...edit.brands, b.id]
              })}>{b.name}</button>;
            })}</div></div>
        {G.sides.length > 0 && <div className="field"><label>Side bets</label><div style={{
            display: 'grid',
            gap: 6
          }}>{G.sides.map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={(edit.sides || '').includes(l)} onChange={e => {
                const cur = (edit.sides || '').split(' · ').filter(x => x && x !== '—');
                const nx = e.target.checked ? [...cur, l] : cur.filter(x => x !== l);
                setEdit({
                  ...edit,
                  sides: nx.join(' · ') || '—'
                });
              }} />{l}</label>)}</div></div>}
      </div>
      <div className="modal-f" style={{
        position: 'sticky',
        bottom: 0,
        borderRadius: 0
      }}><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn primary" disabled={!edit.name.trim()} onClick={() => save({
          ...edit,
          isNew: undefined
        })}>{edit.isNew ? 'Add draft' : 'Save draft'}</button></div>
    </Drawer>}
  </>;
}
function CasinoBackground({
  toast,
  brand,
  tables = []
}) {
  const [sel, setSel] = React.useState(() => settingRead('backgrounds', {}).selected || {});
  const [b, setB] = React.useState(brand === 'all' ? 'scout' : brand),
    [own, setOwn] = React.useState(() => settingRead('backgrounds', {}).own || []);
  React.useEffect(() => {
    if (brand !== 'all') setB(brand);
  }, [brand]);
  const cur = sel[b] || 'Dark Hall';
  const pick = async n => {
    try {
      const nx = {
        ...sel,
        [b]: n
      };
      await settingSave('backgrounds', {
        selected: nx,
        own
      });
      setSel(nx);
      toast(n + ' reference saved for ' + brandName(b));
    } catch (e) {
      notifyError(e);
    }
  };
  const all = [...GM_ROOMS.filter(([n]) => runtime.surface === 'internal' || n === 'Dark Hall').map(([n, img]) => ({
    n,
    img,
    scene: (runtime.data2.rooms.find(r => r.name === n) || {}).scene,
    filmed: n === 'Dark Hall'
  })), ...own];
  return <>
    <PageH title="Casino background" sub="Brand background references stored in this tab only. Astrid is filmed in Dark Hall; changing a reference requires new footage before activation." right={<div className="field" style={{
      minWidth: 200
    }}><label htmlFor="cb-b">Brand</label><select id="cb-b" className="select" value={b} onChange={e => setB(e.target.value)}>{runtime.data.brands.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>} />
    <div className="page-b">
      <div className="grid-cards">{all.map(r => <article key={r.n} className={'vcard gm-room' + (cur === r.n ? ' on' : '')}>
        <div className="vcard-img"><img src={assetUrl(r.img)} alt={r.n} />{cur === r.n ? <Badge status="live">Selected reference</Badge> : r.filmed ? <Badge status="live">Filmed</Badge> : <Badge status="closed">Needs filming</Badge>}</div>
        <div className="vcard-b"><h3>{r.n}</h3><div className="muted" style={{
              fontSize: 13
            }}>{r.scene || 'Your own background'}</div><div style={{
              fontSize: 12.5
            }} className="muted">Tables in this room: {tables.filter(t => t.room === r.n).map(t => t.name).join(', ') || 'none'}</div></div>
        <div className="vcard-f"><button className={'btn sm' + (cur === r.n ? '' : ' primary')} disabled={cur === r.n} onClick={() => pick(r.n)}>{cur === r.n ? 'Selected for ' + brandName(b) : 'Select for ' + brandName(b)}</button></div>
      </article>)}
        {runtime.surface === 'internal' && <label className="vcard gm-up"><input type="file" accept="image/*" hidden onChange={async e => {
            const f = e.target.files[0];
            if (!f) return;
            try {
              const img = await imageFile(f),
                next = [...own, {
                  n: f.name.replace(/\.\w+$/, '') + ' ' + (own.length + 1),
                  img,
                  scene: 'Uploaded reference · needs filming'
                }];
              await settingSave('backgrounds', {
                selected: sel,
                own: next
              });
              setOwn(next);
              toast('Background reference saved');
            } catch (e) {
              notifyError(e);
            }
          }} /><b>Add your own casino</b><span className="muted">Upload a reference image of the room. Scout films the dealer in it before it can go live.</span></label>}
      </div>
    </div>
  </>;
}

// Source: ops-layouts.jsx at 7dee0901; see source-provenance.json.
const OPS_ROOMIMG = {
  'Dark Hall': '/bo/img/darkhall-room.jpg',
  'Mahogany Privé': '/bo/img/prive-room.jpg',
  'Golden Salon': '/bo/img/goldensalon-room.jpg',
  'Azure Venue': '/bo/img/azure-room.jpg'
};
const opsDealer = id => (runtime.data.dealers.find(d => d.id === id) || {}).name;
const opsPortrait = id => id ? '/bo/img/' + id + '-portrait.jpg' : null;
const OPS_ORDER = {
  error: 0,
  warning: 1,
  live: 2,
  paused: 3,
  closed: 4
};
function OpsMetrics({
  tables,
  seated,
  openTotal,
  attention,
  brand
}) {
  const live = tables.filter(x => x.status !== 'closed' && x.status !== 'paused').length;
  const today = tables.reduce((n, x) => n + (x.today || 0), 0) * (brand === 'all' ? 1 : 1);
  return <div className="ops-m">
    {(() => {
      const e = attention.filter(a => a.sev === 'error').length,
        w = attention.filter(a => a.sev === 'warning').length,
        pl = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');
      return <div className={'ops-mi' + (e ? ' alert' : w ? ' warn' : '')}><span>Needs action</span><b>{attention.length}</b><small>{pl(e, 'error')} · {pl(w, 'warning')}</small></div>;
    })()}
    <div className="ops-mi"><span>Tables running</span><b>{live} <em>of {tables.length}</em></b><small>{tables.filter(t => t.status === 'paused').length} paused · {tables.filter(t => t.status === 'closed').length} closed</small></div>
    <div className="ops-mi"><span>Players at tables</span><b>{seated}</b><small>Across {tables.filter(t => t.seatInfo.some(s => s.playerId)).length} tables</small></div>
    <div className="ops-mi"><span>Open stakes</span><b>{money(openTotal)}</b><small>Settles with the current rounds</small></div>
    <div className="ops-mi"><span>Result today</span><b className={today < 0 ? 'neg' : ''}>{money(today, true)}</b><small>House, settled rounds</small></div>
  </div>;
}
function OpsAttnCards({
  items,
  onAct
}) {
  if (!items.length) return <section className="panel attn-empty"><Badge status="closed">Monitoring</Badge><span className="muted">Fixture data only; table state and balances are not connected. Automated incident and player-risk monitoring is not available.</span></section>;
  return <section style={{
    display: 'grid',
    gap: 10
  }}>
    <div className="ops-sh"><h2>Needs action</h2><span className="muted">Most urgent first</span></div>
    <div className="ops-ac">{items.map((a, i) => <article key={i} className={'ops-a ops-a--' + a.sev}>
      <div className="ops-a-h"><Badge status={a.sev}>{a.sev === 'error' ? 'Error' : 'Warning'}</Badge><span className="mono muted">{a.age}</span></div>
      <div><b>{a.title}</b><div className="muted" style={{
            fontSize: 13,
            marginTop: 2
          }}>{a.detail}</div></div>
      <div className="mono muted" style={{
          fontSize: 12
        }}>{a.table}{a.player ? ' · ' + a.player : ''}{a.brand ? ' · ' + brandName(a.brand) : ''}</div>
      <div className="ops-a-f">{a.action === 'dealer' && <button className="btn primary sm" onClick={() => onAct('dealer', a)}>Change dealer</button>}{a.action === 'block' && <button className="btn primary sm" onClick={() => onAct('block', a)}>Review player</button>}<button className="btn sm" onClick={() => onAct('open', a)}>Open table</button></div>
    </article>)}</div>
  </section>;
}
function OpsTile({
  t,
  onOpen,
  sel
}) {
  const seated = t.seats.length ? t.seats.filter(Boolean).length : t.seatInfo.length;
  return <button className={'ops-t ops-t--' + t.status + (sel ? ' sel' : '')} onClick={() => onOpen(t.id)}>
    <div className="ops-t-h"><div><b>{t.name}</b><span className="mono muted">{t.id} · {t.game}</span></div><Badge status={t.status} /></div>
    {t.issue && <div className={'ops-t-i is-' + t.status}>{t.issue}</div>}
    <div className="ops-t-d">{t.dealer ? <><img src={assetUrl(opsPortrait(t.dealer))} alt="" /><span><b>{opsDealer(t.dealer)}</b><small>since <span className="mono">{t.since}</span></small></span></> : <span className="muted">No dealer</span>}
      <span className="ops-t-ph"><b>{t.phase}</b>{t.timer !== '—' && <small className="mono">{t.timer}</small>}</span></div>
    <div className="ops-t-s">{t.seats.length ? <><span className="seats">{t.seats.map((s, i) => <i key={i} className={s ? 'on' : ''}></i>)}</span><span className="mono muted">{seated}/{t.seats.length}</span></> : <span className="muted">{seated} players · no seat limit</span>}<span style={{
        marginLeft: 'auto'
      }}><BrandTags ids={t.brands} /></span></div>
    <div className="ops-t-f"><div><small>Open stakes</small><b className="mono">{t.open ? money(t.open) : '—'}</b></div><div><small>Result today</small><b className={'mono' + (t.today < 0 ? ' neg' : '')}>{t.today ? money(t.today, true) : '—'}</b></div><div><small>Round</small><b className="mono">{t.round}</b></div></div>
  </button>;
}
function OpsFloor({
  tables,
  attention,
  act,
  onOpen,
  open,
  openTotal,
  seated,
  brand
}) {
  const rooms = [...new Set(tables.map(t => t.room))];
  return <>
    <OpsMetrics tables={tables} seated={seated} openTotal={openTotal} attention={attention} brand={brand} />
    <OpsAttnCards items={attention} onAct={act} />
    {rooms.map(r => {
      const rt = tables.filter(t => t.room === r).sort((a, b) => OPS_ORDER[a.status] - OPS_ORDER[b.status]);
      return <section key={r} style={{
        display: 'grid',
        gap: 10
      }}>
      <div className="ops-sh"><div className="ops-room">{OPS_ROOMIMG[r] && <img src={assetUrl(OPS_ROOMIMG[r])} alt="" />}<h2>{r}</h2></div><span className="muted">{rt.length} {rt.length === 1 ? 'table' : 'tables'} · {rt.filter(t => t.status === 'live').length} live</span></div>
      <div className="ops-tg">{rt.map(t => <OpsTile key={t.id} t={t} onOpen={onOpen} sel={open === t.id} />)}</div>
    </section>;
    })}
    <ResultPanel brand={brand} open={openTotal} />
  </>;
}
function OpsCommand({
  tables,
  attention,
  act,
  onOpen,
  open,
  openTotal,
  seated,
  brand
}) {
  const D0 = runtime.data,
    r = resultFor('today', brand);
  const hr = Array.from({
    length: 24
  }, (_, h) => recordedRows(brand).filter(r => new Date(r.at).toISOString().slice(0, 10) === new Date(D0.updatedAt).toISOString().slice(0, 10) && new Date(r.at).getUTCHours() === h).reduce((n, r) => n + r.house, 0));
  const max = Math.max(1, ...hr.map(Math.abs));
  const rooms = [...new Set(tables.map(t => t.room))];
  const ledger = D0.ledger.filter(l => brand === 'all' || l.brand === brand);
  return <div className="ops-cmd">
    <div style={{
      display: 'grid',
      gap: 20,
      minWidth: 0,
      gridTemplateColumns: 'minmax(0,1fr)'
    }}>
      <Attention items={attention} onAct={act} />
      <section className="panel"><div className="panel-h"><h2>Tables</h2><span className="muted" style={{
            fontSize: 12.5
          }}>Grouped by room · problems first</span></div>
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Status</th><th>Table</th><th>Dealer</th><th>Players</th><th>Now</th><th className="num">Open stakes</th><th className="num">Today</th></tr></thead>
          {rooms.map(rm => <tbody key={rm}><tr className="ops-grp"><td colSpan="7">{rm}</td></tr>{tables.filter(t => t.room === rm).sort((a, b) => OPS_ORDER[a.status] - OPS_ORDER[b.status]).map(t => {
                const s = t.seats.length ? t.seats.filter(Boolean).length : t.seatInfo.length;
                return <tr key={t.id} className={'click' + (open === t.id ? ' sel' : '')} onClick={() => onOpen(t.id)}>
            <td><Badge status={t.status} /></td><td><b style={{
                      fontWeight: 600
                    }}>{t.name}</b> <span className="mono muted">{t.id}</span>{t.issue && <div className={'row-issue is-' + t.status}>{t.issue}</div>}</td>
            <td>{t.dealer ? <span className="who-row" style={{
                      gap: 8
                    }}><img className="pic" style={{
                        width: 24,
                        height: 24
                      }} src={assetUrl(opsPortrait(t.dealer))} alt="" />{opsDealer(t.dealer)}</span> : <span className="muted">—</span>}</td>
            <td className="mono">{t.seats.length ? s + '/' + t.seats.length : s}</td><td>{t.phase}{t.timer !== '—' && <span className="mono muted"> {t.timer}</span>}</td>
            <td className="num mono">{t.open ? money(t.open) : '—'}</td><td className={'num mono' + (t.today < 0 ? ' neg' : '')}>{t.today ? money(t.today, true) : '—'}</td></tr>;
              })}</tbody>)}
        </table></div></section>
    </div>
    <aside className="ops-side">
      <section className="panel"><div className="panel-h"><h2>Today</h2><a href="#stats" style={{
            fontSize: 12.5
          }}>Statistics →</a></div>
        <div style={{
          padding: '0 16px 14px',
          display: 'grid',
          gap: 12
        }}>
          <div><div className="muted" style={{
              fontSize: 12.5
            }}>House result</div><div className={'mono' + (r.result < 0 ? ' neg' : '')} style={{
              fontSize: 30,
              letterSpacing: '-.03em'
            }}>{money(r.result, true)}</div><div className="muted" style={{
              fontSize: 12.5
            }}>Hold <span className="mono">{r.stakes ? (r.result / r.stakes * 100).toFixed(2) : '—'}%</span> · <span className="mono">{r.rounds}</span> rounds</div></div>
          <svg viewBox="0 0 180 48" width="100%" height="48" preserveAspectRatio="none" aria-label="House result per hour">{hr.map((v, i) => <rect key={i} x={i * 10 + 1.5} width="7" y={v >= 0 ? 24 - v / max * 22 : 24} height={Math.max(1, Math.abs(v) / max * 22)} rx="1.5" fill={v < 0 ? 'var(--err)' : i === hr.length - 1 ? 'var(--ink)' : '#9AA1A9'}></rect>)}<line x1="0" x2="180" y1="24" y2="24" stroke="rgba(10,11,13,.2)" strokeWidth=".5"></line></svg>
          <div className="rp-axis"><span>00:00</span><span>Now</span></div>
          <div className="rows" style={{
            margin: '0 -16px'
          }}><div><span>Players at tables</span><b className="mono" style={{
                fontWeight: 500
              }}>{seated}</b></div><div><span>Open stakes</span><b className="mono" style={{
                fontWeight: 500
              }}>{money(openTotal)}</b></div><div><span>Tables running</span><b className="mono" style={{
                fontWeight: 500
              }}>{tables.filter(x => x.status === 'live' || x.status === 'warning' || x.status === 'error').length} of {tables.length}</b></div></div>
        </div></section>
      <section className="panel"><div className="panel-h"><h2>Dealers</h2></div>
        <div className="rows">{runtime.data.dealers.map(d => {
            const on = tables.filter(t => t.dealer === d.id);
            const bad = on.find(t => t.status === 'error');
            return <div key={d.id} style={{
              alignItems: 'center'
            }}><span className="who-row" style={{
                gap: 8,
                color: 'var(--ink)'
              }}><img className="pic" style={{
                  width: 26,
                  height: 26
                }} src={assetUrl(opsPortrait(d.id))} alt="" />{d.name}</span><span>{bad ? <Badge status="error">Not responding</Badge> : on.length ? <span className="mono">{on.map(t => t.id).join(', ')}</span> : <span className="muted">Free</span>}</span></div>;
          })}</div></section>
      <section className="panel"><div className="panel-h"><h2>Live feed</h2><a href="#tx" style={{
            fontSize: 12.5
          }}>All →</a></div>
        <div className="ops-feed">{ledger.map(l => {
            const h = l.stake - l.payout;
            return <div key={l.round + ':' + l.player}><span className="mono muted">{l.time.slice(0, 5)}</span><span><b className="mono" style={{
                  fontWeight: 500
                }}>{l.player}</b> <span className="muted">· {l.table}</span></span><span className={'mono' + (h < 0 ? ' neg' : '')}>{money(h, true)}</span></div>;
          })}</div></section>
    </aside>
  </div>;
}

// Source: ops.jsx at 7dee0901; see source-provenance.json.
const D = runtime.data;
const dealerName = id => (D.dealers.find(d => d.id === id) || {}).name || id;
function Attention({
  items,
  onAct
}) {
  if (!items.length) return <section className="panel attn-empty"><Badge status="closed">Monitoring</Badge><span className="muted">Fixture data only; table state and balances are not connected. Automated incident and player-risk monitoring is not available.</span></section>;
  return <section className="panel">
    <div className="panel-h"><h2>Needs action <span className="count">{items.length}</span></h2><span className="muted" style={{
        fontSize: 12.5
      }}>Most urgent first</span></div>
    <div>{items.map((a, i) => <div key={i} className={'attn attn-' + a.sev}>
        <Badge status={a.sev} />
        <div style={{
          minWidth: 0
        }}>
          <div className="attn-t">{a.title} <span className="mono muted">· {a.table}{a.player ? ' · ' + a.player : ''}</span>{a.brand && <span className="muted" style={{
              fontWeight: 400
            }}> · {brandName(a.brand)}</span>}</div>
          <div className="muted attn-d">{a.detail}</div>
        </div>
        <span className="mono muted">{a.age}</span>
        <div className="attn-a">
          {a.action === 'dealer' && <button className="btn primary sm" onClick={() => onAct('dealer', a)}>Change dealer</button>}
          {a.action === 'block' && <button className="btn sm" onClick={() => onAct('block', a)}>Review player</button>}
          <button className="btn sm" onClick={() => onAct('open', a)}>Open table</button>
        </div>
      </div>)}</div>
  </section>;
}
const FILTERS = [['all', 'All'], ['attn', 'Needs action'], ['live', 'Live'], ['paused', 'Paused'], ['closed', 'Closed']];
function TablesPanel({
  tables,
  onOpen,
  selected
}) {
  const [f, setF] = React.useState('all');
  const [room, setRoom] = React.useState('all');
  const [game, setGame] = React.useState('all');
  const [q, setQ] = React.useState('');
  const match = t => (f === 'all' || (f === 'attn' ? ['warning', 'error'].includes(t.status) : t.status === f)) && (room === 'all' || t.room === room) && (game === 'all' || t.game === game) && (!q || [t.id, t.name, dealerName(t.dealer) || '', t.round, ...t.brands.map(brandName), ...t.seatInfo.map(s => s.player || '')].join(' ').toLowerCase().includes(q.toLowerCase()));
  const n = k => tables.filter(t => k === 'all' || (k === 'attn' ? ['warning', 'error'].includes(t.status) : t.status === k)).length;
  const rows = tables.filter(match);
  return <section className="panel">
    <div className="panel-h wrap">
      <h2>Tables</h2>
      <div className="filters">
        {FILTERS.map(([k, l]) => <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}<span className="n">{n(k)}</span></button>)}
        <select className="select" value={game} onChange={e => setGame(e.target.value)} aria-label="Game"><option value="all">All games</option>{[...new Set(tables.map(t => t.game))].map(g => <option key={g}>{g}</option>)}</select>
        <select className="select" value={room} onChange={e => setRoom(e.target.value)} aria-label="Room"><option value="all">All rooms</option>{[...new Set(tables.map(t => t.room))].map(r => <option key={r}>{r}</option>)}</select>
        <input className="input" style={{
          width: 240
        }} placeholder="Table, dealer, player or round ID" value={q} onChange={e => setQ(e.target.value)} />
      </div>
    </div>
    <div className="scroll-x">
      <table className="tbl">
        <thead><tr><th>Status</th><th>Table</th><th>Game</th><th>Brands</th><th>Dealer</th><th>Players</th><th>Now</th><th>Round</th><th className="num">Open stakes</th><th className="num">Result today</th><th></th></tr></thead>
        <tbody>{rows.map(t => {
            const seated = t.seats.length ? t.seats.filter(Boolean).length : t.seatInfo.length;
            return <tr key={t.id} className={'click' + (selected === t.id ? ' sel' : '')} onClick={() => onOpen(t.id)}>
            <td><Badge status={t.status} /></td>
            <td><div style={{
                  fontWeight: 600
                }}>{t.name} <span className="mono muted" style={{
                    fontWeight: 400
                  }}>{t.id}</span></div>{t.issue && <div className={'row-issue is-' + t.status}>{t.issue}</div>}</td>
            <td>{t.game}</td>
            <td><BrandTags ids={t.brands} /></td>
            <td>{t.dealer ? dealerName(t.dealer) : <span className="muted">—</span>}</td>
            <td>{t.seats.length ? <><div className="seats" aria-label={seated + ' of ' + t.seats.length + ' seats taken'}>{t.seats.map((s, i) => <i key={i} className={s ? 'on' : ''}></i>)}</div><span className="mono muted" style={{
                    marginLeft: 8
                  }}>{seated}/{t.seats.length}</span></> : <><span className="mono">{t.seatInfo.length}</span> <span className="muted">no seat limit</span></>}</td>
            <td>{t.phase}{t.timer !== '—' && <span className="mono muted"> {t.timer}</span>}</td>
            <td className="mono">{t.round}</td>
            <td className="num mono">{t.open ? money(t.open) : <span className="muted">—</span>}</td>
            <td className={'num mono' + (t.today < 0 ? ' neg' : '')}>{t.today ? money(t.today, true) : <span className="muted">—</span>}</td>
            <td className="num"><span className="muted" style={{
                  fontSize: 12.5
                }}>Open →</span></td>
          </tr>;
          })}</tbody>
      </table>
      {!rows.length && <EmptyState title="No tables match" body="Try another status, game, room or search term." action={<button className="btn sm" onClick={() => {
        setF('all');
        setRoom('all');
        setGame('all');
        setQ('');
      }}>Clear filters</button>} />}
    </div>
  </section>;
}
function ResultPanel({
  brand,
  open
}) {
  const [p, setP] = React.useState('today');
  const scale = (x, s) => ({
    result: x.result * s,
    stakes: x.stakes * s,
    payouts: x.payouts * s,
    rounds: Math.round(x.rounds * Math.min(1, s * 1.8))
  });
  const r = resultFor(p, brand);
  const ledger = D.ledger.filter(l => brand === 'all' || l.brand === brand);
  const hold = r.stakes ? (r.result / r.stakes * 100).toFixed(2) + '%' : '—';
  return <section className="panel">
    <div className="panel-h wrap">
      <div><h2>House result <span className="muted" style={{
            fontWeight: 400
          }}>· {brand === 'all' ? 'All brands' : brandName(brand)}</span></h2><div className="muted" style={{
          fontSize: 12.5
        }}>Settled stakes minus all payouts, before operating costs. Demo funds.</div></div>
      <div className="seg">{[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']].map(([k, l]) => <button key={k} className={p === k ? 'on' : ''} onClick={() => setP(k)}>{l}</button>)}</div>
    </div>
    <div className="stats">
      <div className="stat lead"><div className="stat-l">House result</div><div className={'stat-v' + (r.result < 0 ? ' neg' : '')}>{money(r.result, true)}</div></div>
      <div className="stat"><div className="stat-l">Settled stakes</div><div className="stat-v sm">{money(r.stakes)}</div></div>
      <div className="stat"><div className="stat-l">Total payouts</div><div className="stat-v sm">{money(r.payouts)}</div></div>
      <div className="stat"><div className="stat-l">House hold</div><div className="stat-v sm">{hold}</div></div>
      <div className="stat"><div className="stat-l">Settled rounds</div><div className="stat-v sm">{r.rounds.toLocaleString('en-US')}</div></div>
    </div>
    <div className="note">Not included: open stakes <span className="mono">{money(open)}</span> and prepared bets <span className="mono">{money(D.tables.filter(t => brand === 'all' || t.brands.includes(brand)).reduce((n, t) => n + t.prepared, 0))}</span>. They count once the round settles.</div>
    {brand === 'all' && <><div className="panel-h" style={{
        borderTop: '1px solid var(--rule)'
      }}><h3>By brand</h3></div>
    <div className="scroll-x"><table className="tbl">
      <thead><tr><th>Brand</th><th className="num">House result</th><th className="num">Settled stakes</th><th className="num">Share of stakes</th></tr></thead>
      <tbody>{D.brands.map(b => {
              const x = resultFor(p, b.id);
              return <tr key={b.id}>
        <td><span className="btag" style={{
                    marginRight: 8
                  }}>{b.code}</span>{b.name}</td>
        <td className={'num mono' + (x.result < 0 ? ' neg' : '')}>{money(x.result, true)}</td><td className="num mono">{money(x.stakes)}</td><td className="num mono">{r.stakes ? Math.round(x.stakes / r.stakes * 100) : 0}%</td>
      </tr>;
            })}</tbody>
    </table></div></>}
    <div className="panel-h" style={{
      borderTop: '1px solid var(--rule)'
    }}><h3>Latest settled rounds</h3><a href="#tx">All transactions →</a></div>
    <div className="scroll-x"><table className="tbl">
      <thead><tr><th>Time</th><th>Round</th><th>Table</th><th>Brand</th><th>Player</th><th className="num">Stake</th><th className="num">Payout</th><th className="num">House</th></tr></thead>
      <tbody>{ledger.map(l => <tr key={l.round + ':' + l.player}>
        <td className="mono muted">{l.time}</td><td className="mono">{l.round}</td><td className="mono">{l.table}</td><td>{brandName(l.brand)}</td><td className="mono">{l.player}</td>
        <td className="num mono">{money(l.stake)}</td><td className="num mono">{money(l.payout)}</td><td className={'num mono' + (l.stake - l.payout < 0 ? ' neg' : '')}>{money(l.stake - l.payout, true)}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
function TableDrawer({
  t,
  onClose,
  onDealer,
  onBlock,
  blocked
}) {
  if (!t) return null;
  const seated = t.seatInfo.filter(s => s.player);
  return <Drawer open={!!t} onClose={onClose}>
    <div className="dr-h">
      <div><div className="mono muted">{t.id} · {t.room}</div><h2>{t.name}</h2><div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginTop: 6
        }}><Badge status={t.status} /><span className="muted" style={{
            fontSize: 13
          }}>{t.game} · {t.limits}</span></div></div>
      <button className="btn ghost sm" onClick={onClose}>Close</button>
    </div>
    {t.issue && <div className={'dr-issue is-' + t.status}>{t.issue}</div>}
    <div className="dr-b">
      <div className="kv">
        <div><span>Now</span><b>{t.phase}{t.timer !== '—' ? ' · ' + t.timer : ''}</b></div>
        <div><span>Round</span><b className="mono">{t.round}</b></div>
        <div><span>Open stakes</span><b className="mono">{t.open ? money(t.open) : '—'}</b></div>
        <div><span>Result today</span><b className={'mono' + (t.today < 0 ? ' neg' : '')}>{t.today ? money(t.today, true) : '—'}</b></div>
        <div style={{
          gridColumn: '1 / -1',
          borderRight: 0
        }}><span>Offered on</span><b style={{
            fontWeight: 500
          }}>{t.brands.map(brandName).join(', ')}</b></div>
      </div>
      <h3>Dealer</h3>
      <div className="dr-row">
        <div className="avatar lg">{t.dealer ? dealerName(t.dealer)[0] : '—'}</div>
        <div style={{
          flex: 1
        }}>{t.dealer ? <><div style={{
              fontWeight: 600
            }}>{dealerName(t.dealer)}</div><div className="muted" style={{
              fontSize: 12.5
            }}>On this table since <span className="mono">{t.since}</span></div></> : <div className="muted">No dealer assigned</div>}</div>
        <button className={'btn sm' + (t.status === 'error' ? ' primary' : '')} onClick={onDealer} disabled={t.status === 'closed'}>{t.dealer ? 'Change dealer' : 'Assign dealer'}</button>
      </div>
      <h3>{t.seats.length ? 'Seats' : 'Players'} <span className="muted" style={{
          fontWeight: 400
        }}>{t.seats.length ? seated.length + ' of ' + t.seats.length : seated.length + ' · no seat limit'}</span></h3>
      {seated.length ? <table className="tbl">
        <thead><tr><th>Seat</th><th>Player</th><th>Brand</th><th className="num">Stake</th><th className="num">Balance</th><th></th></tr></thead>
        <tbody>{t.seatInfo.map(s => s.player ? <tr key={s.seat || s.player}>
          <td className="mono">{s.seat || '—'}</td>
          <td><span className="mono">{s.player}</span>{blocked[s.player] ? <span className="badge b-error" style={{
                marginLeft: 8
              }}>Blocked</span> : s.flag && <span className="badge b-warning" style={{
                marginLeft: 8
              }} title={s.flag}>Flagged</span>}{s.flag && !blocked[s.player] && <div className="row-issue is-warning">{s.flag}</div>}</td>
          <td>{brandName(s.brand)}</td>
          <td className="num mono">{money(s.stake)}</td><td className="num mono">{money(s.balance)}</td>
          <td className="num">{blocked[s.player] ? <span className="muted" style={{
                fontSize: 12.5
              }}>{blocked[s.player]}</span> : <button className="btn sm" onClick={() => onBlock(s.player)}>Block</button>}</td>
        </tr> : <tr key={s.seat}><td className="mono muted">{s.seat}</td><td colSpan="5" className="muted">Empty</td></tr>)}</tbody>
      </table> : <EmptyState title="No players seated" body={t.status === 'closed' ? 'This table is outside its opening hours.' : 'Players can join once the table is live.'} />}
    </div>
  </Drawer>;
}
function DealerModal({
  t,
  onClose,
  onConfirm
}) {
  const busy = Object.fromEntries(D.tables.filter(x => x.dealer).map(x => [x.dealer, x.id]));
  const [pick, setPick] = React.useState(null);
  const [when, setWhen] = React.useState(t && t.status === 'error' ? 'now' : 'round');
  if (!t) return null;
  return <Modal open title={'Change dealer · ' + t.name} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!pick} onClick={() => onConfirm(pick, when)}>Change dealer</button></>}>
    <div className="field"><label>New dealer</label>
      <div className="opts">{D.dealers.filter(d => d.id !== t.dealer).map(d => {
          const on = busy[d.id];
          return <label key={d.id} className={'opt' + (pick === d.id ? ' on' : '') + (on ? ' dis' : '')}>
          <input type="radio" name="dealer" disabled={!!on} checked={pick === d.id} onChange={() => setPick(d.id)} />
          <span style={{
              fontWeight: 600
            }}>{d.name}</span><span className="muted">{d.lang}</span>
          <span style={{
              marginLeft: 'auto'
            }}>{on ? <span className="muted" style={{
                fontSize: 12.5
              }}>On {on}</span> : <Badge status="live">Available</Badge>}</span>
        </label>;
        })}</div>
    </div>
    <div className="field" style={{
      marginTop: 18
    }}><label>When</label>
      <div className="seg"><button className={when === 'round' ? 'on' : ''} onClick={() => setWhen('round')}>After this round</button><button className={when === 'now' ? 'on' : ''} onClick={() => setWhen('now')}>Now</button></div>
      <div className="muted" style={{
        fontSize: 12.5
      }}>{when === 'now' ? 'The current round continues with the new dealer. Bets stay as placed.' : 'Players will see the new dealer when the next round starts.'}</div>
    </div>
  </Modal>;
}
function BlockModal({
  player,
  onClose,
  onConfirm
}) {
  const [reason, setReason] = React.useState('');
  const [dur, setDur] = React.useState('24 h');
  if (!player) return null;
  return <Modal open title="Block player" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" disabled={!reason} onClick={() => onConfirm(player, dur)}>Block {player}</button></>}>
    <p style={{
      margin: '0 0 16px'
    }}>The player is removed from all tables after the current round and cannot join again until the block ends. Open bets are settled normally.</p>
    <div style={{
      display: 'grid',
      gap: 16
    }}>
      <div className="field"><label>Player</label><div className="mono" style={{
          fontSize: 14
        }}>{player}</div></div>
      <div className="field"><label htmlFor="reason">Reason</label><select id="reason" className="select" value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option><option>Suspected collusion</option><option>Suspected bot or automation</option><option>Responsible gambling</option><option>Abusive chat</option><option>Other</option></select></div>
      <div className="field"><label>Duration</label><div className="seg">{['24 h', '7 days', '30 days', 'Permanent'].map(d => <button key={d} className={dur === d ? 'on' : ''} onClick={() => setDur(d)}>{d}</button>)}</div></div>
      <div className="field"><label htmlFor="note">Note <span className="muted" style={{
            fontWeight: 400
          }}>(visible to your team only)</span></label><textarea id="note" className="input" rows="3" style={{
          height: 'auto',
          padding: 10,
          resize: 'vertical'
        }}></textarea></div>
    </div>
  </Modal>;
}
function Ops({
  tables: allTables,
  attention: allAttention,
  setTables,
  setAttention,
  toast,
  brand
}) {
  const [gameF, setGameF] = React.useState('all');
  const tables = allTables.filter(x => (brand === 'all' || x.brands.includes(brand)) && (gameF === 'all' || x.game === gameF));
  const attention = allAttention.filter(a => brand === 'all' || (a.brand ? a.brand === brand : (allTables.find(x => x.id === a.table) || {
    brands: []
  }).brands.includes(brand)));
  const mine = s => s.player && (brand === 'all' || s.brand === brand);
  const openFor = x => brand === 'all' || brand === 'scout' ? x.open : 0;
  const openTotal = tables.reduce((n, x) => n + openFor(x), 0);
  const [open, setOpen] = React.useState(null);
  const [lay, setLayS] = React.useState(runtime.memory.getItem('bo.opsLayout') || 'floor');
  const setLay = v => {
    setLayS(v);
    runtime.memory.setItem('bo.opsLayout', v);
  };
  const [dealerFor, setDealerFor] = React.useState(null);
  const [blockP, setBlockP] = React.useState(null);
  const [blocked, setBlocked] = React.useState({});
  const t = tables.find(x => x.id === open);
  const act = (kind, a) => {
    if (kind === 'open') setOpen(a.table);
    if (kind === 'dealer') unavailable('Live dealer changes');
    if (kind === 'block') unavailable('Player blocking');
  };
  const live = tables.filter(x => x.status !== 'closed' && x.status !== 'paused');
  const seated = tables.reduce((n, x) => n + new Set(x.seatInfo.filter(mine).map(s => s.playerId)).size, 0);
  return <>
    <header className="page-h">
      <div><h1>Casino live</h1><div className="muted" style={{
          fontSize: 13
        }}><span className="pulse"></span>Fixture · {brand === 'all' ? 'All brands' : brandName(brand)} · updated <span className="mono">{new Date(D.updatedAt).toLocaleTimeString('sv-SE', {
              timeZone: 'Europe/Stockholm'
            })}</span></div></div>
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        {lay === 'list' && <div className="page-kpis">
          <div><span>Tables running</span><b>{live.length} <em>of {tables.length}</em></b></div>
          <div><span>Players at tables</span><b>{seated}</b></div>
          <div><span>Open stakes</span><b>{money(openTotal)}</b></div>
        </div>}
        <div className="field"><label style={{
            fontSize: 12,
            color: 'var(--steel)',
            fontWeight: 500
          }}>Game</label><div className="seg">{[['all', 'All games'], ...[...new Set(allTables.map(t => t.game))].map(g => [g, g])].map(([k, l]) => <button key={k} className={gameF === k ? 'on' : ''} onClick={() => setGameF(k)}>{l}</button>)}</div></div>
        <div className="field"><label style={{
            fontSize: 12,
            color: 'var(--steel)',
            fontWeight: 500
          }}>Layout</label><div className="seg">{[['floor', 'Floor'], ['command', 'Command'], ['list', 'List']].map(([k, l]) => <button key={k} className={lay === k ? 'on' : ''} onClick={() => setLay(k)}>{l}</button>)}</div></div>
      </div>
    </header>
    <div className="page-b">
      {lay === 'floor' ? <OpsFloor tables={tables} attention={attention} act={act} onOpen={setOpen} open={open} openTotal={openTotal} seated={seated} brand={brand} /> : lay === 'command' ? <OpsCommand tables={tables} attention={attention} act={act} onOpen={setOpen} open={open} openTotal={openTotal} seated={seated} brand={brand} /> : <><Attention items={attention} onAct={act} /><TablesPanel tables={tables} onOpen={setOpen} selected={open} /><ResultPanel brand={brand} open={openTotal} /></>}
    </div>
    <TableDrawer t={t} onClose={() => setOpen(null)} onDealer={() => unavailable('Live dealer changes')} onBlock={() => unavailable('Player blocking')} blocked={blocked} />
    {dealerFor && <DealerModal t={tables.find(x => x.id === dealerFor)} onClose={() => setDealerFor(null)} onConfirm={(d, when) => {
      const id = dealerFor;
      setTables(ts => ts.map(x => x.id !== id ? x : when === 'now' ? {
        ...x,
        dealer: d,
        since: '17:42',
        status: x.status === 'error' ? 'live' : x.status,
        issue: x.status === 'error' ? null : x.issue,
        phase: x.status === 'error' ? 'Dealing' : x.phase
      } : {
        ...x,
        issue: dealerName(d) + ' takes over after round ' + x.round
      }));
      if (when === 'now') setAttention(as => as.filter(a => !(a.table === id && a.action === 'dealer')));
      setDealerFor(null);
      toast(when === 'now' ? dealerName(d) + ' is now dealing at ' + id : dealerName(d) + ' takes over ' + id + ' after this round');
    }} />}
    <BlockModal player={blockP} onClose={() => setBlockP(null)} onConfirm={(p, dur) => {
      setBlocked(b => ({
        ...b,
        [p]: 'Blocked ' + dur
      }));
      setAttention(as => as.filter(a => a.player !== p));
      setBlockP(null);
      toast(p + ' blocked for ' + dur);
    }} />
  </>;
}
function PartnerDealerSelection({toast}) {
  const [selected,setSelected]=React.useState(null);
  return <><PageH title="Dealers" sub="Operatörens tilldelade presentationsprofiler. Produktion och generering finns på nivå 1."/><div className="page-b"><div className="grid-cards">{runtime.snapshot.presentations.map(profile=>{const name=typeof profile.dealer==='string'?profile.dealer:profile.dealer?.name||'Dealer';return <article className="vcard" key={profile.id}><div className="vcard-img"><img src={assetUrl('/bo/img/'+name.toLowerCase()+'-portrait.jpg')} alt={name}/><Badge status="paused">Fixture</Badge></div><div className="vcard-b"><h3>{profile.name}</h3><dl className="dl"><dt>Dealer</dt><dd>{name}</dd><dt>Språk</dt><dd>{profile.language||'—'}</dd><dt>Bakgrund</dt><dd>{profile.background||'—'}</dd></dl></div><div className="vcard-f"><button className="btn primary" onClick={()=>{setSelected(profile.id);toast('Vald i lokal förhandsvisning. Inget bord eller spel har ändrats.');}}>{selected===profile.id?'Vald lokalt':'Förhandsvisa val'}</button></div></article>;})}</div></div></>;
}
function ScopedTeamPreview() {
  const [query,setQuery]=React.useState(''),[tab,setTab]=React.useState('members');
  const rows=runtime.snapshot.team.filter(member=>(member.name+' '+member.email).toLowerCase().includes(query.toLowerCase()));
  const roles=[['Partner administrator','Eget team, spelare och konfiguration inom tilldelat mandat.'],['Partner editor','Godkända presentationer och eget varumärke.'],['Partner technician','Egen integration och avgränsade teststarter.'],['Partner analyst','Egna rapporter och läsbehörighet.']];
  return <><PageH title="Team & access" sub={'Personal i '+runtime.snapshot.operator.name+'. Exempelmedlemmar; kontoadministration är inte ansluten.'} right={<button className="btn primary" disabled title="Organisationsmedlemskap måste anslutas först">Invite people</button>}/><div className="page-b"><section className="panel"><div className="panel-h"><div className="seg">{[['members','Members'],['roles','Roles & permissions']].map(([id,label])=><button key={id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{label}</button>)}</div><input className="input" placeholder="Search name or email" aria-label="Search name or email" value={query} onChange={event=>setQuery(event.target.value)}/></div>{tab==='members'?<div className="scroll-x"><table className="tbl pl-tbl"><thead><tr><th>Member</th><th>Role</th><th>Organisation</th><th>Status</th></tr></thead><tbody>{rows.map(member=><tr key={member.id}><td><div className="pl-who"><span className="pl-av">{member.name.slice(0,2).toUpperCase()}</span><span><b>{member.name}</b><small>{member.email}</small></span></div></td><td>{member.role}</td><td>{runtime.snapshot.operator.name}</td><td><Badge status="paused">Fixture · {member.status}</Badge></td></tr>)}</tbody></table></div>:<div className="rows">{roles.map(([name,description])=><div key={name}><b>{name}</b><span>{description}</span></div>)}</div>}<div className="note">Rollerna är målbilden. Den aktuella förhandsvisningen kräver befintlig intern admininloggning; inga partnerkonton eller utökade rättigheter skapas här.</div></section></div></>;
}
function PartnerPitBosses() {return <><PageH title="Pit bosses" sub="Operatörens egen bemanning. Regler för presentation, ingripanden och generering hanteras internt på nivå 1."/><div className="page-b"><section className="panel"><EmptyState title="Bemanning är inte ansluten" body="Här kopplas operatörens avgränsade driftteam in när medlemskap och bordsansvar finns." action={<a className="btn" href="#team">Visa eget team</a>}/></section></div></>;}
function VisualTableTest({brand}) {
  const [phase,setPhase]=React.useState('bet'),[preview,setPreview]=React.useState('game');
  const id=brand==='all'?'scout':brand, theme=thLoad()[id].draft,table=loadDesigns()[id].draft;
  return <><PageH title="Test a table" sub="Kevins visuella förhandsvisning av tema, kort och marker. Belopp och kort är statiska exempel. Inget spel, ingen wallet och ingen mediauppspelning startas."/><div className="page-b"><section className="panel"><div className="panel-h wrap"><div className="seg">{[['game','Game presentation'],['table','Table design']].map(([id,label])=><button key={id} className={preview===id?'on':''} onClick={()=>setPreview(id)}>{label}</button>)}</div><div className="seg">{[['bet','Betting'],['dec','Decision'],['ins','Insurance'],['set','Settled']].map(([id,label])=><button key={id} className={phase===id?'on':''} onClick={()=>setPhase(id)}>{label}</button>)}</div></div><div className="kevin-visual-preview">{preview==='game'?<ThFrame t={theme} st={phase}/>:<TableSVG d={table} uid="test-local" brandLabel={runtime.snapshot.operator.name}/>}</div><div className="note">Redigera Colours, chips & cards eller Table och återvänd hit för att se ditt lokala utkast.</div></section></div></>;
}
const views={ops:Ops,players:Players,tx:Transactions,pit:runtime.surface==='partner'?PartnerPitBosses:PitBosses,theme:BrandTheme,design:TableDesign,background:CasinoBackground,bj:props=><GamePage {...props} game="bj"/>,roulette:props=><GamePage {...props} game="roulette"/>,baccarat:props=><GamePage {...props} game="baccarat"/>,dealers:DealersHub,shoes:Shoes,test:VisualTableTest,stats:Statistics,reports:ReportsLib,team:Team,api:ApiKeys};
if(runtime.surface==='internal')Object.assign(views,{archive:DealerArchive,tables:TablesRooms,voice:VoiceLines,clips:DealingClips,media:GameMedia,tree:ActionTree,gen:Generations});
return {views,Mark,Badge,EmptyState,Toast};

}
