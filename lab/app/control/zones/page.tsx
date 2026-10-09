import { redirectToPublicControl } from '../public-redirect';

export const dynamic = 'force-dynamic';

// Backgrounds are now selected alongside dealer and table in the composition.
export default async function Page() {
  await redirectToPublicControl('/control/preview');
}
