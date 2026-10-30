'use client';

import {useState} from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import {Check, ChevronDown, Image as ImageIcon, RotateCcw, UserRound, Layers} from 'lucide-react';
import styles from './partner-appearance.module.css';
import {choiceInitials} from './partner-preview-media.mjs';

export type LayerChoice = {id:string;label:string;src?:string;contentType?:string};
type Kind = 'background'|'dealer'|'table';

function ChoicePicture({choice,kind}:{choice:LayerChoice;kind:Kind}) {
  return <span className={styles.thumb} data-kind={kind}>
    {choice.src ? choice.contentType?.startsWith('video/')
      ? <video src={choice.src + '#t=0.5'} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1}/>
      : <img src={choice.src} alt="" loading="lazy"/>
      : <span className={styles.plate} aria-hidden="true">{choiceInitials(choice.label)}</span>}
  </span>;
}

// The current choice is the resting view in both Admin and Partnerportalen.
// Native disclosure keeps alternatives available by keyboard without another modal.
export function AppearanceChoices({kind,label,value,effective,choices,disabled=false,onChange,language='sv'}:{
  kind:Kind;label:string;value:string;effective:string|null|undefined;choices:LayerChoice[];disabled?:boolean;onChange:(id:string)=>void;language?:string;
}) {
  const en = language === 'en', t = (sv:string, english:string) => en ? english : sv;
  const Icon = kind === 'dealer' ? UserRound : kind === 'background' ? ImageIcon : Layers;
  const current = choices.find(choice => choice.id === effective);
  const missing = Boolean(effective && !current);
  const [expanded,setExpanded] = useState(!current);
  return <fieldset className={styles.choices} data-kind={kind} disabled={disabled}>
    <legend><Icon size={15} aria-hidden="true"/>{label}</legend>
    {choices.length > 0 && <details className={styles.choiceDisclosure} open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
      <summary className={styles.choiceSummary}>
        {current ? <ChoicePicture choice={current} kind={kind}/> : <span className={styles.choicePlaceholder}><Icon size={22} aria-hidden="true"/></span>}
        <span className={styles.currentChoice}><strong>{current?.label ?? t('Välj '+label.toLocaleLowerCase('sv-SE'),'Choose '+label.toLocaleLowerCase('en-GB'))}</strong>
          <small>{current ? value ? t('Eget val','Custom choice') : t('Följer standard','Uses default') : t('Inget giltigt val','No valid choice')}</small></span>
        <span className={styles.changeChoice}>{current ? t('Byt','Change') : t('Välj','Choose')}<ChevronDown size={15} aria-hidden="true"/></span>
      </summary>
      <div className={styles.choiceOptions}>
    <RadioGroup.Root className={styles.choiceGrid} value={effective ?? ''} disabled={disabled} aria-label={label} onValueChange={id => onChange(id)} loop>
      {choices.map(choice => <RadioGroup.Item key={choice.id} value={choice.id} className={styles.choice} aria-label={`${label}: ${choice.label}`} title={choice.label}>
        <ChoicePicture choice={choice} kind={kind}/>
        <RadioGroup.Indicator className={styles.check}><Check size={12} aria-hidden="true"/></RadioGroup.Indicator>
        <span className={styles.choiceName}>{choice.label}</span>
      </RadioGroup.Item>)}
    </RadioGroup.Root>
      </div>
    </details>}
    {missing ? <p role="alert" className={styles.hint}>{t('Det sparade valet finns inte längre i tilldelningen. Välj ett av korten.','The saved choice is no longer in the assignment. Choose one of the cards.')}</p> : null}
    {!choices.length ? <p className={styles.hint}>{t('Inget att välja för det här spelet.','Nothing to choose for this game.')}</p> : null}
    {value && !disabled ? <button type="button" className={styles.linkButton} data-action={`standard-${kind}`} onClick={() => onChange('')}><RotateCcw size={13} aria-hidden="true"/>{t('Använd standard','Use default')}</button> : null}
  </fieldset>;
}
