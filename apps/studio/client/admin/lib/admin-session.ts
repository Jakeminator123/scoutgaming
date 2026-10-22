import {StudioAdminUiError} from '../../../components/studio-administration';

/** Fresh N1 session for the native admin client: the same read NativeAdministration performs before every write. */
export async function readAdminSession(signal?:AbortSignal):Promise<Record<string,unknown>> {
  const response=await fetch('/studio/api/auth/session',{credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw new StudioAdminUiError(response.status);
  return response.json();
}
