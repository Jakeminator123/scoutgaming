import { createHash } from 'node:crypto';
import { cloneStudioJson, canonicalStudioJson } from '../../packages/studio-registry/server/storage-contract.mjs';
import { validateRoomGameMaterial } from '../../packages/presentation/contracts/room-game-config.mjs';
import { isActiveDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';
import { isOperatorSlug } from '../../packages/navigation/operator-slug.mjs';
import { assertSharedPostgresOwner } from '../../packages/storage/server/postgres-transaction-context.mjs';
import { createActiveRoomPresentationContext } from './shared-room-presentation-context.mjs';

const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const roomId = value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = (code = 'shared_room_presentation_unavailable', statusCode = 503) => { throw Object.assign(new Error(code), { code, statusCode }); };
const stale = () => fail('shared_room_presentation_stale', 409);
const denied = () => fail('shared_room_presentation_forbidden', 403);
const digest = value => createHash('sha256').update(canonicalStudioJson(value)).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const abort = signal => signal.throwIfAborted();

function inputOf(body) {
  let copy;
  try { copy = cloneStudioJson(body, { maxBytes: 16384 }); } catch { fail('shared_room_presentation_invalid', 400); }
  if (!object(copy)) fail('shared_room_presentation_invalid', 400);
  const keys = ['dealerId', 'mode', 'version', 'event', 'presentationContext', 'sharedRoom'];
  if (Object.hasOwn(copy, 'shoeTransitions')) keys.push('shoeTransitions');
  const shared = copy.sharedRoom, context = copy.presentationContext;
  if (!exact(copy, keys) || !isActiveDealerId(copy.dealerId) || !['off', 'rules', 'random', 'shadow', 'active'].includes(copy.mode)
    || !integer(copy.version) || copy.version < 1 || !object(copy.event)
    || !exact(shared, ['roomId', 'ver', 'talkId']) || !roomId(shared.roomId) || shared.ver !== copy.version || !id(shared.talkId)
    || !exact(context, ['operatorSlug', 'roomId', 'packageRevision', 'dealerId']) || !isOperatorSlug(context.operatorSlug)
    || context.roomId !== shared.roomId || context.dealerId !== copy.dealerId || !integer(context.packageRevision) || context.packageRevision < 1
    || Object.hasOwn(copy, 'shoeTransitions') && typeof copy.shoeTransitions !== 'boolean') fail('shared_room_presentation_invalid', 400);
  return freeze(copy);
}

function committedEvent(requested, published) {
  let matches;
  if (requested.type === 'speak' && typeof requested.line === 'string' && /^[a-z]{2,40}$/.test(requested.line)) {
    matches = published.filter(event => event.type === 'speak' && event.line === requested.line);
  } else if (['deal', 'reveal'].includes(requested.type) && integer(requested.shoeDraw)) {
    matches = published.filter(event => event.type === requested.type && event.shoeDraw === requested.shoeDraw
      && event.to === requested.to && (requested.type === 'reveal' || event.box === requested.box));
  } else if (requested.type === 'turn' && integer(requested.box) && integer(requested.handIndex)) {
    matches = published.filter(event => event.type === 'turn' && event.box === requested.box && event.handIndex === requested.handIndex);
  } else if (requested.type === 'settle') matches = published.filter(event => event.type === 'settle');
  if (matches?.length !== 1) stale();
  return matches[0];
}

/** Captures authority twice around unlocked media/Director work. The selection
 * callback receives no session, writer, SQL client or unprojected game state.
 */
export function createSharedRoomPresentationAccess({ access, repository, withLockedRead, readPresentationLocked,
  privateMedia = async () => fail(), createContext = createActiveRoomPresentationContext,
  timeoutMs = 15000, maxResultBytes = 256 * 1024 } = {}) {
  if (typeof access?.authorize !== 'function' || typeof access?.revalidateLocked !== 'function'
    || typeof access?.readPresentationContextLocked !== 'function' || typeof createContext !== 'function' || typeof privateMedia !== 'function'
    || typeof repository?.sharedTransaction !== 'function' || typeof withLockedRead !== 'function' || typeof readPresentationLocked !== 'function'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
    || !Number.isSafeInteger(maxResultBytes) || maxResultBytes < 1 || maxResultBytes > 1024 * 1024) throw new TypeError('Explicit shared presentation ports required');

  async function leased({ request, playerId, signal, roomId: selectedRoom }, captureState, selectFrozen, allowResponse = false) {
    // An outer owner would retain its locks while the selector runs. Refuse
    // nesting before authentication rather than silently extending that lease.
    assertSharedPostgresOwner();
    if (typeof selectFrozen !== 'function' || !id(playerId) || !roomId(selectedRoom)) fail('shared_room_presentation_invalid', 400);
    const controller = new AbortController(), parents = [...new Set([signal, request?.signal].filter(Boolean))];
    if (parents.some(parent => !(parent instanceof AbortSignal))) fail('shared_room_presentation_invalid', 400);
    const relay = () => controller.abort(new DOMException('Presentation cancelled', 'AbortError'));
    for (const parent of parents) parent.addEventListener('abort', relay, { once: true });
    const timer = setTimeout(relay, timeoutMs);
    const active = controller.signal;
    if (parents.some(parent => parent.aborted)) relay();
    let response;
    try {
      abort(active);
      const binding = freeze(cloneStudioJson(await access.authorize(request, { roomId: selectedRoom, signal: active })));
      abort(active);
      if (!object(binding) || binding.actorId !== playerId || binding.roomId !== selectedRoom || !id(binding.operatorId)
        || !id(binding.sessionId) || !integer(binding.expiresAt) || !integer(binding.packageRevision) || binding.packageRevision < 1) denied();
      const authority = digest(binding);
      async function capture(after) {
        abort(active);
        return repository.sharedTransaction(() => withLockedRead({ rooms: [binding.roomId], players: [binding.actorId] }, async reader => {
          abort(active);
          const fresh = await access.revalidateLocked(binding, { signal: active }); abort(active);
          if (digest(fresh) !== authority) denied();
          const captured = await captureState(reader, binding, active); abort(active);
          const fingerprint = digest({ binding: fresh, state: captured.state });
          const value = freeze(cloneStudioJson(captured.value));
          abort(active);
          const result = after ? after({ value, fingerprint }) : { value, fingerprint, context: freeze(cloneStudioJson(captured.context,{maxBytes:16*1024*1024})) };
          abort(active); return result;
        }), { serialize: true });
      }
      const first = await capture(); abort(active); assertSharedPostgresOwner();
      const frozenDealerContext = createContext({...first.context,privateMedia,signal:active,request});
      let cancelSelection;
      const cancelled = new Promise((_, reject) => { cancelSelection = () => reject(active.reason); active.addEventListener('abort', cancelSelection, { once: true }); });
      let selected;
      try {
        const work = Promise.resolve().then(() => { abort(active); return selectFrozen(first.value, { signal: active, frozenDealerContext }); });
        // A provider may finish after cancellation. Never leave its unread
        // private response stream alive after the request loses its lease.
        work.then(value => { if (active.aborted && value instanceof Response) value.body?.cancel().catch(()=>{}); },()=>{});
        selected = await Promise.race([cancelled, work]);
        // Abort can land after work's reaction but before this continuation.
        // Own the stream before any abort/shape check can throw it away.
        if(selected instanceof Response)response=selected;
      } finally { active.removeEventListener('abort', cancelSelection); }
      abort(active);
      // Detach any callback-owned aliases immediately; serialize again inside
      // the final transaction so no malformed result can pass its commit.
      let detached;
      if (allowResponse && selected instanceof Response) {
        response = new Response(selected.body,{status:selected.status,statusText:selected.statusText,headers:selected.headers});
      } else try { detached = freeze(cloneStudioJson(selected, { maxBytes: maxResultBytes })); } catch { fail(); }
      const result = await capture(second => {
        if (first.fingerprint !== second.fingerprint) stale();
        return response ?? cloneStudioJson(detached, { maxBytes: maxResultBytes });
      });
      abort(active); return result;
    } catch(error) {
      if(response?.body)try{await response.body.cancel();}catch{}
      throw error;
    } finally {
      clearTimeout(timer);
      for (const parent of parents) parent.removeEventListener('abort', relay);
    }
  }
  async function withSharedCommittedReceipt(args = {}, selectFrozen) {
    const input = inputOf(args.body);
    return leased({...args,roomId:input.sharedRoom.roomId},async(reader,binding,active)=>{
      const room = await reader.room(binding.roomId); abort(active);
      const presentation = await readPresentationLocked(binding.roomId); abort(active);
      if (!room || !presentation || room.roomId !== binding.roomId || presentation.roomId !== binding.roomId || presentation.status !== 'ready'
        || presentation.ver !== input.sharedRoom.ver || presentation.talkId !== input.sharedRoom.talkId || room.presentationVer !== presentation.ver
        || room.configVersion !== presentation.configVersion || room.windowId !== presentation.windowId
        || !id(presentation.configVersion) || !id(presentation.windowId) || !Array.isArray(presentation.events) || presentation.events.length > 128) stale();
      const config = await reader.config(binding.roomId, room.configVersion); abort(active);
      if (!config || config.configVersion !== room.configVersion || config.roomId !== binding.roomId || config.operatorId !== binding.operatorId
        || !['en', 'sv'].includes(config.language) || config.language !== presentation.language
        || !integer(config.packageRevision) || config.packageRevision < 1 || config.packageRevision > binding.packageRevision) stale();
      let material;
      try { material = validateRoomGameMaterial(config.material, { dealerId: input.dealerId, language: config.language }); } catch { stale(); }
      if (config.leadMs !== material.leadMs || config.cardMs !== material.cardMs) stale();
      const context = await access.readPresentationContextLocked(binding,{configVersion:room.configVersion,signal:active}); abort(active);
      if(digest(context.config)!==digest(config)||digest(context.context)!==digest(input.presentationContext))stale();
      const published = cloneStudioJson(presentation.events).map(event => event.type === 'deal' && event.faceDown ? { ...event, card: null } : event);
      const sourceEvent = committedEvent(input.event, published);
      return {context,state:{presentation,config,context},value:{sourceEvent,published,material,configVersion:config.configVersion,version:presentation.ver,
        roomId:binding.roomId,talkId:presentation.talkId,language:config.language,presentationContext:context.context,
        ...(Number.isFinite(presentation.startAt)?{publishedAt:presentation.startAt}:{}),operatorId:binding.operatorId,packageRevision:config.packageRevision}};
    },selectFrozen);
  }
  async function withActiveRoomPresentation(args = {}, selectFrozen) {
    const expected=args.expected==null?null:cloneStudioJson(args.expected),requested=args.presentationContext==null?null:cloneStudioJson(args.presentationContext);
    if(expected&&(!exact(expected,['configVersion','windowId'])||!id(expected.configVersion)||!id(expected.windowId)))fail('shared_room_presentation_invalid',400);
    if(requested&&(!exact(requested,['operatorSlug','roomId','packageRevision',...(Object.hasOwn(requested,'dealerId')?['dealerId']:[])])
      ||!isOperatorSlug(requested.operatorSlug)||requested.roomId!==args.roomId||!integer(requested.packageRevision)||requested.packageRevision<1
      ||Object.hasOwn(requested,'dealerId')&&!isActiveDealerId(requested.dealerId)))fail('shared_room_presentation_invalid',400);
    return leased(args,async(reader,binding,active)=>{
      const room=await reader.room(binding.roomId);abort(active);
      if(room&&(room.roomId!==binding.roomId||!id(room.configVersion)||!id(room.windowId)||room.windowId==='unopened'))stale();
      const context=await access.readPresentationContextLocked(binding,{configVersion:room?.configVersion??null,signal:active});abort(active);
      const config=context.config,windowId=room?.windowId??'unopened';
      if(!config||config.roomId!==binding.roomId||config.operatorId!==binding.operatorId||!id(config.configVersion)
        ||room&&config.configVersion!==room.configVersion)stale();
      if(expected&&(expected.configVersion!==config.configVersion||expected.windowId!==windowId))stale();
      if(requested&&Object.keys(requested).some(key=>context.context[key]!==requested[key]))stale();
      let filmedMaterial;
      if(config.material?.revision?.startsWith('native-film-v2-')) {
        try { filmedMaterial=validateRoomGameMaterial(config.material,{dealerId:context.context.dealerId,language:config.language}); } catch { stale(); }
        if(config.leadMs!==filmedMaterial.leadMs||config.cardMs!==filmedMaterial.cardMs)stale();
      }
      return {context,state:{windowId,context},value:{roomId:binding.roomId,configVersion:config.configVersion,windowId,
        presentationContext:context.context,operatorId:binding.operatorId,packageRevision:config.packageRevision,
        ...(filmedMaterial?{filmedMaterial}:{})}};
    },selectFrozen,true);
  }
  return Object.freeze({ withSharedCommittedReceipt, withActiveRoomPresentation });
}

