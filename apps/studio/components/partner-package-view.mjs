'use client';
import React from 'react';
import { compositionLabel } from '../../../packages/navigation/control-flow.mjs';
import { partnerLaneState } from '../lib/partner-package-view.mjs';
import {isGameLaneId} from '../../../packages/presentation/contracts/game-lane-id.mjs';
import {gameStartPath} from '../../../packages/navigation/game-entry.mjs';
import { resolveRoomBranding } from '../../../packages/operators/contracts/branding.mjs';

const h = React.createElement;
export function PartnerPackageView({ snapshot, view, roomId = '', language = 'sv' }) {
  const en = language === 'en', t = (sv, english) => en ? english : sv;
  const presentation = snapshot.presentation;
  if (!presentation?.lanes?.length) return h('section', { className: 'card flat' },
    h('h3', null, t('Ingen publicerad scenmall', 'No published scene template')),
    h('p', { className: 'muted' }, t('Paketet saknar det publicerade trelagersformatet. Scoutgaming publicerar bolagets spelbord i Admin.', 'This package has no published layer format. Scoutgaming publishes the company tables in Admin.')));
  const owned = (snapshot.tables ?? []).filter(room => room.operatorId === snapshot.operator.id);
  const room = owned.find(row => row.id === roomId);
  const lane = presentation.lanes.find(row => row.id === (room?.presentationId ?? snapshot.branding?.lane)) ?? presentation.lanes[0];
  const branding = resolveRoomBranding({ ...snapshot.branding, lane: snapshot.branding?.lane ?? presentation.lanes[0].id }, room?.id, lane.id);
  const state = partnerLaneState(lane, branding, presentation.assets, presentation.registeredDealers);
  const fallback = state.compatibility === 'full-frame';
  const rooms = owned.filter(row => row.presentationId === lane.id && row.status === 'active' && isGameLaneId(row.id) && (!roomId || row.id === roomId));
  const revision = snapshot.packageRevision ?? snapshot.operator.packageRevision;
  const labels = { dealer: 'Dealer', table: t('Bordsgrafik', 'Table graphics'), background: t('Bakgrund', 'Background') };
  return h('section', { className: 'card flat stack', 'aria-label': t('Publicerad scenmall', 'Published scene template') },
    h('div', {className:'card-head'}, h('div', null,
      h('span', {className:'chip ok'}, t('Publicerat', 'Published')),
      h('h2', null, room?.name ?? t('Bolagets standard', 'Company defaults'))),
      revision ? h('span', {className:'chip accent'}, t('revision ', 'revision ') + revision) : null),
    h('p', null, compositionLabel(state.name, language)),
    h('dl', {className:'kv'}, ...['dealer','table','background'].map(role => {
      const layer = state.layers[role];
      const text = !layer.enabled ? t('Avstängt', 'Disabled') : fallback && role !== 'dealer' ? t('Inbakat i dealerklippet', 'Included in dealer video') : layer.label;
      return h('div', {key:role}, h('dt', null, labels[role]), h('dd', null, text));
    })),
    h('p', {className:'small muted'}, fallback ? t('Fullbildsklipp: bordsgrafik och bakgrund ingår i filmen.', 'Full-frame video: table graphics and background are part of the recording.') : t('Tre separata lager: dealer, bordsgrafik och bakgrund.', 'Three separate layers: dealer, table graphics and background.')),
    view === 'test' ? snapshot.roomBindings === 'operator-owned-v2' || presentation.schemaVersion >= 2
      ? rooms.length ? h('div', {className:'actions'}, ...rooms.map(row => h('a', {key:row.id, className:'btn', target:'_blank', rel:'noopener', href:gameStartPath({game:row.game??'blackjack', operator:snapshot.operator.slug, table:row.id})}, t('Provspela ', 'Play ') + row.name + t(' ↗', ' ↗'))))
        : h('p', {className:'muted'}, t('Inget öppet spelbord för scenmallen.', 'No open table for this scene template.'))
      : h('a', {className:'btn', target:'_blank', rel:'noopener', href:gameStartPath({game:'blackjack', operator:snapshot.operator.slug, lane:lane.id})}, t('Provspela publicerad version ↗', 'Play published version ↗')) : null);
}
