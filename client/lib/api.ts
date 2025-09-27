export const API_BASE = import.meta.env.VITE_API_BASE || 'http://74.242.217.219';

export async function apiFetch(path: string, opts?: RequestInit) {
  const base = (API_BASE || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = path.startsWith('http') ? path : `${base}${normalizedPath}`;

  // If the page is served over HTTPS but the API base is HTTP, avoid mixed-content by using the proxy first
  const isBrowser = typeof window !== 'undefined' && !!(window.location);
  const isMixedContentRisk = isBrowser && window.location.protocol === 'https:' && base.startsWith('http://');
  const serverProxyPath = `/ubs-proxy?path=${encodeURIComponent(normalizedPath)}`;
  const publicProxyBase = 'https://thingproxy.freeboard.io/fetch/';

  const attempts: { url: string; err?: any }[] = [];

  const tryFetch = async (fetchUrl: string, options?: RequestInit) => {
    try {
      const res = await fetch(fetchUrl as any, options);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`API request failed (${res.status})`);
        (err as any).status = res.status;
        (err as any).body = text;
        throw err;
      }
      return res;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      (err as any).url = fetchUrl;
      throw err;
    }
  };

  // Build ordered list of candidate URLs depending on mixed content risk
  const candidates: string[] = [];
  if (isMixedContentRisk) {
    // prefer server proxy, then public proxy, then direct (may still be blocked)
    candidates.push(serverProxyPath);
    candidates.push(publicProxyBase + encodeURIComponent(url));
    candidates.push(url);
  } else {
    // normal env: try direct, then server proxy, then public proxy
    candidates.push(url);
    candidates.push(serverProxyPath);
    candidates.push(publicProxyBase + encodeURIComponent(url));
  }

  // Try each candidate in order and collect errors
  let lastErr: any = null;
  for (const candidate of candidates) {
    try {
      // For public proxy, if original method is not GET, we must adjust: public proxy typically only supports GET reliably
      if (candidate.startsWith(publicProxyBase) && opts && opts.method && opts.method !== 'GET' && opts.method !== 'HEAD') {
        // skip public proxy for non-GET/HEAD methods
        attempts.push({ url: candidate, err: 'skipped (method not supported by public proxy)' });
        continue;
      }

      const res = await tryFetch(candidate, opts);
      // success: return
      return res;
    } catch (e: any) {
      attempts.push({ url: candidate, err: e });
      lastErr = e;
      // try next
    }
  }

  // All attempts failed: throw detailed error
  const err = new Error('All API fetch attempts failed');
  (err as any).attempts = attempts.map((a) => ({ url: a.url, error: a.err && (a.err.message || String(a.err)) }));
  (err as any).last = lastErr && (lastErr.message || String(lastErr));
  try {
    console.error('apiFetch failed attempts:', JSON.stringify((err as any).attempts, null, 2));
  } catch (e) {
    console.error('apiFetch failed attempts (could not stringify)');
  }
  throw err;
}

export const apiGet = async (path: string) => {
  const res = await apiFetch(path, { method: 'GET' });
  return res.json();
};

export const apiPost = async (path: string, body?: any) => {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

export type ExtractLabelsTask = {
  task_id?: string;
  task_type?: string;
  task_name?: string;
  min_turns?: number;
  max_turns?: number;
  parameters?: Record<string, any> | null;
};

export type ExtractLabelsStandardResponse = {
  assigned_tasks?: ExtractLabelsTask[];
  topic_and_outcome?: {
    topic?: string;
    outcome?: string;
  } | null;
  [key: string]: any;
};

export type ExtractLabelsResponse = ExtractLabelsStandardResponse | ExtractLabelsTask[] | null;

export const extractLabels = async (transcript: string) =>
  apiPost('/extract_labels', { transcript }) as Promise<ExtractLabelsResponse>;

export const listTranscripts = async () => apiGet('/list_transcripts') as Promise<{ transcripts: string[] }>;

export const getTranscript = async (filename: string) => apiGet(`/get_transcript/${encodeURIComponent(filename)}`) as Promise<{ transcript: string }>;
