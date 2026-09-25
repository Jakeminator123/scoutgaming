'use client';
import { useEffect, useState } from 'react';
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

const poseStages = [
  ['chat received', 'Chat mottagen'],
  ['response ready', 'Svar klart'],
  ['held for pose', 'Hålls utanför talkön'],
  ['action completed', 'Handling avslutad'],
  ['standard idle presented', 'Standard-idle faktiskt presenterad'],
  ['chat displayed', 'Assistentrad visas'],
  ['speech started', 'Tal startar'],
  ['speech completed', 'Tal avslutat'],
] as const;


interface Props {
  open: boolean; onOpen: (open: boolean) => void;
  mode: DirectorMode; onMode: (mode: DirectorMode) => void; configured: boolean;
  context: TestContext; onContext: (context: TestContext) => void;
  dealer: string; eventLabel: string; sourceType: string;
  result: SimulationResult | null; previewKind: 'selected' | 'social' | null;
  originalLabel?: string;
  busy: boolean; blocked?: boolean; onRun: () => void;
}

export function EventTestPanel({ open, onOpen, mode, onMode, configured, context, onContext, dealer, eventLabel, sourceType, result, previewKind, originalLabel, busy, blocked = false, onRun }: Props) {
  const usesModel = mode === 'active' || mode === 'shadow';
  const [poseStep, setPoseStep] = useState(-1);
  useEffect(() => {
    if (poseStep < 0 || poseStep >= poseStages.length - 1) return;
    const timer = window.setTimeout(() => setPoseStep(step => step + 1), 420);
    return () => window.clearTimeout(timer);
  }, [poseStep]);
  return <details className={styles.panel} open={open} onToggle={e => onOpen(e.currentTarget.open)}>
    <summary><span className={styles.summaryText}><strong>Testa event</strong><small>Prova variantvalet för {dealer} med en simulerad situation.</small></span><span className={styles.badge}>{modeLabels[mode]}</span></summary>
    <div className={styles.body}>
      <p className={styles.intro}><strong>{eventLabel}</strong> bestämmer handlingen. Testsituationen hjälper urvalet att välja en av dina förberedda varianter; den lägger ingen extra animation ovanpå videon.</p>
      <div className={styles.selectionSummary}><strong>{mode === 'active' ? 'OpenClaw väljer bland tillåtna varianter' : `Jämförelsetest: ${modeLabels[mode]}`}</strong><p>{mode === 'active' ? 'Fel eller otillåtet svar ger standardvarianten.' : modeExplanations[mode]}{mode === 'off' ? ' Testsituationen ändrar inte valet i detta läge.' : ''}</p>{mode !== 'active' ? <button type="button" className="text-button" onClick={() => onMode('active')}>Återgå till OpenClaw</button> : null}</div>
      {!configured && usesModel ? <p className="connection-warning">OpenClaw är inte konfigurerat. Testet använder standardvarianten.</p> : null}
      <TestContextPanel value={context} onChange={onContext} />
      <details className={styles.advanced}><summary>Avancerade jämförelsetester</summary><p className={styles.note}>Behåll OpenClaw för vanligt variantval. Övriga lägen hjälper dig att jämföra och felsöka.</p><div className={styles.mode}><label>Urval för detta test<select aria-label="Urvalsläge för eventtest" value={mode} onChange={e => onMode(e.target.value as DirectorMode)}>{(['active', 'shadow', 'off', 'rules', 'random'] as DirectorMode[]).map(id => <option key={id} value={id}>{modeLabels[id]}</option>)}</select></label></div></details>
      <section className={styles.poseSimulation} aria-label="Simulera chattens startpositionsgrind">
        <div><strong>Startpositionsgrind</strong><p>Simulera att ett OpenClaw-svar hålls utanför talkön tills den verkliga standard-idlen har presenterats.</p></div>
        <button type="button" className="text-button" onClick={() => setPoseStep(0)} disabled={poseStep >= 0 && poseStep < poseStages.length - 1}>Simulera chat → pose → tal</button>
        <ol>{poseStages.map(([id, label], index) => <li key={id} data-stage={id} className={index < poseStep ? styles.completedStage : index === poseStep ? styles.activeStage : ''}><code>{id}</code><span>{label}</span></li>)}</ol>
        {poseStep >= 0 ? <small role="status">{poseStep === poseStages.length - 1 ? 'Sekvens klar. Ingen assistenttext eller media släpptes före standard-idle.' : `Steg ${poseStep + 1} av ${poseStages.length}`}</small> : null}
      </section>
      <div className={styles.run}><p>{usesModel ? 'Testa event kan göra ett modellanrop. Spelresultatet ändras inte.' : 'Lokalt test. Inget modellanrop och inget ändrat spelresultat.'}</p><button type="button" className="primary-button" disabled={busy || blocked} onClick={onRun}>{blocked ? 'Socialt svar pågår' : busy ? 'Testar…' : 'Testa event'}</button></div>
      {result ? <section className={styles.result} aria-label="Resultat från eventtest" role="status"><span>VALD VARIANT</span><h3>{result.variant?.label ?? 'Beslut klart'}</h3><p>{reasonDescriptions[result.decision?.reason ?? ''] ?? 'Se beslutsspåret för exakt orsak.'}</p><small>{result.videoGenerationId ? 'Kopplad video · 2D-reserv om filen inte kan spelas' : originalLabel ? `Originalförval · ${originalLabel}` : '2D-reserv · ingen video vald'} · {providerDescriptions[result.provider ?? ''] ?? 'Se tekniskt beslutsspår'}</small></section> : <p className={styles.note}>{previewKind === 'selected' ? 'Du förhandsvisar en vald variant. Det är inget godkänt regelbeslut. Kör Testa event för att prova urvalet.' : previewKind === 'social' ? 'Scenen visar ett chattsvar, inte ett eventtest. Kör Testa event för att prova variantvalet.' : 'Inget test kört för dessa inställningar. Spela vald variant är en separat förhandsvisning utan regelval.'}</p>}
      {result ? <details className={styles.technical}><summary>Tekniskt beslutsspår</summary><p className={styles.note}>Källtyp: {sourceType}. Tillåtna varianter i svaret: {result.eligible?.length ?? '–'}.</p><pre>{JSON.stringify(result, null, 2)}</pre></details> : null}
    </div>
  </details>;
}
