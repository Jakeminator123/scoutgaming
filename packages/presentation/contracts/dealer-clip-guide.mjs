// Browser/server display guidance. No registry, file access or playback decisions.
const pose = value => ['VILA', 'REDO', 'WHEEL'].includes(value) ? value : null;
const text = value => typeof value === 'string' ? value : '';
const step = (title, detail, at = null) => ({title, detail, pose: at});
const filenameNote = 'Exemplen förklarar vanliga namn. Filnamnet väljer varken fack, pose, tagning eller uppspelning; innehåll och registrerade referenser måste kontrolleras.';
const speech = () => ({defaultSource:'openclaw-text', recordedAlternative:'own-audio',
  note:'OpenClaw väljer normalt texten till AI-tal. En förinspelad replik använder sin egen exakta text och sitt eget ljud. Talfilm, ljud och läpprörelser måste höra ihop.'});
const speechNames = {
  goodluck:'Lycka till', insurance:'Försäkring', double:'Dubbla', placebets:'Lägg insatser',
  dealerblackjack:'Dealern har blackjack', blackjack:'Blackjack', dealerbust:'Dealern över 21',
  win:'Vinst', push:'Lika', lose:'Förlust', greeting:'Välkomsthälsning', peek:'Kontroll av dolt kort',
  bust:'Över 21', sidebet:'Sidospel', chatter1:'Småprat', chatter2:'Småprat', farewell:'Avsked', probe:'Inaktivitetsreplik',
};
const reactionNames = {'turn.player':'Spelarens tur', 'settle.blackjack':'Blackjack', 'settle.dealerBust':'Dealern över 21',
  'settle.win':'Vinst', 'settle.push':'Lika', 'settle.other':'Resultat'};
const version = (label, start, end, required = false) => ({label,start,end,requirement:required?'required':'conditional'});

/** The supplied start/end describe a slot template, never observed media poses.
 * Unknown slots stay unverified. This function neither parses upload names nor
 * invents a live selection policy for additional library takes. */
export function dealerClipGuide(slot) {
  slot = slot && typeof slot === 'object' ? slot : {};
  const id=text(slot.id), parts=id.split('/'), event=text(slot.eventId)||parts[0], situation=text(slot.situation)||parts[1]||'';
  const roulette=slot.game==='roulette'||event.startsWith('roulette.');
  const start=pose(slot.start), end=pose(slot.end);
  const guide={schemaVersion:1,slotId:id,known:false,title:'Klippguide',summary:'Funktionen behöver beskrivas för det här facket.',
    steps:[],poses:{start,end,status:start&&end?'slot-template':'not-specified',
      note:'Angivna poser kommer från fackets mall. De visar inte hur en viss film faktiskt börjar eller slutar.',versions:[]},
    filenames:{examples:[],note:filenameNote},variations:{library:'unspecified',runtime:'not-verified',
      note:'Ingen automatisk uppspelning eller variation är verifierad av den här guiden.'},
    trigger:{title:'Behöver kopplas',detail:'Kontrollera vilken spelhändelse eller vilket talflöde som får använda klippet.'},speech:null,
    verification:{status:'guide-only',label:'Guide · ingen medieacceptans',checks:[
      'Kontrollera den exakta filen och dess hash.',
      'Kontrollera synlig start, handling och slut; en slotmall är inget kalibreringsbevis.',
      'Kontrollera vald bindning och publicerat paket innan uppspelning.',
    ]}};
  const moving=()=>{guide.known=true;guide.variations={library:'multiple-takes',runtime:'not-verified',
    note:'Flera tagningar kan finnas i biblioteket för samma handling. En extra tagning blir inte automatiskt en slumpvariation i spelet.'};};
  const still=()=>{guide.known=true;guide.variations={library:'none',runtime:'not-applicable',
    note:'En stillbild har ingen rörelsevariation. Alternativa bilder är separata referenser eller materialval.'};};
  const sequence=(action,detail)=>{guide.steps=[step('Start',start?`Börja i ${start} enligt vald slotmall.`:'Kontrollera filmens verkliga startpose.',start),
    step(action,detail),step('Slut',end?`Avsluta i ${end} enligt vald slotmall.`:'Kontrollera filmens verkliga slutpose.',end)];};

  if (id==='pose/vila'||id==='pose/redo'||event==='roulette.reference') {
    still();const rouletteReference=event==='roulette.reference',at=rouletteReference?start:id==='pose/redo'?'REDO':'VILA',finish=rouletteReference?end:at;
    guide.title=rouletteReference?'Roulette · referensbild':`${at} · referensbild`;
    guide.summary=rouletteReference?'Stillbild som referens för roulettens dealer.':at==='VILA'?'Stillbild av dealerns vilopose.':'Stillbild av dealern med handen vid kortskon.';
    guide.poses={start:at,end:finish,status:at&&finish?'slot-template':'not-specified',
      note:rouletteReference?'Utgå från roulettens uttryckligen angivna referenspose. Stillbilden bevisar inte en films start- eller slutpose.':'Detta är referensposen i mallen. Stillbilden bevisar inte att en film når samma pose.',versions:[]};
    guide.steps=[step('Referenspose',guide.summary,at)];
    guide.filenames.examples=rouletteReference?['roulette-reference.png']:at==='VILA'?['vila.png','green-startbild.png']:['redo.png'];
    guide.trigger={title:'Referens',detail:'Används som underlag för en pose eller ett valt bildlager; den utför ingen rörelse.'};
  } else if (id==='layer/table'||id==='layer/background'||['table','background'].includes(slot.kind)) {
    still();const table=id==='layer/table'||slot.kind==='table';
    guide.title=table?'Bord':'Bakgrund';guide.summary=table?'Separat förgrundslager framför dealern.':'Separat scenlager bakom dealern.';
    guide.poses={start:null,end:null,status:'not-applicable',note:'Dealerposer hör inte till det här bildlagret.',versions:[]};
    guide.steps=[step('Bakgrund','Scenens bakersta lager.'),step('Dealer','Dealern framför bakgrunden.'),step('Bord','Bordet framför dealern; spelets kort och kontroller visas ovanpå.')];
    guide.filenames.examples=[table?'table.png':'background.png'];guide.trigger={title:'Rummets utseende',detail:'Väljs genom tillåtna material och publicerad sammansättning.'};
  } else if (roulette && ['roulette.idle','roulette.wheel-start'].includes(event)) {
    moving();const wheel=event==='roulette.wheel-start';
    guide.title=wheel?'Starta roulettehjulet':situation==='glasses-clean'?'Putsa glasögon':'Roulette · grundloop';
    guide.summary=wheel?'Dealern sätter hjulet i rörelse och släpper kulan.':'Dealern väntar eller utför den valda vilohandlingen.';
    sequence(wheel?'Hjul och kula':'Vilohandling',wheel?'Hjulimpuls och kulsläpp behöver egna verifierade tidpunkter.':'Återgå till en pose som nästa klipp kan fortsätta från.');
    guide.trigger={title:wheel?'Roulettens start':'Roulettens vila',detail:'Kräver roulettens egen kompatibla bindning och publicering. Ett registrerat klipp aktiverar inte ett rum.'};
    guide.filenames.examples=[wheel?'wheel-start.mp4':situation==='glasses-clean'?'glasses-clean.mp4':'breathing.mp4'];
    guide.verification.checks.push('Verifiera roulettens verkliga poser och bordsgeometri; blackjackens kortsko är ingen mall för roulette.');
  } else if (!roulette && event==='transition.shoe' && ['to-shoe','from-shoe'].includes(situation)) {
    moving();const to=situation==='to-shoe', from=to?'VILA':'REDO', destination=to?'REDO':'VILA';
    guide.title=to?'Till kortskon':'Från kortskon';guide.summary=`Byter mellan ${from} och ${destination} så att nästa handling kan börja rätt.`;
    guide.poses.start=start??from;guide.poses.end=end??destination;guide.poses.status='slot-template';
    guide.poses.versions=[version(guide.title,guide.poses.start,guide.poses.end,true)];
    guide.steps=[step('Start',`Utgå från ${guide.poses.start}.`,guide.poses.start),step('Förflyttning',to?'För handen till kortskon.':'För handen tillbaka till vilan.'),step('Slut',`Möt nästa klipp i ${guide.poses.end}.`,guide.poses.end)];
    guide.filenames.examples=[to?'to-shoe.mp4':'from-shoe.mp4'];guide.trigger={title:'Byte av pose',detail:'Används mellan handlingar som annars skulle mötas i olika poser.'};
    guide.variations.note+=' Övergångens riktning är ett funktionskrav; den är inte en slumpvariation.';
  } else if (!roulette && (event.startsWith('deal.')||event==='reveal.dealer')) {
    const seat=/^box([0-6])$/.exec(situation), reveal=event==='reveal.dealer', dealer=['dealer-up','dealer-hole'].includes(situation);
    const seatEvent=seat&&`deal.player.${+seat[1]<2?'left':+seat[1]<5?'centre':'right'}`;
    if ((seat&&event===seatEvent)||(dealer&&(event==='deal.dealer'||event==='reveal.dealer'&&situation==='dealer-hole'))) {
      moving();const number=seat?Number(seat[1])+1:null, hidden=situation==='dealer-hole';
      guide.title=reveal?'Vänd dolt kort':seat?`Ge kort · plats ${number}`:hidden?'Ge dolt kort':'Ge öppet kort till dealern';
      guide.summary=reveal?'Vänder dealerns redan lagda dolda kort.':`För ett kort från skon till ${seat?`spelarplats ${number}`:hidden?'dealerns dolda kortplats':'dealerns öppna kortplats'}.`;
      sequence(reveal?'Vänd kortet':'Lämna kortet',reveal?'Vänd det befintliga kortet utan att dela ut ett nytt.':`Lämna kortet på exakt ${seat?`plats ${number}`:'dealerns avsedda kortplats'}.`);
      if (reveal) {
        guide.poses.note+=' Kevins flip använder VILA → VILA, medan Forge-mallen anger REDO → REDO. Välj och verifiera rätt källversion; anta inte att de kan bytas mot varandra.';
        guide.poses.versions=[version('Kevins källversion', 'VILA','VILA'),...(start&&end?[version('Vald slotmall',start,end,true)]:[])];
        guide.filenames.examples=['flip.mp4'];
      } else if (hidden) {
        guide.poses.note+=' Kevins hole.mp4 går från REDO till VILA och hole-i.mp4 från VILA till VILA. Forge-mallen anger REDO → REDO. Verifiera den valda källversionen; de har olika slutpose.';
        guide.poses.versions=[version('Kevins basversion','REDO','VILA',start==='REDO'&&end==='VILA'),
          version('Kevins ingång från vila','VILA','VILA',start==='VILA'&&end==='VILA')];
        if(start&&end&&!(end==='VILA'&&['VILA','REDO'].includes(start)))guide.poses.versions.push(version('Vald slotmall',start,end,true));
        guide.filenames.examples=['hole.mp4','hole-i.mp4'];
        guide.filenames.note+=' Dessa två källversioner slutar i VILA; i anger ingång från VILA. De är poseversioner, inte slumpvariationer.';
      } else {
        guide.poses.note+=' Rätt poseversion krävs för den valda kortsekvensen. Behovet av andra versioner beror på var sekvensen börjar, fortsätter och slutar.';
        guide.poses.versions=[version('Första kortet från vila','VILA','REDO',start==='VILA'&&end==='REDO'),
          version('Fortsätt dela','REDO','REDO',start==='REDO'&&end==='REDO'),version('Sista kortet till vila','REDO','VILA',start==='REDO'&&end==='VILA'),
          version('Ett kort från och till vila','VILA','VILA',start==='VILA'&&end==='VILA')];
        const name=seat?`pos${number}`:hidden?'hole':'posdealer';guide.filenames.examples=[`${name}.mp4`,`${name}-i.mp4`,...(!hidden?[`${name}-v.mp4`,`${name}-iv.mp4`]:[])];
        guide.filenames.note+=` ${seat?`${situation} är det interna namnet för plats ${number}. `:''}I Kevins namngivning markerar i ingång från VILA; v/iv är utgångsversioner. Även u/iu förekommer. Det är poseversioner, inte slumpvariationer.`;
      }
      guide.variations.note='Flera tagningar får finnas för samma plats och samma start-/slutpose. Varje tagning behöver egen kalibrering bunden till dess hash. Godtycklig livevariation för givning är ännu inte verifierad; poseversioner är inte slumpvariationer.';
      guide.trigger={title:reveal?'Visa dealerns kort':'Spelmotorns kortdelning',detail:'Spelet bestämmer kort, målplats och ordning. Filnamnet eller klippguiden får inte välja kort eller ändra spelresultat.'};
      guide.verification.checks.push('Verifiera kortets bana, landningsruta, tidpunkt och in-/utgång mot just den valda tagningens hash.');
    }
  } else if (!roulette && event==='idle.ready') {
    moving();guide.title='Grundloop';guide.summary='Lugn närvaro mellan handlingar, exempelvis andning, en blick eller ett litet leende.';
    sequence('Lugn rörelse','Rörelsen ska kunna återgå mjukt till vilan och lämna plats för nästa handling.');
    guide.variations.runtime='configured-policy';guide.variations.note='Flera tagningar kan sparas. Vald grundloop och uttryckligt inställda idlevariationer används genom dealerns publicerade idlepolicy; en ny fil väljs inte automatiskt.';
    guide.filenames.examples=['breath.mp4','glance.mp4','smile.mp4'];
    guide.trigger={title:'Väntan mellan handlingar',detail:'Grundloopen håller dealern närvarande. En inaktivitetsreplik väljs separat av OpenClaw; den är tal och inte en ny idlepose.'};
  } else if (!roulette && (event.startsWith('speak.')||slot.category==='speech'||slot.kind==='speech')) {
    moving();const inactivity=situation==='probe';
    guide.title=speechNames[situation]??'Replik';guide.summary=inactivity?'OpenClaw väljer en passande replik när spelaren är inaktiv.':'En talhandling med rätt text, röst och läpprörelser för situationen.';
    sequence('Säg repliken','Visa den exakt motsvarande talfilmen eller det valda genererade talet.');guide.speech=speech();
    guide.filenames.examples=inactivity?[]:[`repliker/sv/${Object.hasOwn(speechNames,situation)?situation:'replik'}_1.mp4`];
    guide.filenames.note+=' Ett filnamn med probe betyder tekniskt prov. Det bevisar inte att klippet är en inaktivitetsreplik.';
    guide.trigger={title:inactivity?'OpenClaw vid inaktivitet':'Tillåten talhändelse',detail:inactivity?'Texten väljs av OpenClaw i talflödet. Guiden skapar ingen ny trigger.':'Spelhändelsen eller det tillåtna chattsvaret anger situationen; OpenClaw väljer normalt text.'};
    guide.variations.note+=' Förinspelade tagningar måste behålla sin egen text och sitt eget ljud; loopa inte en inspelad mening över annan fortsatt röst.';
    guide.verification.checks.push('Verifiera exakt text, ljud, video, frameindex och läppsynk för samma hashbundna tagning.');
  } else if (!roulette && Object.hasOwn(reactionNames,event)) {
    moving();guide.title=reactionNames[event];guide.summary='En kort synlig reaktion på turen eller resultatet, följd av återgång till nästa handling.';
    sequence('Reaktion','Visa en passande blick eller gest utan att ändra spelets kort och resultat.');
    guide.trigger={title:'Tur eller resultat',detail:'Den auktoritativa spelhändelsen startar reaktionen. En talreplik är ett separat val.'};
    guide.filenames.examples=['reaction.mp4'];
  }
  if (!guide.known && slot.kind==='image') {
    guide.variations={library:'none',runtime:'not-applicable',note:'En stillbild har ingen rörelsevariation. Fackets funktion behöver fortfarande beskrivas.'};
  }
  return guide;
}
