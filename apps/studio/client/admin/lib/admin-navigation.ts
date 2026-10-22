import {ADMIN_WORKSPACE_TOOLS} from '../../../../../packages/navigation/admin-workspace-routes.mjs';

export type AdminNavigationLink = {label:string;href:string;description:string};
export const adminNavigationGroups: {id:string;label:string;description:string;links:AdminNavigationLink[]}[] = [
  {id:'creation',label:'Studio',description:'Dealers, klipp och scenens utseende.',links:[
    {label:'Klippkarta',href:'/admin/clips',description:'Ordna standardklipp och varianter för varje spelsituation.'},
    {label:'Dealers',href:'/admin/dealers',description:'Lägg till dealers och hantera deras bibliotek.'},
    {label:'Bord & bakgrunder',href:'/admin/assets',description:'Hantera material till scenens lager.'},
    {label:'Provspelning',href:'/admin/rehearsal',description:'Följ vad som visas och hörs i spelaren.'},
  ]},
  {id:'business',label:'Administration',description:'Spelbolag, rum och löpande drift.',links:[
    {label:'Spelbolag & rum',href:'/admin/rooms',description:'Öppna ett rum och granska dess tillåtna val.'},
    {label:'Bolag & team',href:'/admin/companies',description:'Hantera bolag, medlemmar och deras åtkomst.'},
    {label:'Spelarkonton',href:'/admin/players',description:'Spelarnas konton, saldon och status.'},
    {label:'Drift',href:'/admin/drift',description:'Se driftstatus och tillgängliga driftlägen.'},
    {label:'Ekonomi',href:'/admin/ekonomi',description:'Följ ekonomin och öppna betalningsunderlaget.'},
  ]},
];
export const adminSystemGroups = [
  {label:'Inställningar',links:[{label:'Systeminställningar',href:'/admin/ai/models'},{label:'Kopplingar & användning',href:'/admin/structure'},{label:'Integrationer',href:'/admin/admin/api'}]},
  {label:'Åtkomst och hjälp',links:[{label:'Konton & åtkomst',href:'/admin/admin/accounts'},{label:'Hjälp',href:'/admin/guide'}]},
];
// Contextual tools belong to their resource, never to a second tool directory.
export const adminToolHomes:Record<string,string>={
  companies:'/admin/companies',rehearsal:'/admin/rehearsal',publication:'/admin/rooms',compositions:'/admin/clips',
  videos:'/admin/dealers','dealer-studio':'/admin/dealers',probe:'/admin/dealers','dealer-agent':'/admin/dealers',
  'media-review':'/admin/dealers',replies:'/admin/dealers',events:'/admin/dealers',guide:'/admin/guide',
};
export const adminToolHome=(tool:string|null)=>tool?adminToolHomes[tool]??'/admin':null;
export const adminPageLabels:Record<string,string> = {
  ...Object.fromEntries(Object.entries(ADMIN_WORKSPACE_TOOLS).map(([key,label])=>['/admin/'+key,label])),
  ...Object.fromEntries([...adminNavigationGroups,...adminSystemGroups].flatMap(group=>group.links.map(link=>[link.href,link.label]))),
  '/admin':'Översikt','/admin/admin/operators':'Spelbolag','/admin/admin/players':'Spelarkonton',
};
