// Live integration and the other still-disconnected partner sections. No fixture figures.
import React from 'react';
import { workspaceSurfacePath } from '../../../lib/workspace-surfaces.mjs';

const h = React.createElement;

export const DISCONNECTED = {
  players: ['Spelare', 'Spelarkonton för den här operatören är inte anslutna.', '/control/administration', 'Öppna administration'],
  tx: ['Transaktioner', 'Transaktioner för den här operatören är inte anslutna.', '/control/administration', 'Öppna administration'],
  reports: ['Rapporter', 'Rapporter för den här operatören är inte anslutna.', null, 'Öppna integrationer'],
};

export function PartnerDisconnected({ snapshot, view, copy }) {
  if (snapshot.preview === false) {
    return h('div', { className: 'page-b kevin-disconnected' },
      h('section', { className: 'panel' },
        h('div', { className: 'empty' },
          h('span', { className: 'kevin-status-pill' }, copy.notConnected),
          h('h2', null, view === 'api' ? copy.api : copy.unavailable),
          h('p', null, view === 'api' ? copy.apiBody : copy.unavailableBody),
          view === 'api' ? h('h3', null, copy.unavailable) : null,
          view === 'api' ? h('p', null, copy.unavailableBody) : null)));
  }
  const [title, body, href, action] = DISCONNECTED[view];
  const destination = href || workspaceSurfacePath('partner', 'api', snapshot.operator.slug) || '#api';
  return h('div', { className: 'page-b kevin-disconnected' },
    h('section', { className: 'panel' },
      h('div', { className: 'empty' },
        h('h2', null, title),
        h('p', null, body),
        h('a', { className: 'btn primary', href: destination }, action))));
}
