import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKGROUND_MATERIALS} from '../packages/presentation/contracts/background-materials.mjs';
import {MATERIALS,materialById,materialForAsset,materialLabel,materialSource,materialFitsGame} from '../packages/presentation/contracts/material-catalog.mjs';
import {partnerLaneState} from '../apps/studio/lib/partner-package-view.mjs';

const uploaded=(material,source,id='upload-uuid')=>({id,role:material.role,label:'Old upload name',...source});

test('the five supplied blackjack boards retain separate identities and original dimensions',()=>{
  const tables=MATERIALS.filter(row=>row.role==='table'&&row.game==='blackjack');
  assert.deepEqual(tables.map(row=>row.label),['Blackjack · grön filt','Blackjack · svart filt','Blackjack · Oak','Blackjack · Purple Rain','Blackjack · Back to Basic']);
  assert.equal(new Set(MATERIALS.map(row=>row.id)).size,MATERIALS.length);
  assert.equal(new Set(tables.map(row=>row.sources[0].sha256)).size,5);
  assert.deepEqual(tables.map(row=>[row.sources[0].width,row.sources[0].height]),[[1672,941],[1672,941],[1672,941],[1672,941],[1774,887]]);
  for(const table of tables){
    const asset=uploaded(table,table.sources[0]);
    assert.equal(materialForAsset(asset),table);
    assert.equal(materialFitsGame(asset,'blackjack'),true);
    assert.equal(materialFitsGame(asset,'roulette'),false);
    assert.equal(Object.hasOwn(table,'variantOf'),false);
  }
});

test('the three supplied environments have distinct image/video pairs under stable material IDs',()=>{
  assert.deepEqual(BACKGROUND_MATERIALS.map(row=>[row.id,row.label]),[
    ['studio-dark','Studio · mörk'],['lounge-warm','Lounge · varm'],['studio-teal','Studio · turkos'],
  ]);
  const hashes=new Set();
  for(const material of BACKGROUND_MATERIALS) {
    assert.equal(material.role,'background');assert.equal(material.game,null);
    assert.deepEqual(material.sources.map(source=>source.kind),['image','video']);
    for(const source of material.sources) {
      hashes.add(source.sha256);
      assert.equal(materialForAsset(uploaded(material,source)),material);
      assert.equal(materialSource(material.id,source.kind),source);
    }
  }
  assert.equal(hashes.size,6);
});

test('material identity requires the exact content signature and role, never the label or upload ID',()=>{
  const material=materialById('studio-teal'),asset=uploaded(material,materialSource(material.id));
  assert.equal(materialForAsset({...asset,id:'another-operator-upload',label:'Different name'}),material);
  for(const change of [{role:'table'},{sha256:'0'.repeat(64)},{size:asset.size+1},{contentType:'image/jpeg'},
    {width:asset.width+1},{height:asset.height+1}]) {
    const different={...asset,label:material.label,...change};
    assert.equal(materialForAsset(different),null);
  }
  assert.equal(materialForAsset(null),null);assert.equal(materialForAsset(undefined),null);
  assert.equal(materialById(asset.id),null);assert.equal(materialSource('unknown'),null);
});

test('known materials have canonical names while unregistered assets retain their own names',()=>{
  for(const material of MATERIALS)for(const source of material.sources)
    assert.equal(materialLabel(uploaded(material,source)),material.label);
  assert.equal(materialLabel({role:'background',label:'Custom environment'}),'Custom environment');
});

test('new blackjack table material remains separate from environments and other games',()=>{
  const table=materialById('blackjack-green-felt'),asset=uploaded(table,table.sources[0]);
  assert.equal(materialFitsGame(asset,'blackjack'),true);
  assert.equal(materialFitsGame(asset,'roulette'),false);
  assert.equal(materialFitsGame({...asset,sha256:'0'.repeat(64)},'blackjack'),false);
  assert.equal(materialSource(table.id,'video'),null);
  const background=BACKGROUND_MATERIALS[0];
  assert.equal(materialFitsGame(uploaded(background,background.sources[0]),'roulette'),true);
});

test('partner labels share the catalog but preserve selected upload IDs and frozen input',()=>{
  const material=materialById('studio-teal'),assets=material.sources.map((source,i)=>uploaded(material,source,'background-'+i));
  const layer={enabled:true,default:assets[0].id,allowed:assets.map(row=>row.id),mode:'image'};
  const lane={id:'composition-id',label:'Composition',layers:{background:layer,table:{allowed:[],default:null},dealer:{allowed:['dealer-id'],default:'dealer-id'}}};
  const before=structuredClone({lane,assets});
  for(const asset of assets) {
    const state=partnerLaneState(lane,{lane:lane.id,background:asset.id},assets,[{id:'dealer-id',label:'Dealer'}]);
    assert.equal(state.layers.background.label,'Studio · turkos');
    assert.equal(state.layers.background.selected,asset.id);
    assert.equal(state.layers.dealer.label,'Dealer');
  }
  assert.deepEqual({lane,assets},before);
});
