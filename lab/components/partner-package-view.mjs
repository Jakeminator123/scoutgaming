'use client';
import React from 'react';
import { partnerLaneState } from '../lib/partner-package-view.mjs';

const h = React.createElement;
const labels = { dealer: 'Dealer', table: 'Bord', background: 'Bakgrund' };

export function PartnerPackageView({ snapshot, view }) {
  const presentation = snapshot.presentation;
  if (!presentation) return h('section', { className: 'panel' },
    h('h3', null, 'Tilldelat operatörspaket'),
    h('p', null, 'Det här paketet saknar det publicerade trelagersformatet. Intern personal behöver publicera om paketet under Publicering.'));
  const branding = { ...snapshot.branding, lane: snapshot.branding?.lane ?? presentation.lanes[0].id };
  return h('section', { className: 'page-b', 'aria-label': 'Tilldelade lane-paket' },
    h('p', null, 'Bord, dealer och bakgrund kommer från paketet som publicerats i nivå 1. Operatören kan ändra de val som paketet tillåter.'),
    ...presentation.lanes.map(lane => {
      const state = partnerLaneState(lane, branding, presentation.assets);
      const fallback = state.compatibility === 'full-frame';
      const params = new URLSearchParams({ operator: snapshot.operator.slug, lane: lane.id });
      return h('article', { className: 'panel', key: lane.id },
        h('h3', null, state.name),
        h('p', null, fallback ? 'Fullbildsklipp · bord och bakgrund är inbakade. Separata lager kan användas när ett ersättningspaket har godkänts i nivå 1.' : 'Tre separata lager · bord, dealer och bakgrund.'),
        h('dl', null, ...['table', 'dealer', 'background'].flatMap(role => {
          const layer = state.layers[role];
          const text = !layer.enabled ? 'Avstängt i paketet' : fallback && role !== 'dealer' ? 'Inbakat i dealerklippet' : `${layer.label}${layer.contentType ? ` · ${layer.contentType} · ${layer.width} × ${layer.height}` : ''}`;
          return [h('dt', { key: `${role}-label` }, labels[role]), h('dd', { key: role }, text)];
        })),
        view === 'test' ? h('a', { className: 'btn', href: `/play/blackjack?${params}` }, 'Öppna spelbord med detta paket') : null);
    }),
    view === 'theme' ? h('p', null, 'Marker och kort har ännu inga publicerade operatörsval. Spelmotorn styr värden, kort och saldo.') : null);
}
