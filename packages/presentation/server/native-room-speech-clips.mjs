import { createHash } from 'node:crypto';
import { canonicalStudioJson } from '../../studio-registry/server/document-contract.mjs';
import { readPackagePresentation } from './presentation-package.mjs';
import { frozenPlaybackProject } from '../contracts/frozen-dealer-playback.mjs';
import { recordedSpeechForVideo } from '../contracts/recorded-speech.mjs';
import { speechSlotEventId, speechSlotStandard } from '../contracts/speech-slot-bindings.mjs';
import { NATIVE_ROOM_SPEECH_SLOTS } from '../contracts/native-room-game-budget.mjs';
import { isNativeRoomMaterial } from '../contracts/native-room-filmed-planning.mjs';
import { validateRoomGameMaterial } from '../contracts/room-game-config.mjs';

const hash = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');

/** Preview 28 Oct 2026: every spoken line of a shared room waited for POST select (0.9-4.3 s) before its file was
 * even asked for. A native room's lines are its speech slot standards (native-room-game-material.mjs requires one
 * per slot): the clip select chooses for the line in the 'off' mode (selection.mjs: the slot standard for
 * speak.other, the baseline for goodluck, insurance and double), gated as an approved recorded take of this
 * dealer, line and language. Pure: the room's immutable config ({ operatorId, packageRevision, presentationHash,
 * language, material }) and the package it is bound to. Returns { [lineId]: { id, sha256 } } for each line that
 * has such a clip listed in the config's material, or null when the package is not that config's own or the
 * material is not native. Never a card, an order or a fallback search. */
export function nativeRoomSpeechClips({ package: pack, config } = {}) {
  try {
    if (!pack || !config || pack.operatorId !== config.operatorId || pack.revision !== config.packageRevision) return null;
    const material = validateRoomGameMaterial(config.material, { dealerId: config.material?.dealerId, language: config.language });
    if (!isNativeRoomMaterial(material)) return null;
    const presentation = readPackagePresentation(pack);
    if (presentation?.schemaVersion !== 3 || !presentation.playback || hash(presentation) !== config.presentationHash) return null;
    const { dealerId, language } = material;
    const project = frozenPlaybackProject(presentation.playback, { registeredDealers: presentation.registeredDealers, projectRevision: presentation.projectRevision });
    const listed = new Map(material.media.map(ref => [ref.id, ref.sha256]));
    const clips = {};
    for (const lineId of NATIVE_ROOM_SPEECH_SLOTS) {
      let variant;
      try { variant = speechSlotStandard(project, dealerId, speechSlotEventId(lineId), lineId); } catch { continue; }
      const record = variant && presentation.playback.media.find(row => row.id === variant.videoGenerationId && row.classification?.dealerId === dealerId);
      if (!record || record.deletion || record.classification.archived === true || listed.get(record.id) !== record.sha256) continue;
      if (!recordedSpeechForVideo(record, { dealerId, lineId, language, takeId: record.classification.recordedSpeech?.takeId })) continue;
      clips[lineId] = { id: record.id, sha256: record.sha256 };
    }
    return clips;
  } catch { return null; }
}
