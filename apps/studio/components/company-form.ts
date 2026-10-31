import {useEffect,useRef,type RefObject} from 'react';
import type {OperatorDirectoryEntry} from '../lib/studio-native-runtime.mjs';

export type CompanyIdentity = Pick<OperatorDirectoryEntry,'id'|'slug'|'name'|'status'>;
export type StandardOperatorRole = {id:string;label:string;permissions:string[]};
const identifier = (value:unknown):value is string => typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
export function isCompanyIdentity(value:unknown):value is CompanyIdentity {
  const item=value as CompanyIdentity|undefined;
  return Boolean(item&&identifier(item.id)&&identifier(item.slug)&&typeof item.name==='string'&&item.name.trim()&&['active','suspended'].includes(item.status));
}
export function isStandardRole(value:unknown):value is StandardOperatorRole {
  const role=value as StandardOperatorRole|undefined;
  return Boolean(role&&identifier(role.id)&&typeof role.label==='string'&&Array.isArray(role.permissions)&&role.permissions.every(item=>typeof item==='string'));
}
export function isCompanyTeam(value:unknown):value is OperatorDirectoryEntry {
  const item=value as OperatorDirectoryEntry|undefined;
  return Boolean(isCompanyIdentity(item)&&Array.isArray(item.roles)&&item.roles.every(isStandardRole)
    &&Array.isArray(item.missingRoles)&&item.missingRoles.every(identifier)&&Array.isArray(item.members)
    &&item.members.every(member=>member&&identifier(member.userId)&&identifier(member.roleId)&&Number.isSafeInteger(member.revision)&&member.revision>0
      &&['active','suspended','invited'].includes(member.status)&&(member.username===null||typeof member.username==='string')));
}
export function suggestOperatorSlug(name:string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,63).replace(/-+$/g,'');
}
export function operatorMemberInput(contact:string) {
  const value=contact.trim();
  return value.includes('@')?{email:value,status:'invited'}:{username:value,status:'active'};
}
export function companyFailure(kind:'create'|'member'|'role',status:number) {
  if(status===401||status===403)return 'Åtkomst nekad. Logga in som intern administratör på den här adressen.';
  if(status===503)return 'Ingen skrivbar Neon-pool. Ingenting sparades.';
  if(kind==='create'&&status===409)return 'Det finns redan ett bolag med den sluggen.';
  if(kind==='create'&&status===422)return 'Ogiltigt adressnamn eller bolagsnamn. Använd små bokstäver, siffror och bindestreck i adressnamnet.';
  if(kind==='member'&&status===409)return 'Ingenting sparades: kontot är redan medlem, någon annan ändrade medlemskapet, eller ändringen skulle ta bort sista administratören. Läs in teamet igen.';
  if(kind==='member'&&status===422)return 'Kontot finns inte som partnerkonto, eller rollen saknas hos bolaget.';
  if(kind==='member'&&status===429)return 'För många inbjudningar den här timmen. Ingenting sparades.';
  if(status===404)return 'Bolaget finns inte längre.';
  if(kind==='role'&&status===409)return 'Rolländringen skulle ta bort sista administratören. Läs in teamet igen.';
  return 'Ändringen kunde inte bekräftas. Läs in aktuella uppgifter innan du försöker igen.';
}

// Company-to-company navigation retains Team's draft map. Leaving that mounted view
// requires confirmation; writes block navigation synchronously, before React renders.
export function useCompanyFormGuard(dirty:boolean,pending:RefObject<boolean>,retainTeam=false) {
  const latest=useRef({dirty,retainTeam});latest.current={dirty,retainTeam};
  useEffect(()=>{
    const unload=(event:BeforeUnloadEvent)=>{if(latest.current.dirty||pending.current){event.preventDefault();event.returnValue='';}};
    const leave=(event:Event)=>{
      const href=(event as CustomEvent<{href:string}>).detail?.href;
      const next=href?new URL(href,window.location.href):null;
      const retained=latest.current.retainTeam&&next?.origin===window.location.origin&&/^\/(?:studio\/)?admin\/companies\/[^/]+$/.test(next.pathname);
      if(pending.current||(latest.current.dirty&&!retained&&!window.confirm('Lämna osparade bolagsuppgifter?')))event.preventDefault();
    };
    window.addEventListener('beforeunload',unload);window.addEventListener('scout:navigate',leave);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('scout:navigate',leave);};
  },[pending]);
  return ()=>{latest.current.dirty=false;};
}
