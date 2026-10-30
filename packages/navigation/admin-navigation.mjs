// Shared menu, tab lists and dealer steps for the Admin shell and Hjälp. Words follow apps/studio/docs/TERMINOLOGI.md.
export const adminNavigationGroups = [
  {id:'content',label:'Innehåll',description:'Dealers, klipp, tal, miljöer och material.',links:[
    {label:'Dealers',href:'/admin/dealers',description:'Ett nav per dealer: klippkarta, röst och tal, landningar, används av och inställningar.'},
    {label:'Miljöer och material',href:'/admin/scenes',description:'Placering av bakgrund, dealer och bordsgrafik, samt bakgrunder och bordsgrafik på ett ställe.'},
  ]},
  {id:'companies',label:'Bolag',description:'Bolagen och deras spelbord.',links:[
    {label:'Bolag och spelbord',href:'/admin/companies',description:'Ett nav per bolag: spelbord, tilldelning, team och inställningar med journalen.'},
  ]},
  {id:'scoutgaming',label:'Scoutgaming',description:'Drift, personal och hjälp.',links:[
    {label:'System',href:'/admin/system',description:'Drift, AI-agenter, Scoutgamings personal, spelarkonton, integration och beroenden. Den interna lobbyn öppnas från sidhuvudet.'},
    {label:'Hjälp',href:'/admin/guide',description:'Menyn, vem som får ändra vad, orden, dealerflödet och var uppgifterna kommer ifrån.'},
  ]},
];
export const adminMenuLinks = adminNavigationGroups.flatMap(group=>group.links);
export const adminDealerTabs = [
  {id:'klipp',label:'Klippkarta'},{id:'tal',label:'Röst och tal'},{id:'landningar',label:'Landningar'},
  {id:'anvands',label:'Används av'},{id:'installningar',label:'Inställningar'},
];
// Five steps, each with a real done state: timing is measured in the clip's panel, and no dealer approval is stored.
export const adminDealerSteps = ['Skapa','Lägg till klipp','Klipp per fack','Röst och tal','Tilldela'];
// Miljöer och material: two tabs. A miljö opens in its own editor (`composition=<id>`); Material filters by kind.
export const adminSceneTabs = [{id:'miljoer',label:'Miljöer'},{id:'material',label:'Material'}];
export const adminMaterialFilters = [{id:'bakgrund',label:'Bakgrund'},{id:'bordsgrafik',label:'Bordsgrafik'},{id:'arkiverat',label:'Arkiverat'}];
export const adminMaterialFilterId = value => adminMaterialFilters.some(row=>row.id===value) ? value : adminMaterialFilters[0].id;
const sceneHref = params => '/admin/scenes?' + new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string'&&value)).toString();
/** The environment list, or one environment's editor when `id` is given; `extra` keeps a dealer or game choice. */
export const environmentHref = (id, extra={}) => sceneHref({tab:'miljoer', composition:id, ...extra});
/** The material tab with one filter (bakgrund, bordsgrafik, arkiverat); `extra` keeps a game choice. */
export const materialHref = (filter, extra={}) => sceneHref({tab:'material', filter:adminMaterialFilterId(filter), ...extra});
export const adminCompanyListTabs = [{id:'bolag',label:'Bolag'},{id:'spelbord',label:'Alla spelbord'},{id:'papperskorg',label:'Papperskorg'}];
// Spelbord first (the default tab). Spelare och ekonomi and Integration return when step F gives data per company.
export const adminCompanyTabs = [
  {id:'spelbord',label:'Spelbord'},{id:'tilldelning',label:'Tilldelning'},{id:'team',label:'Team'},{id:'installningar',label:'Inställningar'},
];
// Retired tab ids land on the nearest tab, so old bookmarks keep working: start addresses moved to Spelbord,
// the journal to Inställningar.
export const adminTabAliases = {company:{spelare:'spelbord',integration:'spelbord',journal:'installningar'}};
export const adminRoomTabs = [
  {id:'utseende',label:'Utseende'},{id:'dealer',label:'Dealer'},{id:'spel',label:'Spelinställningar'},
  {id:'tillganglighet',label:'Tillgänglighet'},{id:'bolagets-val',label:'Bolagets val'},{id:'historik',label:'Historik'},
];
// Six tabs. Intern lobby is a link in System's page header; the retired tab id `lobby` lands on Drift.
export const adminSystemTabs = [
  {id:'drift',label:'Drift'},{id:'agenter',label:'AI-agenter'},{id:'personal',label:'Scoutgamings personal'},{id:'spelare',label:'Spelarkonton'},
  {id:'integration',label:'Integration'},{id:'beroenden',label:'Beroenden'},
];
const tabsFor = {dealer:adminDealerTabs,scenes:adminSceneTabs,companies:adminCompanyListTabs,company:adminCompanyTabs,room:adminRoomTabs,system:adminSystemTabs};
export const adminTabId = (page,value) => {
  const aliases=adminTabAliases[page]??{},id=typeof value==='string'&&Object.hasOwn(aliases,value)?aliases[value]:value;
  return (tabsFor[page]??[]).some(tab=>tab.id===id) ? id : (tabsFor[page]?.[0]?.id??'');
};
