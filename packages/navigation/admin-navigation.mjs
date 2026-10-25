// Shared menu labels for the Admin shell and Studio help.
export const adminNavigationGroups = [
  {id:'creation',label:'Studio',description:'Dealers, klipp och scenens utseende.',links:[
    {label:'Sceneditor',href:'/admin/scenes',description:'Placera dealer, bakgrund, bord, kort och spelkontroller i den gemensamma mallen.'},
    {label:'Klippkarta',href:'/admin/clips',description:'Ordna standardklipp och varianter för varje spelsituation.'},
    {label:'Dealers',href:'/admin/dealers',description:'Lägg till dealers och hantera deras bibliotek.'},
    {label:'Bord & bakgrunder',href:'/admin/assets',description:'Hantera material till scenens lager.'},
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
