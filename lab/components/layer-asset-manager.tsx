'use client';
import {useState} from 'react';
import type {StudioProject} from '../lib/studio-model.mjs';
import type {LayerAsset} from '../lib/studio-model.mjs';
import {layerAssetReferences,removeLayerAsset,restoreLayerAsset} from '../lib/layer-asset-removal.mjs';
export function LayerAssetManager({project,role,disabled,onEdit,expanded=false}:{project:StudioProject;role:'table'|'background';disabled:boolean;onEdit:(change:(project:StudioProject)=>StudioProject)=>void;expanded?:boolean}){
  const [removed,setRemoved]=useState<LayerAsset[]>([]);
  const assets=(project.layerAssets??[]).filter(asset=>asset.role===role);
  const Container=expanded?'section':'details';
  const heading=<>Hantera {role==='table'?'bord':'bakgrunder'} · {assets.length} filer</>;
  return <Container>{expanded?<h3>{heading}</h3>:<summary>{heading}</summary>}
    <p>Ta bort oanvända filer ur projektets bibliotek. Publicerade paket och själva filerna behålls. Ångra här innan du lämnar sidan; spara sedan projektet.</p>
    {assets.length?<ul>{assets.map(asset=>{const references=layerAssetReferences(project,asset.id);return <li key={asset.id}><strong>{asset.label}</strong> · {references.length?'Används i '+references.map(row=>row.label).join(', '):'Används inte i någon presentation'} <button type="button" disabled={disabled||references.length>0} onClick={()=>{if(disabled||references.length)return;onEdit(current=>removeLayerAsset(current,asset.id));setRemoved(rows=>[...rows.filter(row=>row.id!==asset.id),asset]);}}>Ta bort ur biblioteket</button>{references.length?<p>Koppla loss standardvalet och avmarkera filen bland tillåtna alternativ i dessa presentationer först.</p>:null}</li>;})}</ul>:<p>Inga filer i biblioteket ännu. Ladda upp en fil ovan.</p>}
    {removed.filter(asset=>!assets.some(row=>row.id===asset.id)).map(asset=><p key={asset.id}>{asset.label} · borttagen <button type="button" disabled={disabled} onClick={()=>{if(disabled)return;onEdit(current=>restoreLayerAsset(current,asset));setRemoved(rows=>rows.filter(row=>row.id!==asset.id));}}>Ångra borttagning</button></p>)}
  </Container>;
}
