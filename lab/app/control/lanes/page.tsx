import { ControlLanesPage, type LaneOperatorChoice } from '@/components/control-lanes-page';
import { fixtureLaneOperators } from '@/lib/operator-package-api.mjs';
import { nativeStudioAdminEnabled, studioNativeRuntime } from '@/lib/studio-native-runtime.mjs';
import { loadControlStudio } from '../../control-studio-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lanes · Croupier Studio' };

export default async function Page() {
  const data = await loadControlStudio('/control/lanes');
  let operators: LaneOperatorChoice[] = fixtureLaneOperators();
  let storeAvailable = false;
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
  }
  return <ControlLanesPage initialProject={data.project} initialVideos={data.videos} initialStatus={data.status} operators={operators} storeAvailable={storeAvailable} />;
}
