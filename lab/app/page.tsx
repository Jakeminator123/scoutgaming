import { StudioPage } from './studio-page';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.CROUPIER_STREAM_LANE === 'lissabon-stream-lane') redirect('/lissabon');
  return <StudioPage />;
}
