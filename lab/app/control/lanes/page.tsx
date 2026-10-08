import { ControlLanesPage, type LaneOperatorChoice } from '@/components/control-lanes-page';
import type { OperatorDirectory } from '@/components/control-operator-directory';
import { STANDARD_OPERATOR_ROLES } from '@/lib/operator-admin-api.mjs';
import { fixtureLaneOperators } from '@/lib/operator-package-api.mjs';
import { nativeStudioAdminEnabled, studioNativeRuntime } from '@/lib/studio-native-runtime.mjs';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lanes · Croupier Studio' };

export default async function Page() {
  const data = await loadControlStudio('/control/lanes');
  let operators: LaneOperatorChoice[] = fixtureLaneOperators();
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
      operators = fixtureLaneOperators();
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
  return <ControlLanesPage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} operators={operators} storeAvailable={storeAvailable} directory={directory} />;
}
