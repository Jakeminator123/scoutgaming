import {ADMIN_WORKSPACE_TOOLS} from '../../../../../packages/navigation/admin-workspace-routes.mjs';

export type AdminNavigationLink = {label:string;href:string;description:string};
export const adminNavigationGroups: {id:string;label:string;description:string;links:AdminNavigationLink[]}[] = [
  {id:'creation',label:'Skapande',description:'Dealers, klipp och scenens utseende.',links:[
    {label:'Klippkarta',href:'/admin/clips',description:'Ordna standardklipp och varianter för varje spelsituation.'},
    {label:'Dealerregister',href:'/admin/dealers',description:'Lägg till dealers och hantera deras bibliotek.'},
    {label:'Bord & bakgrunder',href:'/admin/assets',description:'Hantera material till scenens lager.'},
    {label:'Provspelning',href:'/admin/rehearsal',description:'Följ vad som visas och hörs i spelaren.'},
  ]},
  {id:'business',label:'Verksamhet',description:'Spelbolag, rum och löpande drift.',links:[
    {label:'Spelbolag & rum',href:'/admin/rooms',description:'Öppna ett rum och granska dess tillåtna val.'},
    {label:'Bolag & team',href:'/admin/companies',description:'Hantera bolag, medlemmar och deras åtkomst.'},
    {label:'Drift',href:'/admin/drift',description:'Se driftstatus och tillgängliga driftlägen.'},
    {label:'Ekonomi',href:'/admin/ekonomi',description:'Följ ekonomin och öppna betalningsunderlaget.'},
  ]},
];
export const adminSystemGroups = [
  {label:'Arbetsverktyg',links:[{label:'Verktyg',href:'/admin/tools'},{label:'Kopplingar',href:'/admin/structure'},{label:'Användning & beroenden',href:'/admin/deletion'}]},
  {label:'AI och assistenter',links:[{label:'Agentmodeller',href:'/admin/ai/models'},{label:'Adminroboten',href:'/admin/ai/chat'}]},
  {label:'Åtkomst och historik',links:[{label:'Konton & åtkomst',href:'/admin/admin/accounts'},{label:'Betalningar',href:'/admin/admin/payments'},{label:'Integrationer',href:'/admin/admin/api'},{label:'Bolagsjournal',href:'/admin/admin/log'}]},
];
export const adminPageLabels:Record<string,string> = {
  ...Object.fromEntries(Object.entries(ADMIN_WORKSPACE_TOOLS).map(([key,label])=>['/admin/'+key,label])),
  ...Object.fromEntries([...adminNavigationGroups,...adminSystemGroups].flatMap(group=>group.links.map(link=>[link.href,link.label]))),
  '/admin':'Översikt','/admin/admin/operators':'Spelbolag','/admin/admin/players':'Konton & åtkomst',
};
