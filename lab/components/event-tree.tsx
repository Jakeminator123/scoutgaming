'use client';

import { useState } from 'react';
import type { DealerId, StudioEvent, StudioLine, StudioProject, StudioTrigger, StudioVariant } from '../lib/studio-model.mjs';
import type { DirectorMode, VideoInventory } from './studio-types';
import { modeLabels } from './gateway-panel';
import styles from './event-tree.module.css';

type Selection = 'game' | 'dealer' | 'event' | 'line' | 'variant' | 'triggers' | 'openclaw';
type EditorTab = 'event' | 'variants' | 'triggers';

interface EventTreeProps {
  project: StudioProject;
  inventory: VideoInventory;
  dealerId: DealerId;
  event: StudioEvent;
  line: StudioLine;
  variant: StudioVariant;
  mode: DirectorMode;
  onSelectDealer: (id: DealerId) => void;
  onSelectEvent: (id: string) => void;
  onSelectVariant: (id: string) => void;
  onEdit: (tab: EditorTab) => void;
  onVideos: () => void;
  onOpenClaw: () => void;
}

const symbols: Record<string, string> = { speak: '◌', deal: '▱', reveal: '◇', turn: '◎', settle: '✦', idle: '◷' };

function SituationSummary({ event }: { event: StudioEvent }) {
  const example = event.exampleEvent;
  const labels: Record<string, string> = {
    to: 'Mottagare', box: 'Bordsplats', handIndex: 'Handindex', line: 'Exakt replik-ID',
    faceDown: 'Dolt kort', shoeDraw: 'Drag-ID', blocking: 'Blockerande replik',
  };
  const fields = Object.entries(labels).filter(([key]) => Object.hasOwn(example, key));
  return <section className={styles.situation} aria-labelledby="situation-title">
    <div className={styles.situationHeading}><div><span className={styles.step}>03 · KONKRET SITUATION</span><h2 id="situation-title">Vad behöver visas just här?</h2></div><span className={styles.exampleBadge}>LABBEXEMPEL · INTE LIVE</span></div>
    <p>Fälten nedan beskriver det valda källexemplet. Gruppen kan omfatta många andra situationer med andra mål, händer eller exakta repliker.</p>
    <dl className={styles.situationFields}>
      <div><dt>Publik presentationstyp <code>sourceType → type</code></dt><dd>{event.sourceType}</dd></div>
      {fields.map(([key, label]) => <div key={key}><dt>{label} <code>{key}</code></dt><dd>{example[key] === null ? 'null' : String(example[key])}</dd></div>)}
    </dl>
    {event.sourceType === 'deal' ? <p className={styles.derivedNote}><strong>Kortposition är en annan uppgift.</strong> Första, andra eller senare kortet i handen behöver härledas ur publika kort och drag. Det finns inget eget sådant fält i dagens <code>deal</code>. <code>shoeDraw</code> är dragets ID, inte kortets ordningsnummer i handen. Box 0–6 är sju bordsplatser; en box kan ha flera händer.</p> : null}
    <div className={styles.coverageNote}>Detta visar ett presentationsbehov, inte godkänd videotäckning. Rätt dealer, mål, exakt tal och sekvens behöver fortfarande verifieras för en riktig take.</div>
  </section>;
}

export function EventTree({ project, inventory, dealerId, event, line, variant, mode, onSelectDealer, onSelectEvent, onSelectVariant, onEdit, onVideos, onOpenClaw }: EventTreeProps) {
  const [selection, setSelection] = useState<Selection>('event');
  const dealer = project.dealers.find(item => item.id === dealerId)!;
  const assets = new Map(project.assets.map(item => [item.id, item]));
  const videos = new Map(inventory.videos.map(item => [item.id, item]));
  const triggers = new Map(project.triggers.map(item => [item.id, item]));
  const baseline = line.variants.find(item => item.id === line.baselineVariantId)!;
  const selectedTriggers = variant.triggerIds.map(id => triggers.get(id)).filter((item): item is StudioTrigger => Boolean(item));
  const selectedAsset = assets.get(variant.assetId);
  const selectedVideo = variant.videoGenerationId ? videos.get(variant.videoGenerationId) : undefined;
  const gameTriggers = project.triggers.filter(item => item.category === 'deterministic');
  const expressionTriggers = project.triggers.filter(item => item.category !== 'deterministic');
  const eventsPerColumn = Math.ceil(project.events.length / 4);
  const eventColumns = Array.from({ length: Math.min(4, project.events.length) }, (_, index) => project.events.slice(index * eventsPerColumn, (index + 1) * eventsPerColumn));
  const bindings = line.variants.filter(item => item.videoGenerationId).length;

  function selectVariant(id: string) { onSelectVariant(id); setSelection('variant'); }

  return <section className={styles.page} aria-labelledby="node-tree-title">
    <header className={styles.intro}>
      <div><span className="eyebrow">ÖVERSIKT / NODTRÄDET</span><h1 id="node-tree-title">Från situation till uttryck.</h1><p>Välj croupier och presentationsbehov. Se sedan den konkreta situationen, villkoren och vilket klipp som är kopplat — utan att blanda ihop dem.</p></div>
      <div className={styles.summary}><strong>{project.dealers.length}<small>croupierer</small></strong><span>×</span><strong>{project.events.length}<small>delade labbnoder</small></strong><span>→</span><strong>{line.variants.length}<small>varianter i vald linje</small></strong></div>
    </header>

    <div className={styles.layout}>
      <div className={styles.canvas} aria-label="Nodträd för Blackjack">
        <div className={styles.canvasLegend}><span><i /> Vald gren</span><span>Heldragen linje = samband</span><span>Tryck på en nod för detaljer</span></div>
        <div className={styles.gameRoot}>
          <span className={styles.step}>01 · SPEL</span>
          <button className={`${styles.node} ${styles.gameNode}`} onClick={() => setSelection('game')}><span aria-hidden="true">♠</span><span><small>Spel</small><strong>Blackjack</strong></span><span className={styles.locked}>Aktivt labb</span></button>
          <span className={styles.future}>Roulette · senare, inte implementerat</span>
        </div>

        <div className={styles.dealerFork} aria-label="Välj croupier">
          {project.dealers.map(item => <button key={item.id} className={`${styles.node} ${styles.dealerNode} ${dealerId === item.id ? styles.selected : ''}`} aria-pressed={dealerId === item.id} onClick={() => { onSelectDealer(item.id); setSelection('dealer'); }}><span className={styles.avatar}>{item.label.slice(0, 1)}</span><span><small>Croupier</small><strong>{item.label}</strong></span>{dealerId === item.id ? <span className={styles.selectedDot} aria-hidden="true" /> : null}</button>)}
        </div>

        <section className={styles.eventShelf} aria-labelledby="shared-events-title">
          <div className={styles.shelfHeading}><div><span className={styles.step}>02 · PRESENTATIONSBEHOV / GRUPPER</span><h2 id="shared-events-title">{project.events.length} labbnoder över 6 presentationstyper.</h2></div><span className={styles.contract}>Källkontraktet ligger fast</span></div>
          <p className={styles.shelfHelp}>Labbets eventnamn delas av alla fyra. Varianterna nedan är redigerbar labbpolicy, inte nya händelser i Kevins spelmotor.</p>
          <p className={styles.groupingNote}>16 grupper är inte 16 videobehov. Mål, hand, kortposition, exakt replik och sekvens kan ge fler situationer; godkänd återanvändning kan låta flera situationer dela take.</p>
          <div className={styles.eventBranches}>{eventColumns.map((column, index) => <div className={styles.eventColumn} key={index}>{column.map(item => <button key={item.id} className={`${styles.node} ${styles.eventNode} ${item.id === event.id ? styles.selected : ''}`} aria-pressed={item.id === event.id} onClick={() => { onSelectEvent(item.id); setSelection('event'); }}><span aria-hidden="true">{symbols[item.sourceType]}</span><span><strong>{item.label}</strong><small>{item.sourceType}</small></span></button>)}</div>)}</div>
        </section>

        <div className={styles.focusStem}><span>Vald gren · {dealer.label} / {event.label}</span></div>
        <SituationSummary event={event} />
        <div className={styles.situationStem} aria-hidden="true" />
        <button className={`${styles.node} ${styles.lineNode}`} onClick={() => setSelection('line')}><span className={styles.step}>04 · LINJEN SAMLAR UTTRYCKEN</span><strong>{line.label}</strong><small>Standard och {line.variants.length - 1} alternativa uttryck för labbets exempel.</small></button>
        {event.id === 'speak.goodluck' ? <p className={styles.labelNote}><code>goodluck</code> betyder ”Lycka till” inför spel, inte en separat välkomsthändelse. Visningsnamn som ”{baseline.label}” ändrar inte det exakta replik-ID:t eller skapar en ny talrad.</p> : null}
        {event.id === 'speak.other' ? <p className={styles.sourceWarning}>Denna labbnod samlar flera exakta replik-ID:n. En video här är bara ett labbexempel, inte en gemensam talvideo för alla dessa repliker. Riktigt tal kräver exakt text, ljud, video och godkänd synk.</p> : null}

        <section className={styles.controlPanel} aria-label="Två triggergrupper före uppspelning">
          <div className={styles.controlHeading}><span className={styles.step}>05 · VILLKOR FÖR VALET</span><span>Prövas före uppspelning — inte som ett extra klipp efteråt.</span></div>
          <div className={styles.controlGrid}>
            <button className={`${styles.triggerGroup} ${styles.gameTrigger}`} onClick={() => { setSelection('triggers'); }}><span className={styles.groupIcon}>↳</span><strong>Spelstyrda</strong><small>Verifierade spelhändelser och resultat.<br />T.ex. vinst- eller förlustsvit.</small><span>{gameTriggers.length} triggers i biblioteket</span></button>
            <button className={`${styles.triggerGroup} ${styles.socialTrigger}`} onClick={() => { setSelection('triggers'); }}><span className={styles.groupIcon}>✳</span><strong>Sociala / uttryck</strong><small>Chattsignal, tidigare önskemål och croupierns framtoning.</small><span>{expressionTriggers.length} triggers i biblioteket</span></button>
          </div>
          <p className={styles.conditionNote}>Alla kopplade villkor måste matcha. De väljer uttryck för samma presentation, inte en automatisk kö av reaktioner. Spelresultatet ändras aldrig.</p>
        </section>

        <button className={`${styles.clawGate} ${styles.decisionBox}`} onClick={() => setSelection('openclaw')}><span className={styles.groupIcon}>◇</span><span><strong>Beslut & ansvar · OpenClaw är ingen triggerkategori</strong><small>Får föreslå endast bland tillåtna varianter. Servern kontrollerar valet. Fel / inget svar → standard i labbet.</small></span><span>Valt läge: {modeLabels[mode]}</span></button>

        <section className={styles.variantSection} aria-labelledby="variant-branches-title">
          <h2 id="variant-branches-title" className={styles.step}>06 · {line.variants.length} UTTRYCKSVARIANTER I DEN HÄR LINJEN</h2>
          <div className={styles.variantFork}>
            {line.variants.map(item => {
              const isBaseline = item.id === line.baselineVariantId;
              const asset = assets.get(item.assetId);
              const video = item.videoGenerationId ? videos.get(item.videoGenerationId) : undefined;
              return <article key={item.id} className={`${styles.variantNode} ${item.id === variant.id ? styles.selectedVariant : ''}`}>
                <button className={styles.variantSelect} aria-pressed={item.id === variant.id} onClick={() => selectVariant(item.id)}><span className={isBaseline ? styles.standardBadge : styles.alternativeBadge}>{isBaseline ? 'STANDARD / FALLBACK' : 'ALTERNATIV'}</span><strong>{item.label}</strong><small>{isBaseline ? 'Alltid tillåten · skyddad' : `Prioritet ${item.priority} · ${item.triggerIds.length ? 'alla villkor krävs' : 'utan villkor'}`}</small></button>
                <div className={styles.triggerChips}>{item.triggerIds.length ? item.triggerIds.map(id => { const trigger = triggers.get(id); return <button key={id} title={trigger ? `${trigger.path} ${trigger.op} ${JSON.stringify(trigger.value)}` : id} className={trigger?.category === 'deterministic' ? styles.gameChip : styles.socialChip} onClick={() => { onSelectVariant(item.id); setSelection('triggers'); }}>{trigger?.category === 'deterministic' ? '↳' : '✳'} {trigger?.label ?? id}</button>; }) : <span className={styles.noCondition}>Inget villkor behövs</span>}</div>
                <div className={styles.assetConnector} aria-hidden="true">↓</div>
                <button className={styles.assetNode} onClick={() => selectVariant(item.id)}><span>{item.videoGenerationId ? 'EXAKT VIDEOMÅL' : '2D / LABBANIMATION'}</span><strong>{video?.label ?? (item.videoGenerationId ? 'Kopplad video' : asset?.label ?? item.assetId)}</strong><code>{item.videoGenerationId ?? item.assetId}</code>{item.videoGenerationId ? <small>{video?.available ? 'Original tillgängligt · ej visuellt godkänt' : 'Original saknas / inte tillgängligt lokalt'}</small> : <small>Kan senare kopplas till en videofil</small>}</button>
              </article>;
            })}
          </div>
          <div className={styles.takeModel}><div><span>NU / IMPLEMENTERAT</span><strong>Ett klippval per variant</strong><p>Varje variant har ett <code>assetId</code> för 2D och högst ett <code>videoGenerationId</code> för videopreview. Inget viktat takeval görs.</p></div><div><span>SENARE / FÖRSLAG</span><strong>Variantfamilj → kompatibel takepool</strong><p>En familj kan få flera granskade takes och eventuella vikter. Kompatibilitet måste prövas före valet. Pooler, vikter och extra reaktionssekvenser finns inte i dagens schema.</p></div></div>
          <div className={styles.fallbackNote}><span>↩</span><p><strong>Standarden är labbets konfigurationsfallback.</strong> Om inget modellval kan användas väljs <strong>{baseline.label}</strong>. I regelläget väljs den högst prioriterade matchande varianten. En standardpost bevisar inte att dess video passar situationen eller är godkänd.</p></div>
        </section>
      </div>

      <aside className={styles.details} aria-label="Detaljer för vald nod" aria-live="polite">
        <div className={styles.detailHeading}><span className="eyebrow">VALD NOD</span><span className={styles.detailType}>{selection === 'game' ? 'Spel' : selection === 'dealer' ? 'Croupier' : selection === 'event' ? 'Event' : selection === 'line' ? 'Linje' : selection === 'variant' ? 'Variant → fil' : selection === 'triggers' ? 'Villkor' : 'Beslut'}</span></div>
        {selection === 'game' ? <><h2>Blackjack</h2><p>Spelmotorn bestämmer kort, turordning och utfall. Trädet bestämmer bara hur det som redan hänt ska presenteras.</p><div className={styles.fact}><strong>{project.dealers.length} croupierer</strong><span>Delar samma {project.events.length} eventnamn och tekniska kontrakt.</span></div><p className={styles.smallNote}>Roulette är endast en framtida plats i strukturen.</p></> : selection === 'dealer' ? <><h2>{dealer.label}</h2><p>Byt croupier utan att byta eventmodell. Du redigerar just nu {dealer.label}s linjer, varianter och videokopplingar.</p><div className={styles.fact}><strong>{project.lines.filter(item => item.dealerId === dealerId).length} linjer</strong><span>En för varje delat event.</span></div><button className="primary-button" onClick={() => onEdit('variants')}>Öppna {dealer.label}s editor →</button></> : selection === 'event' ? <><h2>{event.label}</h2><p>{event.description}</p><dl className={styles.metadata}><div><dt>Publik presentationstyp</dt><dd><code>{event.sourceType}</code></dd></div><div><dt>Tekniskt event-ID</dt><dd><code>{event.id}</code></dd></div><div><dt>Omfattning</dt><dd>Delas av alla fyra</dd></div></dl><p className={styles.smallNote}>Du kan ändra visningsnamnet. Källtyp, ID och spelkontrakt ligger fast. De 16 labbgrupperna är en indelning av 6 presentationstyper, inte ett komplett register över situationer eller nödvändiga videor.</p><button className="primary-button" onClick={() => onEdit('event')}>Redigera eventnamn →</button></> : selection === 'line' ? <><h2>{line.label}</h2><p>Linjen hör till {dealer.label} och eventet {event.label}. Här samlas en skyddad standard och dina alternativ.</p><div className={styles.fact}><strong>{line.variants.length} varianter</strong><span>{bindings} har ett videomål. Resten använder labbanimationer.</span></div><p className={styles.smallNote}>Trädet visar innehållet i ditt aktuella projekt, även om det har färre varianter än startmallen.</p><button className="primary-button" onClick={() => onEdit('event')}>Byt linjens namn →</button></> : selection === 'triggers' ? <><h2>När får en gren öppnas?</h2><p>En trigger är ett villkor för valet före uppspelning, inte ett nytt spel-event eller en extra videosekvens. Alla villkor som du kopplar till en variant måste matcha.</p><div className={styles.fact}><strong>↳ Spelstyrda</strong><span>Speldata och avslutade utfall. ”Tur” betyder exempelvis en definierad vinstsvit, inte ändrad RNG.</span></div><div className={styles.fact}><strong>✳ Sociala / uttryck</strong><span>En chattsignal, en sparad preferens eller ett uttrycksläge. Rodnad kan vara ett valt uttryck för 2D-croupiern, inte en analys av spelarens känslor.</span></div><h3>Villkor för {variant.label}</h3>{selectedTriggers.length ? <ul className={styles.conditionList}>{selectedTriggers.map(trigger => <li key={trigger.id}><strong>{trigger.label}</strong><code>{trigger.path} {trigger.op} {JSON.stringify(trigger.value)}</code></li>)}</ul> : <p className={styles.smallNote}>Inga villkor på den här varianten.</p>}<p className={styles.smallNote}>Chattsignaler och historik är simulerade i labbet. Riktig spelarchatt och bestående spelminne är separata integrationer.</p><button className="primary-button" onClick={() => onEdit('triggers')}>Redigera triggerbiblioteket →</button><button className="text-button" onClick={() => onEdit('variants')}>Koppla villkor till varianten →</button></> : selection === 'openclaw' ? <><h2>Regi inom din ram.</h2><p>Först kontrolleras dina villkor. OpenClaw kan därefter föreslå en av de tillåtna varianterna. Servern kontrollerar svaret före uppspelning.</p><ol className={styles.explanationSteps}><li>Spelmotorn skickar ett event.</li><li>Reglerna avgör vilka grenar som är tillåtna.</li><li>OpenClaw kan föreslå ett variant-ID.</li><li>Kontrollen godtar förslaget eller väljer standard.</li></ol><div className={styles.fact}><strong>{modeLabels[mode]}</strong><span>{mode === 'off' || mode === 'rules' ? 'Det här läget kontaktar ingen modell.' : mode === 'shadow' ? 'Förslaget kan testas, men standarden spelas.' : 'Ett godkänt förslag kan styra uppspelningen.'}</span></div><p className={styles.smallNote}>Valt läge är inte ett anslutningstest. Ett kontrollerat variant-ID är inte ett godkännande av videotäckning. Inget i trädet ändrar RNG, insatser eller utbetalningar.</p><button className="primary-button" onClick={onOpenClaw}>Öppna OpenClaw-inställningar →</button></> : <><h2>{variant.label}</h2><p>{variant.id === line.baselineVariantId ? 'Din skyddade standardvariant. Den kan byta namn och fil, men saknar alltid villkor.' : 'Ett alternativ som får väljas när alla dess villkor matchar.'}</p><dl className={styles.metadata}><div><dt>Croupier / event</dt><dd>{dealer.label} / {event.label}</dd></div><div><dt>Exakt variant-ID</dt><dd><code>{variant.id}</code></dd></div><div><dt>Labbanimation</dt><dd>{selectedAsset?.label ?? variant.assetId}<code>{variant.assetId}</code></dd></div><div><dt>Videofil</dt><dd>{selectedVideo?.fileName ?? (variant.videoGenerationId ? 'Inte tillgänglig i lokalt register' : 'Inte kopplad ännu')}{variant.videoGenerationId ? <code>{variant.videoGenerationId}</code> : null}</dd></div></dl><p className={styles.smallNote}>Dagens variant har ett animations-ID och högst ett video-ID, inte en takepool. Videon binds med ett exakt ID, aldrig genom en gissning utifrån längd. Koppling är inte detsamma som godkänd produktionsvideo.</p><button className="primary-button" onClick={() => onEdit('variants')}>Redigera / testa varianten →</button><button className="text-button" onClick={onVideos}>{variant.videoGenerationId ? 'Se eller byt videomål' : 'Koppla en videofil'} →</button></>}
        <div className={styles.detailFooter}>Ändringar görs i editorn och sparas med <strong>Spara projekt</strong>. Att välja en nod ändrar inte dina data.</div>
      </aside>
    </div>
  </section>;
}
