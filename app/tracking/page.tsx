import { redirect } from 'next/navigation';

// Multi-screen tracking lives at /tracking/<n>. The bare /tracking link in
// NavBar lands the user on screen 1 by default.
export default function TrackingIndex(): never {
  redirect('/tracking/1');
}
