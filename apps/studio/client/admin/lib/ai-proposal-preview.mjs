// "Skapa med AI": where a proposal lands on the chosen scene template, for the
// dialog's desktop (16:9) and phone (9:16) preview. Pure geometry from the
// compositor's own functions; it reads nothing and draws nothing itself.
import {sceneForComposition} from '../../../../../packages/presentation/contracts/composition-settings.mjs';
import {backgroundRect,stageGeometry,tableRect} from '../../../../../packages/presentation/compositor/geometry.js';
import {filmedTableTemplate} from '../../../lib/filmed-table-template.mjs';

export const AI_PREVIEW_LAYOUTS=Object.freeze(['desktop','mobile']);
const ZONE=/^(?:box-[1-7]|dealer|phone)$/,REASONS=['busy','edges','low_contrast'];
const REASON_TEXT=Object.freeze({busy:'orolig filt',edges:'många linjer och kanter',low_contrast:'boxens kant syns dåligt mot filten'});
const BACKGROUND_REASON='mycket detaljer';
const tableZone=zone=>zone==='dealer'?'dealerns plats':'box '+zone.slice(4);
const backgroundZone=zone=>zone==='dealer'?'bakom dealern':'mobilremsan';

// The landing check the server sends with a proposal ({ok, worst, zones}); it
// only warns. Anything malformed or calm gives null, so no badge is shown.
export function aiLandingWarning(check,role) {
  if (!check||typeof check!=='object'||check.ok!==false||!Array.isArray(check.zones)) return null;
  const zones=check.zones.filter(row=>row&&row.ok===false&&typeof row.zone==='string'&&ZONE.test(row.zone)&&REASONS.includes(row.reason)
    &&(role==='table'?row.zone!=='phone':['dealer','phone'].includes(row.zone)));
  if (!zones.length) return null;
  const worst=zones.reduce((one,two)=>Number(two.score)>Number(one.score)?two:one);
  if (role==='table') return {zones:zones.map(row=>row.zone),text:'Korten kan bli svårlästa: '+zones.map(row=>tableZone(row.zone)).join(', '),detail:REASON_TEXT[worst.reason]};
  return {zones:zones.map(row=>row.zone),text:'Bakgrunden kan bli orolig: '+zones.map(row=>backgroundZone(row.zone)).join(', '),detail:BACKGROUND_REASON};
}

// [left, top, width, height] in percent of the frame.
const percent=(rect,dims)=>[rect[0]/dims[0]*100,rect[1]/dims[1]*100,rect[2]/dims[0]*100,rect[3]/dims[1]*100].map(value=>Math.round(value*1000)/1000);
const size=item=>item&&Number(item.width)>0&&Number(item.height)>0?{width:Number(item.width),height:Number(item.height)}:null;

/**
 * Layers for one layout ('desktop' 1920x1080 or 'mobile' 1080x1920 with the
 * background cover-fitted to its centre strip), back to front, each with a
 * frame-relative rect in percent. background and table are {url, video,
 * width, height}; dealer is {url, video} for the 1080x1920 filmed plane.
 * marks: the warned table zones (box-4, dealer) drawn by the server, when the
 * table is the proposal and the dealer has a filmed profile.
 */
export function aiPreviewLayout({layout,settings,background=null,table=null,dealer=null,dealerId='',warned=[],proposalRole=null}) {
  const scene=sceneForComposition(settings,layout),geometry=stageGeometry(scene),dims=geometry.dims,layers=[];
  const backgroundSize=size(background);
  if (background&&backgroundSize) layers.push({kind:'background',url:background.url,video:Boolean(background.video),rect:percent(backgroundRect(scene,backgroundSize,dims),dims)});
  const tableSize=size(table),tableBox=table&&tableSize?tableRect(scene,tableSize,geometry):null;
  const tableLayer=tableBox?{kind:'table',url:table.url,video:Boolean(table.video),rect:percent(tableBox,dims)}:null;
  const dealerLayer=dealer?{kind:'dealer',url:dealer.url,video:Boolean(dealer.video),rect:percent([geometry.x,geometry.y,1080*geometry.s,1920*geometry.s],dims)}:null;
  // As the compositor: tableFront puts the table over the dealer.
  for (const layer of settings.tableFront?[dealerLayer,tableLayer]:[tableLayer,dealerLayer]) if (layer) layers.push(layer);
  const marks=[];
  if (proposalRole==='table'&&tableBox&&warned.length) {
    const template=filmedTableTemplate(dealerId,{composition:settings});
    if (template) {
      const at=box=>[tableBox[0]+box.x/template.canvas.width*tableBox[2],tableBox[1]+box.y/template.canvas.height*tableBox[3],box.width/template.canvas.width*tableBox[2],box.height/template.canvas.height*tableBox[3]];
      for (const zone of warned) {
        const box=zone==='dealer'?template.dealer.box:template.seats.find(seat=>'box-'+seat.id===zone)?.box;
        if (box) marks.push({zone,rect:percent(at(box),dims)});
      }
    }
  }
  return {layout,aspect:dims[0]/dims[1],layers,marks};
}
