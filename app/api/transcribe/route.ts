import { NextRequest, NextResponse } from 'next/server';
import { v2 } from '@google-cloud/speech';

// Cloud docs recommend the v2 API for new code. @google-cloud/speech ships
// both — the default `SpeechClient` export is the v1 client, so we have to
// reach into the v2 namespace explicitly.
//
// v2 differs from v1 in three relevant ways for inline-config sync recognize:
//   1. The request is keyed by a recognizer resource path. The reserved
//      recognizer name "_" means "use inline config without pre-creating
//      a Recognizer" — exactly our use case.
//   2. config shape: autoDecodingConfig instead of explicit
//      encoding/sampleRateHertz; languageCodes is an array; features
//      live under .features.
//   3. Audio bytes are top-level (`content`) instead of `audio.content`.
type SpeechClient = InstanceType<typeof v2.SpeechClient>;

// Lazy init so the build/lint passes on machines without ADC and only fails
// loudly at request time if GOOGLE_CLOUD_PROJECT is missing in Cloud Run.
let _client: SpeechClient | null = null;
function client(): SpeechClient {
  if (_client) return _client;
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set — Speech API client cannot be initialised.');
  }
  _client = new v2.SpeechClient();
  return _client;
}

function recognizerPath(): string {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  // The `_` recognizer is a reserved name meaning "no pre-created
  // Recognizer — use the inline config from this request".
  return `projects/${project}/locations/global/recognizers/_`;
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

    // autoDecodingConfig lets the server infer the codec from the audio
    // container header, so we don't have to negotiate encoding /
    // sampleRateHertz from the client (MediaRecorder defaults vary by
    // browser).
    const [response] = await client().recognize({
      recognizer: recognizerPath(),
      config: {
        autoDecodingConfig: {},
        languageCodes: ['en-US'],
        model: 'latest_short',
        features: { enableAutomaticPunctuation: true },
      },
      content: audioBuf,
    });

    const transcript = (response.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || '')
      .filter((t): t is string => !!t)
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
