import { firstQueryValue } from '@/components/studio-types';
import { ControlLanesPage, type LaneOperatorChoice } from '@/components/control-lanes-page';
import type { OperatorDirectory } from '@/components/control-operator-directory';
import { STANDARD_OPERATOR_ROLES } from '@/lib/operator-admin-api.mjs';

import { nativeStudioAdminEnabled, studioNativeRuntime } from '@/lib/studio-native-runtime.mjs';
import { loadControlStudio } from '../control-studio-data';


export async function renderOperatorPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }, mode: 'companies' | 'publish') {
  const query = props?.searchParams ? await props.searchParams : {};
  const returnQuery = new URLSearchParams();
  for (const key of ['composition', 'operator', 'dealer', 'table']) {
    const value = firstQueryValue(query[key]);
    if (value) returnQuery.set(key, value);
  }
  const data = await loadControlStudio((mode === 'companies' ? '/control/companies' : '/control/rooms') + (returnQuery.size ? '?' + returnQuery : ''));
  let operators: LaneOperatorChoice[] = [];
  let storeAvailable = false;
  let directory: OperatorDirectory | null = null;
  if (nativeStudioAdminEnabled()) {
    try {
      const native = await studioNativeRuntime();
      if (typeof native.listLaneOperators === 'function') {
        operators = await native.listLaneOperators();
        storeAvailable = true;
      }
    } catch {
      operators = [];
      storeAvailable = false;
    }
    // A directory read failure only hides Bolag; publishing stays as it was.
    if (storeAvailable) {
      try {
        const native = await studioNativeRuntime();
        if (typeof native.listOperatorDirectory === 'function') {
          directory = {
            operators: await native.listOperatorDirectory(),
            standardRoles: STANDARD_OPERATOR_ROLES.map(role => ({ id: role.id, label: role.label, permissions: [...role.permissions] })),
          };
        }
      } catch {
        directory = null;
      }
    }
  }
  return <ControlLanesPage initialTab={mode} initialLaneId={firstQueryValue(query.composition ?? query.lane)} initialOperatorId={firstQueryValue(query.operator)} initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} operators={operators} storeAvailable={storeAvailable} directory={directory} />;
}
