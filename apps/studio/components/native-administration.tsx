'use client';
import { useCallback, useMemo } from 'react';
import { StudioAdministration, StudioAdminUiError, createStudioAdminClient, type StudioAdminApiBase, type SharedStudioAdminRead } from './studio-administration';
import styles from './studio-administration.module.css';
import { MovingDriftControls } from './moving-drift-controls';

// Logging out belongs to the Admin menu, not to each embedded page.
export function NativeAdministration({ apiBase, availableActions, gameOrigin, initialGroup, embedded = false, sections, sharedRead }: {apiBase: StudioAdminApiBase; availableActions: string[]; gameOrigin?: string; initialGroup?: string; embedded?: boolean; sections?: readonly string[]; sharedRead?: SharedStudioAdminRead }) {
  const session = useCallback(async () => {
    const response = await fetch(`${apiBase.replace(/\/admin$/, '/auth')}/session`, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new StudioAdminUiError(response.status);
    return response.json();
  }, [apiBase]);
  const driftClient=useMemo(()=>createStudioAdminClient({apiBase,session,availableActions,gameOrigin,readIdentity:'response-headers-v1'}),[apiBase,session,availableActions,gameOrigin]);
  const Wrapper = embedded ? 'div' : 'main';
  return <Wrapper className={embedded ? styles.embedded : styles.shell}>
    <StudioAdministration apiBase={apiBase} session={session} availableActions={availableActions} gameOrigin={gameOrigin} initialGroup={initialGroup} readIdentity="response-headers-v1"
      sections={sections} sharedRead={sharedRead} companyTeamLabel={embedded ? 'Bolag & team' : undefined}
      renderOperations={actor=><MovingDriftControls client={driftClient} expectedActor={actor}/>} showGroupNavigation={!embedded} /></Wrapper>;
}
