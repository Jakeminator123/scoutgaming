'use client';
import React from 'react';
import { compositionLabel } from '../lib/control-flow.mjs';
import { partnerLaneState } from '../lib/partner-package-view.mjs';
import { isGameLaneId } from '../../web/public/game-lanes.mjs';
import { resolveRoomBranding } from '../../web/storage/partner-branding.mjs';

const h = React.createElement;
export function PartnerPackageView({ snapshot, view, roomId = '', language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const presentation = snapshot.presentation;
  if (!presentation?.lanes?.length) return h('section', { className: 'kevin-published-summary panel' },
    h('h3', null, t('Ingen publicerad sammansättning', 'No published composition')),
    h('p', null, t('Paketet saknar det publicerade trelagersformatet. Intern personal behöver publicera bolagets spelrum i nivå 1.', 'This package has no published layer format. Internal staff need to publish the company’s game rooms in level 1.')));
  const owned = (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator.id);
  const room = owned.find(row => row.id === roomId);
  const lane = presentation.lanes.find(row => row.id === (room?.presentationId ?? snapshot.branding?.lane)) ?? presentation.lanes[0];
  const branding = resolveRoomBranding({ ...snapshot.branding, lane: snapshot.branding?.lane ?? presentation.lanes[0].id }, room?.id, lane.id);
  const state = partnerLaneState(lane, branding, presentation.assets, presentation.registeredDealers);
  const fallback = state.compatibility === 'full-frame';
  const rooms = owned.filter(row => row.presentationId === lane.id && row.status === 'active' && isGameLaneId(row.id) && (!roomId || row.id === roomId));
  const revision = snapshot.packageRevision ?? snapshot.operator.packageRevision;
  const labels = { dealer: 'Dealer', table: t('Bord', 'Table'), background: t('Bakgrund', 'Background') };
  return h('section', { className: 'kevin-published-summary panel', 'aria-label': t('Publicerad sammansättning', 'Published composition') },
    h('div', {className:'kevin-published-heading'}, h('div', null,
      h('span', {className:'kevin-status-pill'}, t('Publicerat', 'Published')),
      h('h2', null, room?.name ?? t('Bolagets standard', 'Company defaults'))),
      revision ? h('span', {className:'kevin-package-revision'}, t('Version ', 'Version ') + revision) : null),
    h('p', null, compositionLabel(state.name, language)),
    h('dl', {className:'kevin-published-layers'}, ...['dealer','table','background'].map(role => {
      const layer = state.layers[role];
      const text = !layer.enabled ? t('Avstängt', 'Disabled') : fallback && role !== 'dealer' ? t('Inbakat i dealerklippet', 'Included in dealer video') : layer.label;
      return h('div', {key:role}, h('dt', null, labels[role]), h('dd', null, text));
    })),
    h('p', {className:'kevin-published-note'}, fallback ? t('Fullbildsklipp: bord och bakgrund ingår i filmen.', 'Full-frame video: table and background are part of the recording.') : t('Tre separata lager: dealer, bord och bakgrund.', 'Three separate layers: dealer, table and background.')),
    view === 'test' ? snapshot.roomBindings === 'operator-owned-v2' || presentation.schemaVersion >= 2
      ? rooms.length ? h('div', {className:'kevin-room-actions'}, ...rooms.map(row => h('a', {key:row.id, className:'btn', target:'_blank', rel:'noopener', href:'/play/blackjack?' + new URLSearchParams({operator:snapshot.operator.slug, table:row.id})}, t('Provspela ', 'Play ') + row.name + t(' ↗', ' ↗'))))
        : h('p', null, t('Inget publicerat spelrum för sammansättningen.', 'No published game room for this composition.'))
      : h('a', {className:'btn', target:'_blank', rel:'noopener', href:'/play/blackjack?' + new URLSearchParams({operator:snapshot.operator.slug, lane:lane.id})}, t('Provspela publicerad version ↗', 'Play published version ↗')) : null);
}
