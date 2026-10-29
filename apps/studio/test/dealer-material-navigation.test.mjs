import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyStudioDocumentHref } from '../lib/legacy-studio-document.mjs';
import { studioLoginDestination } from '../lib/studio-login-client.mjs';

test('legacy material URL redirects safe dealer and room context into the existing workspace',()=>{
  const destination=query=>legacyStudioDocumentHref(new Request('https://qa.invalid/control/dealer-forge?'+query));
  const target=destination('dealerId=paow&dealerId=astrid&lane=scene-a&operator=north&table=room-7&token=private&view=settings');
  const url=new URL(target,'https://qa.invalid');
  assert.equal(url.pathname,'/admin/dealers/paow','material generation opens on the dealer nav');
  assert.deepEqual(Object.fromEntries(url.searchParams),{flik:'klipp',panel:'generera',composition:'scene-a',operator:'north',table:'room-7'});
  assert.equal(studioLoginDestination(target,'/studio/api/auth'),target);
  assert.equal(destination('dealer=https://other.invalid&operator=bad/value&table=room-7'),'/admin/dealers?table=room-7','an unsafe dealer never becomes a dealer nav');
});
