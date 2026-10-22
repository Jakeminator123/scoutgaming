import {ADMIN_DEPTH_TOOLS,ADMIN_WORKSPACE_TOOLS} from '../../../../../packages/navigation/admin-workspace-routes.mjs';

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
    {label:'Spelarkonton',href:'/admin/players',description:'Spelarnas konton, saldon och status.'},
    {label:'Drift',href:'/admin/drift',description:'Se driftstatus och tillgängliga driftlägen.'},
    {label:'Ekonomi',href:'/admin/ekonomi',description:'Följ ekonomin och öppna betalningsunderlaget.'},
  ]},
];
// System never repeats a Skapande or Verksamhet page. OpenClaw is one page:
// taldrift, agentmodeller, dealerns agent, tal vid inaktivitet och Adminroboten.
export const adminSystemGroups = [
  {label:'Arbetsverktyg',links:[{label:'Fördjupning',href:'/admin/tools'},{label:'Kopplingar & användning',href:'/admin/structure'}]},
  {label:'AI och assistenter',links:[{label:'OpenClaw',href:'/admin/openclaw'}]},
  {label:'Åtkomst och historik',links:[{label:'Konton & åtkomst',href:'/admin/admin/accounts'},{label:'Betalningar',href:'/admin/admin/payments'},{label:'Integrationer',href:'/admin/admin/api'},{label:'Bolagsjournal',href:'/admin/admin/log'}]},
];
// Retired Admin addresses and the page that replaced them (query and fragment follow).
export const adminRetiredPaths:Record<string,string>={
  '/admin/deletion':'/admin/structure','/admin/publication':'/admin/rooms','/admin/ai/models':'/admin/openclaw?tab=models','/admin/ai/chat':'/admin/openclaw?tab=assistant',
  '/admin/dealer-agent':'/admin/openclaw?tab=agent','/admin/probe':'/admin/openclaw?tab=probe','/admin/admin/players':'/admin/players',
};
// Every deep tool opens from exactly one menu page; the sidebar and the tool's
// back link use that page. Fördjupning tools point at Fördjupning itself.
export const adminToolHomes:Record<string,string>={
  companies:'/admin/companies',rehearsal:'/admin/rehearsal',publication:'/admin/rooms',compositions:'/admin/clips',
  videos:'/admin/dealers','dealer-studio':'/admin/dealers',probe:'/admin/openclaw','dealer-agent':'/admin/openclaw',
  ...Object.fromEntries(ADMIN_DEPTH_TOOLS.map(key=>[key,'/admin/tools'])),
};
export const adminToolHome=(tool:string|null)=>tool?adminToolHomes[tool]??'/admin/tools':null;
export const adminPageLabels:Record<string,string> = {
  ...Object.fromEntries(Object.entries(ADMIN_WORKSPACE_TOOLS).map(([key,label])=>['/admin/'+key,label])),
  ...Object.fromEntries([...adminNavigationGroups,...adminSystemGroups].flatMap(group=>group.links.map(link=>[link.href,link.label]))),
  '/admin':'Översikt','/admin/admin/operators':'Spelbolag','/admin/admin/players':'Spelarkonton','/admin/ai/models':'OpenClaw','/admin/ai/chat':'OpenClaw',
};
