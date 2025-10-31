// src/lib/streaming/StreamingClient.ts

/** Message structure used for chat interactions */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Streaming event types emitted by the client */
export type StreamEvent =
  | { type: 'token'; data: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; tool: string; result: any }
  | { type: 'error'; error: Error }
  | { type: 'done'; final: string };

/** Optional configuration for streaming requests */
export interface StreamOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/** Core streaming client used for sending messages to an LLM API */
export class StreamingClient {
  constructor(
    private endpoint: string,
    private model: string
  ) {}

  /**
   * Streams chat responses token-by-token
   */
  async *stream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<StreamEvent> {
    try {
      const url = `${this.endpoint}/api/chat`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature ?? 0.7,
            top_p: options.topP ?? 0.9,
            num_predict: options.maxTokens ?? -1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const result = await reader.read();
        if (result.done) break;

        const chunk = decoder.decode(result.value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.message?.content) {
              yield { type: 'token', data: data.message.content };
            }

            if (data.done) {
              yield { type: 'done', final: data.message?.content ?? '' };
            }
          } catch {
            // silently skip malformed chunks
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Health check for the API endpoint
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const url = `${this.endpoint}/api/tags`;
      const response = await fetch(url);

      if (!response.ok) {
        return { healthy: false, error: `HTTP error: ${response.status}` };
      }

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
