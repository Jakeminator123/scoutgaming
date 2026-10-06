import { destinationsFor } from './navigation.mjs';

export function validatePreviewSnapshot(snapshot) {
  if (!snapshot || snapshot.preview !== true || snapshot.mode !== 'fixture' || snapshot.accessClass !== 'internal') throw Error('En verifierad intern förhandsvisning krävs.');
  if (!snapshot.viewer?.user || snapshot.viewer.accessClass !== 'internal') throw Error('Förhandsvisningens administratör saknas.');
  if (!snapshot.operator?.id || !Array.isArray(snapshot.operators) || !snapshot.operators.some(operator => operator.id === snapshot.operator.id)) throw Error('Förhandsvisningens operatör saknas.');
  for (const key of ['tables', 'team', 'presentations', 'players', 'transactions', 'reports']) {
    if (!Array.isArray(snapshot[key]) || snapshot[key].some(item => item.operatorId !== snapshot.operator.id)) throw Error('Förhandsvisningen innehåller fel operatörskontext.');
  }
  return snapshot;
}

export function createPreviewRuntime(snapshot, { surface, user, notify, refresh, assetUrl, studioUrl }) {
  validatePreviewSnapshot(snapshot);
  if(snapshot.viewer.user!==user)throw Error('Administratörskontot har ändrats. Ladda om och logga in igen.');
  if (!['partner','internal'].includes(surface)) throw Error('Unknown preview surface');
  const store = new Map(), localSettings = {}, profiles = {};
  const brands = [{ id:'scout', name:snapshot.operator.name, code: snapshot.brands?.[0]?.code || 'DEMO' }];
  const names = [...new Set(snapshot.presentations.map(profile => typeof profile.dealer === 'string' ? profile.dealer : profile.dealer?.name).filter(Boolean))];
  const dealers = names.map(name => ({ id: name.toLowerCase(), name, lang:'English' }));
  const tables = snapshot.tables.map(table => {
    const profile = snapshot.presentations.find(value => value.id === table.presentationId);
    const dealerName = typeof profile?.dealer === 'string' ? profile.dealer : profile?.dealer?.name;
    return { ...table, name:table.name, game:'Blackjack', room:profile?.background || 'Design reference', dealer:dealerName?.toLowerCase() || null, status:'paused', sourceStatus:table.status, issue:'Fixture · game connection not configured', seats:Array(7).fill(0), seatInfo:[], phase:'Preview', timer:'—', round:'—', open:0, prepared:0, today:0, limits:'Not connected', brands:['scout'], sides:'Presentation reference', runtime:false, since:'—' };
  });
  const emptyResult = { stakes:0,payouts:0,result:0,rounds:0 };
  const date = Date.parse(snapshot.generatedAt || '') || Date.UTC(2026,9,6);
  const data = { brands, dealers, tables, attention:[], ledger:[], results:{today:emptyResult,'7d':emptyResult,'30d':emptyResult}, updatedAt:date, brandShare:{scout:1} };
  const data2 = { players:[],settlements:[],movements:[],shoes:[],summary:{...emptyResult,open:0,prepared:0}, users:[],keys:[],scopes:[],rooms:[],tiers:[],rules:[],archive:[],pit:{bosses:[],triggers:{randomWalkMin:30}},emails:[],kindName:{} };
  const destinations = destinationsFor(surface);
  const groups = [...new Set(destinations.filter(item => item.group !== 'Studio').map(item => item.group))];
  const navigation = groups.map(group => ({group, items:destinations.filter(item => item.group === group).map(item => [item.id,item.label])}));
  const unavailable = label => { notify(`${label}: inte anslutet. Ingen ändring har gjorts i spel eller kunddata.`); };
  const runtime = {
    snapshot, surface, user, data, data2, assetUrl, studioUrl, refresh, notify, unavailable, navigation,
    studioNavigation:destinations.filter(item => item.group === 'Studio').map(item => [item.id,item.label]),
    memory: {getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},
    raw:{ workspace:{activity:[]},game:{manifest:{deal:[],idle:[],repliker:[],rost:{leverantor:'Not connected',namn:'Not connected'}}}, media:{media:[]},config:{} },
    catalogs:{'/bo/jakob-catalog.json':{items:[],families:[],project:{events:[]}},'/bo/clip-provenance.json':{contributions:[],runtime:{},library:{}},'/bo/generations.json':[]},
    settings:localSettings,
    async api() { throw Error('Denna åtgärd har ännu ingen ansluten tjänst. Ingen ändring har gjorts.'); },
    designStore:{read:kind=>structuredClone(profiles[kind] || {}),write:(kind,value)=>{
      profiles[kind]=structuredClone(value);runtime.dirty=true;
      if(surface==='partner')notify(`${kind==='themes'?'Färger, marker och kort':'Bordsdesign'} saknar koppling till en publicerad lane. Ditt val visas bara i den lokala förhandsvisningen.`);
    },save:async()=>{notify('Sparat endast i denna lokala förhandsvisning. Inget publicerat.');},pending:()=>runtime.dirty},
    dirty:false,
  };
  return runtime;
}
