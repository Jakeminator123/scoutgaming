// Live operator overview. Package, compositions and rooms only; no fixture metrics.
import React from 'react';
import { compositionLabel } from '../../../../../packages/navigation/control-flow.mjs';
import { workspaceSurfacePath } from '../../../../../packages/navigation/workspace-surfaces.mjs';
import { operatorPackageRevision } from '../partner-workspace-context.mjs';

const h = React.createElement;

export function PartnerLiveOverview({ snapshot, copy, language = 'sv', tablesOnly = false }) {
  const revision = operatorPackageRevision(snapshot), profiles = snapshot.presentations;
  const path = view => workspaceSurfacePath('partner', view, snapshot.operator.slug);
  const summaries = h('div', { className: 'kevin-summary-grid' },
    h('section', { className: 'panel kevin-summary' },
      h('span', null, copy.revision),
      h('strong', null, revision || '—'),
      h('small', null, revision ? copy.package : copy.packageMissing)),
    h('section', { className: 'panel kevin-summary' },
      h('span', null, copy.profiles),
      h('strong', null, profiles.length),
      h('small', null, copy.package)),
    h('section', { className: 'panel kevin-summary' },
      h('span', null, copy.tableCount),
      h('strong', null, snapshot.tables.length),
      h('small', null, copy.company)));
  const packageCard = h('section', { className: 'panel kevin-package-card' },
    h('h2', null, revision ? copy.package : copy.packageMissing),
    h('p', null, revision ? copy.readOnlyScope : copy.packageMissingBody),
    profiles.length > 0 ? h('ul', null, profiles.map(profile => h('li', { key: profile.id }, compositionLabel(profile.name, language)))) : null,
    h('a', { className: 'btn primary', href: path('bj') }, copy.roomSettings, ' →'));
  const pending = h('section', { className: 'panel kevin-package-card' },
    h('span', { className: 'kevin-status-pill' }, copy.notConnected),
    h('h2', null, copy.unavailable),
    h('p', null, copy.unavailableBody));
  const rows = snapshot.tables.length
    ? h('div', { className: 'scroll-x' },
      h('table', { className: 'tbl' },
        h('thead', null, h('tr', null,
          h('th', null, copy.tables), h('th', null, copy.game), h('th', null, copy.status), h('th', null, copy.profile))),
        h('tbody', null, snapshot.tables.map(table => h('tr', { key: table.id },
          h('td', null, h('strong', null, table.name)),
          h('td', null, table.game === 'blackjack' ? 'Blackjack' : table.game),
          h('td', null, h('span', { className: 'kevin-status-pill' }, table.status === 'active' ? copy.configured : table.status === 'draft' ? copy.draft : table.status || '—')),
          h('td', null, compositionLabel(profiles.find(profile => profile.id === table.presentationId)?.name || table.presentationId || '—', language)))))))
    : h('div', { className: 'empty' }, h('h3', null, copy.noTables), h('p', null, copy.noTablesBody));
  return h('div', { className: 'page-b kevin-live-overview' },
    tablesOnly ? null : summaries,
    tablesOnly ? null : h('div', { className: 'kevin-live-grid' }, packageCard, pending),
    h('section', { className: 'panel kevin-table-panel' },
      h('div', { className: 'panel-h' },
        h('h2', null, copy.tables),
        tablesOnly ? null : h('a', { href: path('bj') }, copy.tables, ' →')),
      rows));
}
