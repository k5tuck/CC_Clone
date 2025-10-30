import axios, { AxiosError } from 'axios';
import { Agent } from '../agent';
import { Tool } from '../llm/ollama-client';

/**
 * Custom exceptions for HTTP operations
 */
export class HTTPRequestError extends Error {
  constructor(
    public readonly url: string,
    public readonly method: string,
    public readonly statusCode: number,
    public readonly response: any
  ) {
    super(`HTTP ${method} request to ${url} failed with status ${statusCode}`);
    this.name = 'HTTPRequestError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class HTTPTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number
  ) {
    super(`HTTP request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'HTTPTimeoutError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Register HTTP/API tools with an agent
 */
export function registerHTTPTools(agent: Agent): void {
  
  // HTTP GET Tool
  agent.registerTool(
    'httpGet',
    async ({ url, headers = {}, timeout = 30000 }: any) => {
      if (!url || typeof url !== 'string') {
        throw new Error('url parameter is required');
      }

      try {
        const response = await axios.get(url, {
          headers,
          timeout,
          validateStatus: () => true, // Don't throw on any status
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          url,
        };
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          throw new HTTPTimeoutError(url, timeout);
        }
        throw new HTTPRequestError(
          url,
          'GET',
          error.response?.status || 0,
          error.response?.data
        );
      }
    },
    {
      name: 'httpGet',
      description: 'Make an HTTP GET request',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request',
          },
          headers: {
            type: 'object',
            description: 'Request headers (optional)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
        },
        required: ['url'],
      },
    }
  );

  // HTTP POST Tool
  agent.registerTool(
    'httpPost',
    async ({ url, data, headers = {}, timeout = 30000 }: any) => {
      if (!url || typeof url !== 'string') {
        throw new Error('url parameter is required');
      }

      try {
        const response = await axios.post(url, data, {
          headers,
          timeout,
          validateStatus: () => true,
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          url,
        };
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          throw new HTTPTimeoutError(url, timeout);
        }
        throw new HTTPRequestError(
          url,
          'POST',
          error.response?.status || 0,
          error.response?.data
        );
      }
    },
    {
      name: 'httpPost',
      description: 'Make an HTTP POST request',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request',
          },
          data: {
            type: 'object',
            description: 'Request body data',
          },
          headers: {
            type: 'object',
            description: 'Request headers (optional)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
        },
        required: ['url'],
      },
    }
  );

  // HTTP PUT Tool
  agent.registerTool(
    'httpPut',
    async ({ url, data, headers = {}, timeout = 30000 }: any) => {
      if (!url || typeof url !== 'string') {
        throw new Error('url parameter is required');
      }

      try {
        const response = await axios.put(url, data, {
          headers,
          timeout,
          validateStatus: () => true,
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          url,
        };
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          throw new HTTPTimeoutError(url, timeout);
        }
        throw new HTTPRequestError(
          url,
          'PUT',
          error.response?.status || 0,
          error.response?.data
        );
      }
    },
    {
      name: 'httpPut',
      description: 'Make an HTTP PUT request',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request',
          },
          data: {
            type: 'object',
            description: 'Request body data',
          },
          headers: {
            type: 'object',
            description: 'Request headers (optional)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
        },
        required: ['url'],
      },
    }
  );

  // HTTP DELETE Tool
  agent.registerTool(
    'httpDelete',
    async ({ url, headers = {}, timeout = 30000 }: any) => {
      if (!url || typeof url !== 'string') {
        throw new Error('url parameter is required');
      }

      try {
        const response = await axios.delete(url, {
          headers,
          timeout,
          validateStatus: () => true,
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data,
          url,
        };
      } catch (error: any) {
        if (error.code === 'ECONNABORTED') {
          throw new HTTPTimeoutError(url, timeout);
        }
        throw new HTTPRequestError(
          url,
          'DELETE',
          error.response?.status || 0,
          error.response?.data
        );
      }
    },
    {
      name: 'httpDelete',
      description: 'Make an HTTP DELETE request',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to request',
          },
          headers: {
            type: 'object',
            description: 'Request headers (optional)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 30000)',
          },
        },
        required: ['url'],
      },
    }
  );
}
