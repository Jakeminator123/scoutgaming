'use client';
import { useCallback } from 'react';
import { StudioAdministration, StudioAdminUiError, type StudioAdminApiBase } from './studio-administration';

export function NativeAdministration({ apiBase, availableActions }: {apiBase: StudioAdminApiBase; availableActions: string[]}) {
  const session = useCallback(async () => {
    const response = await fetch(`${apiBase.replace(/\/admin$/, '/auth')}/session`, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new StudioAdminUiError(response.status);
    return response.json();
  }, [apiBase]);
  return <StudioAdministration apiBase={apiBase} session={session} availableActions={availableActions} />;
}
