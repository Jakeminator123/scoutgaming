import { StudioPage } from '../../studio-page';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operatörschatt · Croupier Studio' };

export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <StudioPage view="openclaw" searchParams={props?.searchParams} />; }
