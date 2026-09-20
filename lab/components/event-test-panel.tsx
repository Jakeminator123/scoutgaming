'use client';
import { modeLabels, modeExplanations } from './gateway-panel';
import { TestContextPanel } from './test-context';
import type { DirectorMode, SimulationResult, TestContext } from './studio-types';
import styles from './event-test-panel.module.css';

const reasonDescriptions: Record<string, string> = {
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
  busy: boolean; blocked?: boolean; onRun: () => void;
}

export function EventTestPanel({ open, onOpen, mode, onMode, configured, context, onContext, dealer, eventLabel, sourceType, result, previewKind, busy, blocked = false, onRun }: Props) {
  const usesModel = mode === 'active' || mode === 'shadow';
  return <details className={styles.panel} open={open} onToggle={e => onOpen(e.currentTarget.open)}>
    <summary><span className={styles.summaryText}><strong>Testa event</strong><small>Prova vilken variant som väljs för {dealer}.</small></span><span className={styles.badge}>{modeLabels[mode]}</span></summary>
    <div className={styles.body}>
      <p className={styles.intro}>Eventgrupp: <strong>{eventLabel}</strong>. Testet använder det sparade eventexemplet, ditt projektutkast och manuella testvärden. Faktisk indata, urval och uppspelningsresultat följs i Händelseloggen.</p>
      <div className={styles.mode}>
        <label>1. Välj urvalsläge<select aria-label="Urvalsläge för eventtest" value={mode} onChange={e => onMode(e.target.value as DirectorMode)}>{(Object.keys(modeLabels) as DirectorMode[]).map(id => <option key={id} value={id}>{modeLabels[id]}</option>)}</select></label>
        <p>{modeExplanations[mode]}{mode === 'off' ? ' Testsituationen ändrar inte valet i detta läge.' : ''}</p>
      </div>
      {!configured && usesModel ? <p className="connection-warning">OpenClaw är inte konfigurerat. Testet använder standardvarianten.</p> : null}
      <TestContextPanel value={context} onChange={onContext} />
      <div className={styles.run}><p>{usesModel ? 'Testa event kan göra ett modellanrop. Spelresultatet ändras inte.' : 'Lokalt test. Inget modellanrop och inget ändrat spelresultat.'}</p><button type="button" className="primary-button" disabled={busy || blocked} onClick={onRun}>{blocked ? 'Socialt svar pågår' : busy ? 'Testar…' : 'Testa event'}</button></div>
      {result ? <section className={styles.result} aria-label="Resultat från eventtest" role="status"><span>VALD VARIANT</span><h3>{result.variant?.label ?? 'Beslut klart'}</h3><p>{reasonDescriptions[result.decision?.reason ?? ''] ?? 'Se beslutsspåret för exakt orsak.'}</p><small>{result.videoGenerationId ? 'Kopplad video · 2D-reserv om filen inte kan spelas' : '2D-reserv · ingen video vald'} · {providerDescriptions[result.provider ?? ''] ?? 'Se tekniskt beslutsspår'}</small></section> : <p className={styles.note}>{previewKind === 'selected' ? 'Du förhandsvisar en vald variant. Det är inget godkänt regelbeslut. Kör Testa event för att prova urvalet.' : previewKind === 'social' ? 'Scenen visar ett chattsvar, inte ett eventtest. Kör Testa event för att prova variantvalet.' : 'Inget test kört för dessa inställningar. Spela vald variant är en separat förhandsvisning utan regelval.'}</p>}
      {result ? <details className={styles.technical}><summary>Tekniskt beslutsspår</summary><p className={styles.note}>Källtyp: {sourceType}. Tillåtna varianter i svaret: {result.eligible?.length ?? '–'}.</p><pre>{JSON.stringify(result, null, 2)}</pre></details> : null}
    </div>
  </details>;
}
