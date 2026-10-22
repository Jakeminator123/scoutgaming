import { labUrl } from '../lib/lab-url.mjs';
import styles from './playback-guidance.module.css';

export function PlaybackGuidance({ dealerId, observation = false }: { dealerId: string; observation?: boolean }) {
  const clips = labUrl('/admin/dealer-studio?' + new URLSearchParams({ dealer: dealerId }));
  if (observation) return <details className={styles.help}>
    <summary>Klippförhandsvisning och provspelning</summary>
    <p>Klippförhandsvisning visar en vald fil. Här följer du spelflikens klippval, visad bild och avslut. Ett valt klipp räknas först som visat när spelaren bekräftar det.</p>
    <p><a href={clips}>Redigera dealerns klipp</a> · <a href={labUrl('/admin/probe?' + new URLSearchParams({ dealer: dealerId }))}>Tal vid inaktivitet</a></p>
  </details>;
  return <section className={styles.guide} aria-label="Inspelade klipp och AI-tal">
    <div className={styles.heading}><div><p className={styles.eyebrow}>{observation ? 'FÖLJ VAD SOM HÄNDE' : 'VAD STYR VAD?'}</p><h2>{observation ? 'Klippval och genererat tal har olika spår' : 'En spelhändelse. Ett exakt fack. Ett klipp.'}</h2></div><p>{observation ? 'Ett valt klipp är ett beslut. Start, visad bild och avslut behöver egna kvitton från spelfliken.' : 'Spelmotorn anger vad som händer. Klippreglerna väljer hur dealern visar det.'}</p></div>
    <div className={styles.cards}>
      <article><span className={styles.tag}>INSPELADE KLIPP</span><h3>Kort, repliker och grundloop</h3><p>Färdiga videor för en bestämd spelplats, replik eller rörelse. Tal-klipp har redan inspelat ljud och video.</p><a href={clips}>Öppna dealerns klipp och fack →</a></article>
      <article><span className={styles.tag}>NYTT AI-TAL</span><h3>Chatt och småprat</h3><p>Ny svarstext går via röst och läppsynk innan den kan spelas. Det kräver en aktiverad talintegration för dealern.</p><a href={labUrl('/admin/probe?' + new URLSearchParams({ dealer: dealerId }))}>AI-småprat vid inaktivitet →</a></article>
    </div>
    {!observation ? <><ol className={styles.flow}><li><strong>1 · Spelhändelse</strong><span>Till exempel: ge kort till plats 2.</span></li><li><strong>2 · Exakt fack</strong><span>Den valda dealern + plats 2.</span></li><li><strong>3 · Klippval</strong><span>Standard, regler, slump eller OpenClaw.</span></li><li><strong>4 · Uppspelning</strong><span>Spelaren visar filen och lämnar kvitto.</span></li></ol><p className={styles.note}>”Deal vänster” är en äldre samlingsgrupp för flera platser. Spelarplatsen finns kvar i händelsen och avgör det exakta facket. En inspelad replik väljs på sitt exakta replik-ID.</p></> : null}
  </section>;
}

export function ClipSelectionHelp() {
  return <details className={styles.help}><summary>Automatik, regler och OpenClaw · vad får de välja på?</summary>
    <dl className={styles.definitions}>
      <div><dt>Automatisk grundloopvariation</dt><dd>Tidsintervall, slumpmarginal, minsta paus och maxantal styr en färdig rörelse. Inget AI-anrop. Tal och spelhandlingar går före.</dd></div>
      <div><dt>Regler och slump</dt><dd>Villkor måste matcha. Regler väljer högst prioritet; slump väljer bland uttryckligen tillåtna alternativ. Astrids sparade utdelningsfrekvenser använder procentandelar för exakt plats, utan modell.</dd></div>
      <div><dt>OpenClaw väljer ett färdigt klipp</dt><dd>Får den publika spelhändelsen, tillåtna varianter och deras beskrivningar/villkor. Servern granskar variant-ID och rätt policyversion. Fel eller inget giltigt förslag ger standard. Skuggläge loggar förslaget men spelar standard.</dd></div>
      <div><dt>Var kommer sammanhanget från?</dt><dd>I eventtestet fyller du själv i chattsignal, språk, återkomst, avgjorda vinster/förluster och framtoning. Dessa testvärden hämtas inte från spelaren. Spelflikens vanliga klippval utgår från den publika spelhändelsen.</dd></div>
      <div><dt>OpenClaw-reaktion i grundloopen</dt><dd>Den separata reaktionsvägen kan använda de senaste observerade chattmeddelandena (högst 8, totalt 3 200 tecken) och klippens rörelsebeskrivningar. Utan giltig observation görs inget sådant val. Detta skapar ingen ny talreplik.</dd></div>
      <div><dt>AI-småprat</dt><dd>Skapar ny text. Väntetid, sannolikhet och gränser finns i AI-småprat vid inaktivitet. Klippväljaren byter varken chattmodell, röst eller avatar.</dd></div>
    </dl><p className={styles.note}>Korten och spelresultatet bestäms alltid av spelmotorn. Ett val i testpanelen gäller provet; faktisk uppspelning kontrolleras i Uppspelning.</p>
  </details>;
}
