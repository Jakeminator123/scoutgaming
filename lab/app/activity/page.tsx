import { redirectToPublicControl } from '../control/public-redirect';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await redirectToPublicControl('/control/activity');
}
