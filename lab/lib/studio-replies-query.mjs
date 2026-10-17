import {isDealerId} from '../../packages/presentation/contracts/dealer-identity.mjs';
import {validateReplyCategories} from '../../packages/presentation/contracts/speech-reply-library.mjs';

const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=()=>{throw Object.assign(new Error('studio_replies_invalid_request'),{code:'studio_replies_invalid_request',statusCode:400});};
export const isReplyCursor=value=>typeof value==='string'&&value.length>0&&value.length<=2048&&!/[\u0000-\u001f\u007f]/.test(value);

// Shared by transport normalization and the N1 handler. A query exception is
// limited to these exact read routes; other native APIs retain their old guard.
export function parseStudioRepliesRequest(method,url) {
  const match=/^\/(?:studio\/)?api\/replies(?:\/([^/]+)(?:\/(audio|video))?)?$/.exec(url.pathname);
  if(!match||url.hash||match[1]&&!idPattern.test(match[1]))fail();
  const [,id,mediaKind]=match;
  if(method==='PATCH'){
    if(!id||mediaKind||url.search)fail();
    return {kind:'categorize',id};
  }
  if(method!=='GET'&&!(method==='HEAD'&&mediaKind))fail();
  const keys=[...url.searchParams.keys()],allowed=id?['dealer']:['dealer','category','cursor'];
  if(new Set(keys).size!==keys.length||keys.some(key=>!allowed.includes(key)))fail();
  const dealerId=url.searchParams.get('dealer');
  if(!isDealerId(dealerId))fail();
  if(id)return {kind:mediaKind?'media':'item',id,dealerId,...(mediaKind?{mediaKind}:{})};
  const category=url.searchParams.get('category'),cursor=url.searchParams.get('cursor');
  if(category!==null)validateReplyCategories([category]);
  if(cursor!==null&&!isReplyCursor(cursor))fail();
  return {kind:'list',dealerId,...(category!==null?{category}:{}),...(cursor!==null?{cursor}:{})};
}

export function isStudioRepliesReadQuery(method,url) {
  if(!['GET','HEAD'].includes(method))return false;
  try {return parseStudioRepliesRequest(method,url).kind!=='categorize';}catch{return false;}
}
