import {registerHooks} from 'node:module';
const server=new URL('../../web/server.mjs',import.meta.url).href;
const fixture=new URL('./published-chat-authority.mjs',import.meta.url).href;
// No production feature flag or import is changed. Only this explicitly started
// test child replaces the server's context factory; every other import is real.
registerHooks({resolve(specifier,context,nextResolve){
  if(context.parentURL===server&&specifier==='./registered-chat-context.mjs')return {url:fixture,shortCircuit:true};
  return nextResolve(specifier,context);
}});