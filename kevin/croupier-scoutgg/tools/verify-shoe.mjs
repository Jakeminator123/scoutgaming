import {readFileSync} from 'node:fs';
import {verifyShoe} from '../vendor/croupier/shoe-proof.mjs';
const [file,openingCommitment]=process.argv.slice(2);
if(!file){console.error('Usage: node tools/verify-shoe.mjs bundle.json [previously-saved-opening-commitment]');process.exit(2);}
const bundle=JSON.parse(readFileSync(file,'utf8'));
const result=verifyShoe(bundle.proof??bundle,openingCommitment??bundle.shoe?.commitment??bundle.commitment);
console.log(JSON.stringify({...result,externalOpeningCommitmentProvided:Boolean(openingCommitment)},null,2));
process.exitCode=result.status==='verified'?0:1;
