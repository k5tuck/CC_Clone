
// // src/lib/providers/OllamaProvider.ts
// import {
//   Message,
//   StreamEvent,
//   StreamOptions,
//   ModelInfo,
//   ProviderConfig,
//   ProviderError,
//   ModelNotFoundError,
// } from './types';
// import { AbstractBaseProvider } from './BaseProvider'

// interface OllamaResponse {
//   model: string;
//   created_at: string;
//   response?: string;
//   done: boolean;
//   message?: {
//     role: string;
//     content: string;
//   };
// }

// export class OllamaProvider extends AbstractBaseProvider {
//   readonly name = 'Ollama';
//   models: string[] = [];
  
//   private endpoint: string;
  
//   constructor(config: ProviderConfig) {
//     super(config);
//     this.endpoint = config.endpoint || 'http://localhost:11434';
//   }
  
//   async *stream(
//     messages: Message[],
//     options?: StreamOptions
//   ): AsyncIterableIterator<StreamEvent> {
//     try {
//       const response = await fetch(`${this.endpoint}/api/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           model: this.currentModel,
//           messages: messages.map(m => ({
//             role: m.role,
//             content: m.content,
//           })),
//           stream: true,
//           options: {
//             temperature: options?.temperature,
//             top_p: options?.topP,
//             stop: options?.stopSequences,
//             num_predict: options?.maxTokens,
//           },
//         }),
//       });
      
//       if (!response.ok) {
//         throw new ProviderError(
//           `HTTP ${response.status}: ${response.statusText}`,
//           this.name
//         );
//       }
      
//       if (!response.body) {
//         throw new ProviderError('No response body', this.name);
//       }
      
//       const reader = response.body.getReader();
//       const decoder = new TextDecoder();
//       let buffer = '';
      
//       while (true) {
//         const { done, value } = await reader.read();
        
//         if (done) break;
        
//         buffer += decoder.decode()
//       }
//     }
//     catch (error) {
//           this.handleError(error, 'streamError');
//         }
//     }
// }