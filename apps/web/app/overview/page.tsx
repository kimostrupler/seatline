import { redirect } from 'next/navigation';

/** The Overview page became part of Home (its numbers are Home's widgets). Old links land there. */
export default function Overview() {
  redirect('/');
}
