export interface OllamaModel {
  id: string;
  label: string;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  images?: string[];
  signal?: AbortSignal;
}

export interface GenerateChunk {
  response: string;
  done: boolean;
}

export class OllamaClient {
  constructor(private baseUrl: string) {}

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  async generate(req: GenerateRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        images: req.images ?? [],
        stream: false,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      throw new Error(
        `Ollama request failed: ${res.status} ${res.statusText}`
      );
    }

    const data = (await res.json()) as { response: string };
    return data.response ?? "";
  }

  async *streamGenerate(req: GenerateRequest): AsyncGenerator<GenerateChunk> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        images: req.images ?? [],
        stream: true,
      }),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(
        `Ollama request failed: ${res.status} ${res.statusText}`
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) {
            continue;
          }
          try {
            const parsed = JSON.parse(line) as GenerateChunk;
            yield { response: parsed.response ?? "", done: !!parsed.done };
          } catch {
            // ignore malformed line
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
