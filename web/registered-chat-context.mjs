import {isActiveDealerId as isDealerId} from '../packages/presentation/contracts/dealer-identity.mjs';
import {isGameLaneId,isOperatorSlug} from './public/game-lanes.mjs';

const keys=['operatorSlug','roomId','packageRevision','dealerId'];
const fail=(code,statusCode)=>{throw Object.assign(Error(code),{code,statusCode});};
function contextFor(value,dealerId) {
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))
    ||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).length!==keys.length
    ||keys.some(key=>!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)??{},'value'))
    ||!isOperatorSlug(value.operatorSlug)||!isGameLaneId(value.roomId)||value.dealerId!==dealerId
    ||!Number.isSafeInteger(value.packageRevision)||value.packageRevision<1)fail('invalid_chat_context',400);
  return Object.freeze({...value});
}

/** Call only AFTER authenticating the player/session. Client context is a
 * requested selection, never registration authority. The injected resolver
 * must be the server's fresh published operator/room/revision/dealer reader.
 * No mutable dealer registry, media bytes, voice selection or provider calls. */
export function createRegisteredChatContext({resolvePublishedContext=null}={}) {
  if(resolvePublishedContext!==null&&typeof resolvePublishedContext!=='function')throw TypeError('Invalid published chat context resolver');
  return async function authorize({dealerId,presentationContext}={}) {
    if(!isDealerId(dealerId))fail('invalid_chat_dealer',400);
    const context=contextFor(presentationContext,dealerId);
    if(!resolvePublishedContext)fail('chat_dealer_unavailable',503);
    async function recheck() {
      let resolved;
      try {resolved=await resolvePublishedContext(context);}
      catch(error) {
        if(error?.statusCode===409)fail('chat_presentation_changed',409);
        if([400,404].includes(error?.statusCode))fail('chat_dealer_unavailable',403);
        fail('chat_dealer_unavailable',503);
      }
      if(!resolved||resolved.dealer?.id!==dealerId||keys.some(key=>resolved.context?.[key]!==context[key]))fail('chat_dealer_unavailable',503);
      return true;
    }
    await recheck();
    return Object.freeze({dealerId,registered:true,presentationContext:context,recheck});
  };
}

/** Build the chat-only adapter around the existing frozen presentation resolver.
 * The only cached value is its code/service object: every resolve reads ONE
 * fresh atomic snapshot, and game availability is checked on that same value. */
export function createPublishedChatResolver({readCurrentContext,readPresentation}={}) {
  if(typeof readCurrentContext!=='function'||typeof readPresentation!=='function')throw TypeError('Explicit published chat readers required');
  let service;
  return async input=>{
    service??=import('./storage/frozen-dealer-presentation.mjs').then(({createFrozenDealerPresentationContext})=>
      createFrozenDealerPresentationContext({
        readCurrentContext:async (slug,revision)=>{
          const saved=await readCurrentContext(slug,revision);
          if(saved?.operator&&saved.package&&(!Array.isArray(saved.package.games)||!saved.package.games.includes('blackjack')))
            fail('chat_dealer_unavailable',404);
          return saved;
        },
        readPresentation,
        privateMedia:()=>fail('chat_media_not_available',503),
      }));
    return (await service).resolve(input);
  };
}

/** Abort the player's actual active turns, including registered dealers. Keys
 * are server-created [playerId,dealerId] tuples, not a fixed dealer catalogue. */
export function cancelPlayerChats(active,playerId,reason) {
  let count=0;
  for(const [key,controller] of active) {
    let identity;try{identity=JSON.parse(key);}catch{continue;}
    if(Array.isArray(identity)&&identity.length===2&&identity[0]===playerId) {controller.abort(reason);count++;}
  }
  return count;
}
