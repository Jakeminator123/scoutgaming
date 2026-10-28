'use client';

import * as RadioGroup from '@radix-ui/react-radio-group';
import {Check, Image as ImageIcon, RotateCcw, UserRound, Layers} from 'lucide-react';
import styles from './partner-appearance.module.css';
import {choiceInitials} from './partner-preview-media.mjs';

export type LayerChoice = {id:string;label:string;src?:string;contentType?:string};
type Kind = 'background'|'dealer'|'table';

// Ett lager som klickbara kort (Radix RadioGroup: piltangenter, en tabbstopp, aria-checked).
// Kortet visar paketets frysta bild för valet; utan bild en platta med initialer.
export function AppearanceChoices({kind,label,value,effective,choices,disabled=false,onChange,language='sv'}:{
  kind:Kind;label:string;value:string;effective:string|null|undefined;choices:LayerChoice[];disabled?:boolean;onChange:(id:string)=>void;language?:string;
}) {
  const en = language === 'en', t = (sv:string, english:string) => en ? english : sv;
  const Icon = kind === 'dealer' ? UserRound : kind === 'background' ? ImageIcon : Layers;
  const missing = Boolean(effective && !choices.some(choice => choice.id === effective));
  return <fieldset className={styles.choices} data-kind={kind} disabled={disabled}>
    <legend><Icon size={15} aria-hidden="true"/>{label}<span>{choices.length === 1 ? t('1 att välja','1 to choose') : t(`${choices.length} att välja bland`,`${choices.length} to choose from`)}</span></legend>
    <RadioGroup.Root className={styles.choiceGrid} value={effective ?? ''} disabled={disabled} aria-label={label} onValueChange={id => onChange(id)} loop>
      {choices.map(choice => <RadioGroup.Item key={choice.id} value={choice.id} className={styles.choice} aria-label={`${label}: ${choice.label}`} title={choice.label}>
        <span className={styles.thumb} data-kind={kind}>
          {choice.src ? choice.contentType?.startsWith('video/')
            ? <video src={choice.src + '#t=0.5'} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1}/>
            : <img src={choice.src} alt="" loading="lazy"/>
            : <span className={styles.plate} aria-hidden="true">{choiceInitials(choice.label)}</span>}
          <RadioGroup.Indicator className={styles.check}><Check size={12} aria-hidden="true"/></RadioGroup.Indicator>
        </span>
        <span className={styles.choiceName}>{choice.label}</span>
      </RadioGroup.Item>)}
    </RadioGroup.Root>
    {missing ? <p role="alert" className={styles.hint}>{t('Det sparade valet finns inte längre i tilldelningen. Välj ett av korten.','The saved choice is no longer in the assignment. Choose one of the cards.')}</p> : null}
    {!choices.length ? <p className={styles.hint}>{t('Inget att välja för det här spelet.','Nothing to choose for this game.')}</p> : null}
    {value && !disabled ? <button type="button" className={styles.linkButton} data-action={`standard-${kind}`} onClick={() => onChange('')}><RotateCcw size={13} aria-hidden="true"/>{t('Använd standard','Use default')}</button> : null}
  </fieldset>;
}
