import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

// We tried the @google-cloud/speech SDK (both v1 and v2 clients). Both
// failed at runtime with the gax-wrapped grpc-js error
// "Error: undefined undefined: undefined" — empty code/details/metadata
// from "Exception occurred in retry method that was not classified as
// transient". The auth path is fine (Vertex AI calls work from the
// same SA), but something between gax + grpc-js + the v2 endpoint was
// swallowing the underlying status before it reached us.
//
// REST instead of gRPC sidesteps the whole problem. We can read the
// actual HTTP status and JSON error body, and the request shape is
// exactly what the docs publish, no SDK overload guessing.

let _auth: GoogleAuth | null = null;
function auth(): GoogleAuth {
  if (!_auth) _auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  return _auth;
}

async function bearerToken(): Promise<string> {
  const c = await auth().getClient();
  const t = await c.getAccessToken();
  if (!t.token) throw new Error('No access token returned for runtime service account');
  return t.token;
}

// POST /api/transcribe — body is raw audio (audio/webm;codecs=opus from
// Chromium MediaRecorder; audio/ogg;codecs=opus from Firefox). Returns
// { transcript: string }.
//
// Calls the Cloud Speech-to-Text v2 REST endpoint with the reserved "_"
// recognizer (inline config, no pre-created Recognizer resource).
// autoDecodingConfig lets the server infer the codec from the container
// header, so we don't have to know which browser the customer is using.
export async function POST(req: NextRequest) {
  try {
    const audioBuf = Buffer.from(await req.arrayBuffer());
    if (audioBuf.length === 0) {
      return NextResponse.json({ error: 'Empty audio body' }, { status: 400 });
    }
    if (audioBuf.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio too large (>10 MB)' }, { status: 413 });
    }

    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) {
      return NextResponse.json({ error: 'GOOGLE_CLOUD_PROJECT not set' }, { status: 500 });
    }

    const token = await bearerToken();
    const url = `https://speech.googleapis.com/v2/projects/${project}/locations/global/recognizers/_:recognize`;
    const body = {
      config: {
        autoDecodingConfig: {},
        languageCodes: ['en-US'],
        model: 'latest_short',
        features: { enableAutomaticPunctuation: true },
      },
      content: audioBuf.toString('base64'),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': project,
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error('Speech v2 REST failed', { status: res.status, body: responseText.slice(0, 800) });
      let errMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(responseText);
        errMsg = parsed?.error?.message || errMsg;
      } catch { /* keep HTTP fallback */ }
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const data = JSON.parse(responseText) as {
      results?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
    const transcript = (data.results || [])
      .map((r) => r.alternatives?.[0]?.transcript || '')
      .filter((t) => !!t)
      .join(' ')
      .trim();

    return NextResponse.json({ transcript });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Transcribe failed:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
