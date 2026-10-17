import {dealerClipGuide, type DealerClipPose} from '../../../../../../packages/presentation/contracts/dealer-clip-guide.mjs';
import type {ClipSlot} from '../../lib/connected-studio.mjs';

const poseNames:Record<DealerClipPose,string>={VILA:'Vila',REDO:'Redo vid kortskon',WHEEL:'Vid roulettehjulet'};
function suppliedPose(value:unknown):DealerClipPose|null {
  return value==='VILA'||value==='REDO'||value==='WHEEL'?value:null;
}

export function ClipGuide({slot}:{slot:ClipSlot}) {
  // Optional template poses are displayed only when supplied, never inferred from filenames.
  const source=slot as ClipSlot&{start?:unknown;end?:unknown};
  const start=suppliedPose(source.start),end=suppliedPose(source.end);
  const guide=dealerClipGuide({...slot,label:slot.title,start:start??undefined,end:end??undefined});
  const moving=guide.variations.library!=='none'&&guide.poses.status!=='not-applicable';
  const action=guide.steps.length===3?guide.steps[1]:null;
  const sequence=[
    {label:'Start',title:start?poseNames[start]:'Okänd pose',detail:start?'Angiven i fackets mall.':'Startpose saknas i fackets mall.'},
    {label:'Handling',title:action?.title??(guide.known?guide.title:'Okänd handling'),detail:action?.detail??guide.summary},
    {label:'Slut',title:end?poseNames[end]:'Okänd pose',detail:end?'Angiven i fackets mall.':'Slutpose saknas i fackets mall.'},
  ];
  return <details className="studio-clip-guide">
    <summary title={guide.summary}>Klippguide · {guide.title}</summary>
    <div className="studio-clip-guide-content">
      <p>{guide.summary}</p>
      {moving?<ol className="studio-clip-guide-sequence" aria-label="Start, handling och slut">
        {sequence.map((item,index)=><li key={item.label} className="studio-clip-guide-step"><span>{item.label}</span><strong>{item.title}</strong><p>{item.detail}</p>{index<sequence.length-1&&<span className="studio-clip-guide-arrow" aria-hidden="true">→</span>}</li>)}
      </ol>:<p>{guide.poses.status==='not-applicable'?'Ingen dealerpose hör till detta material.':'Referensbild · ingen rörelsesekvens.'}</p>}
      <p>{guide.poses.note}</p>
      {guide.poses.versions.length>0&&<section className="studio-clip-guide-section" aria-label="Poseversioner"><h3>Poseversioner</h3><ul className="studio-clip-guide-versions">
        {guide.poses.versions.map((version,index)=><li key={version.label+'-'+index}><strong>{version.label}</strong><span>{poseNames[version.start]} → {poseNames[version.end]}</span><small>{version.requirement==='required'?'Krävs för denna mall':'Vid behov i sekvensen'}</small></li>)}
      </ul></section>}
      <section className="studio-clip-guide-section"><h3>{guide.variations.library==='multiple-takes'?'Valfria tagningar':'Materialval'}</h3><p>{guide.variations.note}</p></section>
      <section className="studio-clip-guide-section"><h3>{guide.trigger.title}</h3><p>{guide.trigger.detail}</p>{guide.speech&&<p>{guide.speech.note}</p>}</section>
      <section className="studio-clip-guide-section"><h3>Filnamn och kontroll</h3>
        {guide.filenames.examples.length>0&&<ul>{guide.filenames.examples.map(name=><li key={name}><code>{name}</code></li>)}</ul>}
        <p>{guide.filenames.note}</p><strong>{guide.verification.label}</strong>
        <ul className="studio-clip-guide-checks">{guide.verification.checks.map(check=><li key={check}>{check}</li>)}</ul>
        <p>Fack-ID: <code>{guide.slotId}</code></p>
      </section>
    </div>
  </details>;
}
