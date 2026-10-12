// Live game-room workspace. Composition, trial play and publication stay mounted together.
import React from 'react';
import { PartnerAppearanceLoader } from '../../partner-appearance-loader.mjs';
import { PartnerPackageView } from '../../partner-package-view.mjs';

const h = React.createElement;

export function PartnerRoomWorkspace({ snapshot, copy, language, apiBase, onSaved, onDirtyChange, active = true }) {
  const [roomId, setRoomId] = React.useState(() => snapshot.tables.find(room => room.operatorId === snapshot.operator.id)?.id ?? '');
  return h('div', { className: 'page-b kevin-room-content' },
    h('label', { className: 'kevin-room-picker' }, copy.tables,
      h('select', {
        'aria-label': copy.tables,
        value: roomId,
        onChange: event => setRoomId(event.target.value),
      },
      h('option', { value: '' }, copy.roomDefault),
      snapshot.tables.filter(room => room.operatorId === snapshot.operator.id).map(room =>
        h('option', { key: room.id, value: room.id }, room.name)))),
    h(PartnerPackageView, { snapshot, view: 'test', roomId, language }),
    h(PartnerAppearanceLoader, {
      apiBase,
      operatorId: snapshot.operator.id,
      operatorSlug: snapshot.operator.slug,
      section: 'all',
      language,
      active,
      roomId,
      onRoomChange: setRoomId,
      onDirtyChange,
      onSaved,
    }));
}
