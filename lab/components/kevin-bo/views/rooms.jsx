// Live game-room workspace. Composition, trial play and publication stay mounted together.
import React from 'react';
import { PartnerAppearanceLoader } from '../../partner-appearance-loader.mjs';
import { PartnerPackageView } from '../../partner-package-view.mjs';
import { availablePartnerRooms, initialPartnerRoomSelection } from '../../../lib/partner-room-selection.mjs';

const h = React.createElement;

export function PartnerRoomWorkspace({ snapshot, copy, language, apiBase, onSaved, onDirtyChange, initialRoomId, active = true }) {
  const [selection, setSelection] = React.useState(() => initialPartnerRoomSelection(snapshot, initialRoomId));
  const rooms = availablePartnerRooms(snapshot), roomId = selection.roomId;
  const unavailable = selection.unavailable || roomId !== '' && !rooms.some(room => room.id === roomId);
  const setRoomId = id => setSelection({roomId:id,unavailable:false});
  return h('div', { className: 'page-b kevin-room-content' },
    h('label', { className: 'kevin-room-picker' }, copy.tables,
      h('select', {
        'aria-label': copy.tables,
        value: unavailable ? '__unavailable__' : roomId,
        onChange: event => setRoomId(event.target.value),
      },
      unavailable && h('option', { value: '__unavailable__', disabled: true }, language === 'en' ? 'Room unavailable' : 'Rummet är inte tillgängligt'),
      h('option', { value: '' }, copy.roomDefault),
      rooms.map(room =>
        h('option', { key: room.id, value: room.id }, room.name)))),
    unavailable ? h('p', {role:'alert'}, language === 'en' ? 'The requested room is not available for this operator. Choose an available room.' : 'Det begärda rummet är inte tillgängligt för detta bolag. Välj ett tillgängligt rum.') : h(React.Fragment, null,
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
    })));
}
