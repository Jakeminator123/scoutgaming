import {sourceActorTransform} from './game-contract.mjs';
export function dealerUpEligible({hostname,port,params,dealer,containerId,index,faceDown}){return hostname==='astridsingleseat.localhost'&&port==='4190'&&(params.get('astridDealerUp')??'review')==='review'&&params.get('astridBox0')==='review'&&dealer==='astrid'&&containerId==='dealer-cards'&&index===0&&faceDown===false;}
export function dealerUpProfile(ledger,media,target){
 const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 if(!hash(media.outputSHA256)||ledger.sourceSha256!==media.outputSHA256||!hash(media.sourceBundleSHA256)||ledger.sourceBundleSHA256!==media.sourceBundleSHA256||ledger.fps!==60||ledger.frames?.length!==85||media.frameCount!==85||target.targetId!=='dealer-up'||target.seatId!=='dealer')throw Error('Dealer-up profile provenance mismatch');
 const transforms={};for(const key of ['centreEntry','contact','right'])transforms[key]=sourceActorTransform(ledger.sourceRegistrations?.[key]);
 if(Object.values(transforms).some(v=>!v)||JSON.stringify(ledger.sourceRegistrations)!==JSON.stringify(media.sourceRegistrations))throw Error('Dealer-up source registration mismatch');
 for(const frame of ledger.frames)if(!transforms[frame.source]||!Number.isInteger(frame.sourceNative)||frame.sourceNative<0)throw Error('Dealer-up source frame invalid');
 const shoe=ledger.shoeOcclusion;if(shoe?.src!=='/astrid-dealer-up/shoe-allowed-canonical.png'||!hash(shoe.sha256)||shoe.sha256!==media.shoeMaskSHA256||shoe.startFrame!==30||shoe.endFrame!==44)throw Error('Dealer-up shoe contract mismatch');
 return {transforms,shoe};
}
