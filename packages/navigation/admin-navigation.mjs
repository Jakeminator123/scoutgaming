// Shared menu, tab lists and dealer steps for the Admin shell and Hjälp. Words follow apps/studio/docs/TERMINOLOGI.md.
export const adminNavigationGroups = [
  {id:'content',label:'Innehåll',description:'Dealers, klipp, tal, scenmallar och material.',links:[
    {label:'Dealers',href:'/admin/dealers',description:'Ett nav per dealer: klippkarta, röst och tal, landningar, används av och inställningar.'},
    {label:'Scenmallar och material',href:'/admin/scenes',description:'Placering av bakgrund, dealer och bordsgrafik, samt bakgrunder och bordsgrafik på ett ställe.'},
  ]},
  {id:'companies',label:'Bolag',description:'Bolagen och deras spelbord.',links:[
    {label:'Bolag och spelbord',href:'/admin/companies',description:'Ett nav per bolag: tilldelning, spelbord, spelare och ekonomi, team, integration, journal och inställningar.'},
  ]},
  {id:'scoutgaming',label:'Scoutgaming',description:'Drift, personal och hjälp.',links:[
    {label:'System',href:'/admin/system',description:'Drift, AI-agenter, Scoutgamings personal, spelarkonton, integration, beroenden och intern lobby.'},
    {label:'Hjälp',href:'/admin/guide',description:'Menyn, vem som får ändra vad, orden, dealerflödet och var uppgifterna kommer ifrån.'},
  ]},
];
export const adminMenuLinks = adminNavigationGroups.flatMap(group=>group.links);
export const adminDealerTabs = [
  {id:'klipp',label:'Klippkarta'},{id:'tal',label:'Röst och tal'},{id:'landningar',label:'Landningar'},
  {id:'anvands',label:'Används av'},{id:'installningar',label:'Inställningar'},
];
export const adminDealerSteps = ['Skapa','Lägg till klipp','Klipp per fack','Mät landningar','Röst och tal','Godkänn','Tilldela'];
export const adminSceneTabs = [
  {id:'mallar',label:'Scenmallar'},{id:'bakgrunder',label:'Bakgrunder'},{id:'bordsgrafik',label:'Bordsgrafik'},{id:'papperskorg',label:'Papperskorg'},
];
export const adminCompanyListTabs = [{id:'bolag',label:'Bolag'},{id:'spelbord',label:'Alla spelbord'}];
export const adminCompanyTabs = [
  {id:'tilldelning',label:'Tilldelning'},{id:'spelbord',label:'Spelbord'},{id:'spelare',label:'Spelare och ekonomi'},
  {id:'team',label:'Team'},{id:'integration',label:'Integration'},{id:'journal',label:'Journal'},{id:'installningar',label:'Inställningar'},
];
export const adminRoomTabs = [
  {id:'utseende',label:'Utseende'},{id:'dealer',label:'Dealer'},{id:'spel',label:'Spelinställningar'},
  {id:'tillganglighet',label:'Tillgänglighet'},{id:'bolagets-val',label:'Bolagets val'},{id:'historik',label:'Historik'},
];
export const adminSystemTabs = [
  {id:'drift',label:'Drift'},{id:'agenter',label:'AI-agenter'},{id:'personal',label:'Scoutgamings personal'},{id:'spelare',label:'Spelarkonton'},
  {id:'integration',label:'Integration'},{id:'beroenden',label:'Beroenden'},{id:'lobby',label:'Intern lobby'},
];
const tabsFor = {dealer:adminDealerTabs,scenes:adminSceneTabs,companies:adminCompanyListTabs,company:adminCompanyTabs,room:adminRoomTabs,system:adminSystemTabs};
export const adminTabId = (page,value) => (tabsFor[page]??[]).some(tab=>tab.id===value) ? value : (tabsFor[page]?.[0]?.id??'');
