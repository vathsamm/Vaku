export async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netErr: any) {
    throw new Error(`Network error connecting to ${url}: ${netErr?.message || 'Connection failed'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error || data?.message || `Request failed with HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    return data as T;
  }

  const rawText = await res.text();
  if (!res.ok) {
    if (res.status === 504 || rawText.includes('504') || rawText.toLowerCase().includes('gateway timeout')) {
      throw new Error("Request timed out on the gateway. The process is continuing in the background.");
    }
    if (res.status === 502 || rawText.includes('502') || rawText.toLowerCase().includes('bad gateway')) {
      throw new Error("Temporary service gateway connection issue. Please retry in a moment.");
    }
    const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(`Server returned HTTP ${res.status}: ${cleanSnippet || 'Unexpected response'}`);
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`Invalid response format from server: expected JSON but received ${contentType || 'text'}`);
  }
}
