
import styles from './appearance-layer-picker.module.css';
export type LayerChoice = {id:string;label:string;src?:string;contentType?:string};
export function AppearanceLayerPicker({kind,label,value,effective,choices,locked,lockedReason,onChange}:{kind:'background'|'dealer'|'table';label:string;value:string;effective:string|null|undefined;choices:LayerChoice[];locked:boolean;lockedReason?:string;onChange:(id:string)=>void}) {
  const icon=<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5">{kind==='dealer'?<><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0116 0v3"/></>:kind==='background'?<><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 17l6-6 5 5 4-4 5 5"/><circle cx="16" cy="8" r="1"/></>:<><path d="M2 8h20v7H2zM5 15v7m14-7v7"/><path d="M6 5h12"/></>}</svg>;
  return <fieldset className={styles.picker} disabled={locked}><legend>{icon}{label}<span>{choices.length} alternativ</span></legend>
    {kind==='background'&&<p>Byt miljö utan att ändra dealer eller bord.</p>}
    <div className={styles.choices}>{choices.map(choice=><button type="button" key={choice.id} aria-label={label+': '+choice.label} aria-pressed={effective===choice.id} className={styles.choice} onClick={()=>onChange(choice.id)}>
      <span className={styles.thumbnail} data-kind={kind}>{choice.src?(choice.contentType?.startsWith('video/')?<video src={choice.src} muted playsInline preload="metadata"/>:<img src={choice.src} alt="" loading="lazy"/>):icon}{effective===choice.id&&<span className={styles.check}>✓</span>}</span><span className={styles.name}>{choice.label}</span>
    </button>)}</div>
    {locked&&<p>{lockedReason??'Detta lager är fast i den publicerade spelmallen.'}</p>}
    {!locked&&!choices.length&&<p>Inga valbara alternativ är publicerade för detta spel.</p>}
    {effective&&!choices.some(choice=>choice.id===effective)&&<p role="alert">Det sparade valet är inte längre tillgängligt. Välj ett publicerat alternativ.</p>}
    {!locked&&value&&<button type="button" className={styles.reset} onClick={()=>onChange('')}>↺ Använd standard</button>}
  </fieldset>;
}
