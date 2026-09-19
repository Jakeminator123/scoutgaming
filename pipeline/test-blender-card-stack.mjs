import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../web/public/vendor/three/three.module.js';
import {createBlenderCardStack} from '../web/public/blender-table-details.mjs';

test('imported shoe stack follows authoritative counts and stays inside the shell',()=>{
  const {root,update}=createBlenderCardStack({width:.072827,length:.266852,height:.095662},new T.Texture());
  assert.equal(root.visible,false,'do not invent a full shoe before state arrives');
  update({total:416,remaining:416,dealt:0,cutAfter:312,cutReached:false});
  const pack=root.getObjectByName('CardPack'),front=root.getObjectByName('ScoutCardBack'),follower=root.getObjectByName('ShoeFollower');
  const full=pack.geometry.boundingBox.clone(),outlet=front.position.clone(),fullFollower=follower.position.z;
  assert.ok(full.min.x>-.0364135&&full.max.x<.0364135);
  assert.ok(full.min.y>=0&&full.max.y<.095662);
  assert.ok(full.min.z>-.266852&&full.max.z<=0);
  update({total:416,remaining:208,dealt:208,cutAfter:312,cutReached:false});
  assert.ok(follower.position.z>fullFollower,'follower advances towards the outlet');
  assert.equal(root.userData.remaining,208);
  assert.ok(front.position.equals(outlet),'front card remains at the filmed pickup');
  assert.ok(pack.geometry.boundingBox.min.z>full.min.z,'pack physically shortens');
  update({total:416,remaining:0,dealt:416,cutAfter:312,cutReached:true});
  assert.equal(pack.visible,false);assert.equal(front.visible,false);
  assert.equal(root.userData.packLength,0);
  assert.ok(root.getObjectByName('CutCard').position.x<full.min.x,'reached cut card rests beside the pack');
  update(null);assert.equal(root.visible,false);
});
