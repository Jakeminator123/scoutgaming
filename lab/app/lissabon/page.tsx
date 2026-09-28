import { redirect } from 'next/navigation';
import { labUrl } from "../../lib/lab-url.mjs";
export default function Page() { redirect(labUrl('/')); }
