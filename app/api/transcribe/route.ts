import { NextRequest, NextResponse } from 'next/server';
import speech from '@google-cloud/speech';

// @google-cloud/speech v7's default export `SpeechClient` is the v2 API,
// which uses a different request shape ({ recognizer, config, content })
// than the v1 shape we send below ({ audio, config }). Pin to v1
// explicitly so the inline-config recognize call we make matches.
type SpeechClient = InstanceType<typeof speech.v1.SpeechClient>;

// Lazy init — same pattern as lib/vertex-ai.ts. Lets the build run on
// machines without ADC and fails loudly at request time if GOOGLE_CLOUD_PROJECT
// isn't set in the Cloud Run env.
let _client: SpeechClient | null = null;
function client(): SpeechClient {
  if (_client) return _client;
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set — Speech API client cannot be initialised.');
  }
  _client = new speech.v1.SpeechClient();
  return _client;
}

// POST /api/transcribe — body is the raw audio (Content-Type set by the
// browser's MediaRecorder, usually audio/webm;codecs=opus on Chromium).
// Returns { transcript: string }.
//
// We use sync recognize because the AI Inspiration prompt is short (a few
// seconds of speech). Sync requests are capped at 60 s of audio by the API,
// which is more than enough for this use case.
export async function POST(req: NextRequest) {
  try {
    const audioBuf = Buffer.from(await req.arrayBuffer());
    if (audioBuf.length === 0) {
      return NextResponse.json({ error: 'Empty audio body' }, { status: 400 });
    }
    if (audioBuf.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio too large (>10 MB)' }, { status: 413 });
    }

    // The browser's MediaRecorder default is WebM-encapsulated Opus.
    // The Speech API auto-detects encoding when we pass WEBM_OPUS, so we
    // don't have to negotiate the sample rate on the client.
    const [response] = await client().recognize({
      audio: { content: audioBuf.toString('base64') },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_short',
      },
    });

    const transcript = (response.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || '')
      .filter(Boolean)
      .join(' ')
      .trim();

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    // grpc-js errors stringify as "undefined undefined: undefined" when status
    // metadata is missing (typically auth failures). Log the structured fields
    // so we get something actionable in Cloud Run logs next time.
    const e = error as { code?: number | string; details?: string; message?: string };
    console.error('Transcribe failed:', { code: e?.code, details: e?.details, message: e?.message }, error);
    const msg = e?.details || e?.message || 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
