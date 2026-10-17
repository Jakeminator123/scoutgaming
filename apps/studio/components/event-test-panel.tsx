'use client';
import { modeLabels, modeExplanations } from './gateway-panel';
import { TestContextPanel } from './test-context';
import { ClipSelectionHelp } from './playback-guidance';
import type { DirectorMode, SimulationResult, TestContext } from './studio-types';
import styles from './event-test-panel.module.css';

const reasonDescriptions: Record<string, string> = {
  local_deal_frequency: 'Klippet valdes med platsens valda procentandelar. Inget modellanrop gjordes.',
  deterministic_rules: 'Högst prioriterade variant med matchande villkor valdes. Ingen modell behövdes.',
  local_random: 'Slumpval bland standard och uttryckligen tillåtna alternativ. Spelresultatet påverkas inte.',
  ai_disabled: 'Standardläget spelar alltid din säkra standardvariant. Ingen modell kontaktades.',
  accepted: 'OpenClaw valde en variant som klarade dina regler och serverns kontroll.',
  shadow_only: 'OpenClaws förslag klarade kontrollen. Skuggläget spelar ändå standardvarianten.',
  no_advice: 'Inget giltigt modellförslag kom fram. Din säkra standardvariant används.',
  abstained: 'OpenClaw avstod från att välja. Din säkra standardvariant används.',
  invalid_advice_shape: 'Modellsvaret hade fel format. Standardvarianten skyddar presentationen.',
  request_mismatch: 'Svaret hörde inte till detta test och ignorerades. Standardvarianten används.',
  catalog_mismatch: 'Svaret gällde en annan policyversion och ignorerades. Standardvarianten används.',
  ineligible_variant: 'Förslaget matchade inte dina tillåtna varianter. Standardvarianten används.',
};
const providerDescriptions: Record<string, string> = {
  local_deal_frequency: 'Valda utdelningsfrekvenser',
  local_random: 'Lokal presentationsslump',
  off: 'Lokalt · ingen modell', deterministic_rules: 'Lokal regelmotor', responded: 'OpenClaw svarade',
  remote_unavailable_baseline: 'Render kunde inte lämna ett råd · säker standard',
  openclaw_not_configured: 'OpenClaw är inte anslutet · säker standard',
  openclaw_timeout: 'OpenClaw svarade inte i tid · säker standard',
  openclaw_unreachable: 'OpenClaw kunde inte nås · säker standard',
};



interface Props {
  open: boolean; onOpen: (open: boolean) => void;
  mode: DirectorMode; onMode: (mode: DirectorMode) => void; configured: boolean;
  context: TestContext; onContext: (context: TestContext) => void;
  dealer: string; eventLabel: string; sourceType: string;
  result: SimulationResult | null; previewKind: 'selected' | 'social' | null;
  originalLabel?: string;
  manifestOwned?: boolean;
  dealClips?: boolean; dealFrequency?: boolean;
  busy: boolean; blocked?: boolean; onRun: () => void;
}

export function EventTestPanel({ open, onOpen, mode, onMode, configured, context, onContext, dealer, eventLabel, sourceType, result, previewKind, originalLabel, manifestOwned = false, dealClips = false, dealFrequency = false, busy, blocked = false, onRun }: Props) {
  const usesModel = !dealFrequency && (mode === 'active' || mode === 'shadow');
  return <details className={styles.panel} open={open} onToggle={e => onOpen(e.currentTarget.open)}>
    <summary><span className={styles.summaryText}><strong>Testa event</strong><small>Simulera ett klippval för {dealer}. Ingen spelhandling skickas.</small></span><span className={styles.badge}>{dealFrequency && !['off', 'shadow'].includes(mode) ? 'Valda frekvenser' : modeLabels[mode]}</span></summary>
    <div className={styles.body}>
      <p className={styles.intro}><strong>{eventLabel}</strong> väljer handlingen. Här testar du vilken av dess förberedda videor som väljs — inte själva spelet eller chattsvaret.</p>
      {dealFrequency ? <div className={styles.mode}><label>Prova klippval<select aria-label="Urvalsläge för eventtest" value={['off', 'shadow'].includes(mode) ? mode : 'active'} onChange={e => onMode(e.target.value as DirectorMode)}><option value="active">Valda frekvenser</option><option value="off">Bara standard</option><option value="shadow">Skuggprov · spela standard</option></select></label><p>Procentandelarna gäller varje utdelning till den valda platsen. Ett enskilt prov kan välja standard. Ingen modell behövs.</p></div> : <div className={styles.selectionSummary}>
        <div className={styles.mode}><label>Vem väljer klippet?<select aria-label="Urvalsläge för eventtest" value={mode} onChange={e => onMode(e.target.value as DirectorMode)}>{(['off', 'rules', 'active', 'shadow', 'random'] as DirectorMode[]).map(id => <option key={id} value={id}>{modeLabels[id]}</option>)}</select></label><p>{modeExplanations[mode]}{mode === 'off' ? ' Testsituationen ändrar inte valet i detta läge.' : ''}</p></div>
        <details className={styles.modeHelp}><summary>Vad betyder lägena?</summary><dl>{(['off', 'rules', 'active', 'shadow', 'random'] as DirectorMode[]).map(id => <div key={id}><dt>{modeLabels[id]}</dt><dd>{modeExplanations[id]}</dd></div>)}</dl><p>Det här väljer klippvariant. Det byter inte AI för chatten eller vem som bestämmer korten.</p></details>
      </div>}
      {!configured && usesModel ? <p className="connection-warning">OpenClaw är inte konfigurerat. Testet använder standardvarianten.</p> : null}
      {!dealClips ? <details className={styles.testContext}><summary>Testsituation <span>{mode === 'off' ? 'påverkar inte Standard' : 'simulerad indata'}</span></summary><TestContextPanel value={context} onChange={onContext} /></details> : null}
      <div className={styles.run}><p>{usesModel ? 'Testa event kan göra ett modellanrop. Spelresultatet ändras inte.' : 'Lokalt test. Inget modellanrop och inget ändrat spelresultat.'}</p><button type="button" className="primary-button" disabled={busy || blocked} onClick={onRun}>{blocked ? 'Socialt svar pågår' : busy ? 'Testar…' : 'Testa event'}</button></div>
      {result ? <section className={styles.result} aria-label="Resultat från eventtest" role="status"><span>VALD VARIANT</span><h3>{result.variant?.label ?? 'Beslut klart'}</h3><p>{result.provider === 'local_deal_frequency' && mode === 'shadow' ? 'Frekvensvalet loggas. Skuggprovet spelar standardklippet.' : reasonDescriptions[result.decision?.reason ?? ''] ?? 'Se beslutsspåret för exakt orsak.'}</p><small>{manifestOwned ? result.videoGenerationId ? 'Kopplad video · saknas filen visas ett fel' : 'Ingen video vald' : result.videoGenerationId ? 'Kopplad video · 2D-reserv om filen inte kan spelas' : originalLabel ? `Originalförval · ${originalLabel}` : '2D-reserv · ingen video vald'} · {providerDescriptions[result.provider ?? ''] ?? 'Se tekniskt beslutsspår'}</small></section> : <p className={styles.note}>{previewKind === 'selected' ? 'Du förhandsvisar en vald variant. Det är inget godkänt regelbeslut. Kör Testa event för att prova urvalet.' : previewKind === 'social' ? 'Scenen visar ett chattsvar, inte ett eventtest. Kör Testa event för att prova variantvalet.' : 'Inget test kört för dessa inställningar. Spela vald variant är en separat förhandsvisning utan regelval.'}</p>}
      {result ? <details className={styles.technical}><summary>Tekniskt beslutsspår</summary><p className={styles.note}>Källtyp: {sourceType}. Tillåtna varianter i svaret: {result.eligible?.length ?? '–'}.</p><pre>{JSON.stringify(result, null, 2)}</pre></details> : null}
      {!dealFrequency ? <ClipSelectionHelp /> : null}
    </div>
  </details>;
}
