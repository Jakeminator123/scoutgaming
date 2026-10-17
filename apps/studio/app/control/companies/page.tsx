import { renderOperatorPage } from '../operator-page';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bolag & team · Croupier Studio' };
export default async function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return renderOperatorPage(props, 'companies');
}
