// import fetch from 'node-fetch';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type StreamEvent = 
  | { type: 'token'; data: string }
  | { type: 'tool_call'; tool: string; args: any }
  | { type: 'tool_result'; tool: string; result: any }
  | { type: 'error'; error: Error }
  | { type: 'done'; final: string };

export interface StreamOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export class StreamingClient {
  constructor(
    private endpoint: string,
    private model: string
  ) {}

  async *stream(
    messages: Message[],
    options: StreamOptions = {}
  ): AsyncGenerator<StreamEvent> {
    try {
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            
            // Yield token
            if (data.message?.content) {
              yield { 
                type: 'token', 
                data: data.message.content 
              };
            }

            // Check for completion
            if (data.done) {
              yield { 
                type: 'done', 
                final: data.message?.content || '' 
              };
            }
          } catch (parseError) {
            console.warn('Failed to parse line:', line, parseError);
          }
        }
      }
    } catch (error) {
      yield { 
        type: 'error', 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return { 
          healthy: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }

      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}