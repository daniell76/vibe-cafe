import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/lib/firestore';

// Returns the source-of-truth default settings (the code constants).
// Used by the Admin "Restore default" buttons so we don't duplicate the
// default strings in client code.
export async function GET() {
  return NextResponse.json(DEFAULT_SETTINGS);
}
