// Type declarations for swagger-ui-react
declare module 'swagger-ui-react' {
  import type { ComponentType } from 'react';

  // swagger-ui uses its own internal Request/Response types, not DOM types
  interface SwaggerRequest {
    url: string;
    method: string;
    body?: string | FormData;
    headers?: Record<string, string>;
    credentials?: 'omit' | 'same-origin' | 'include';
    [key: string]: string | FormData | Record<string, string> | undefined;
  }

  interface SwaggerResponse {
    ok: boolean;
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    text: string;
    data: string;
    body?: Record<string, unknown>;
    obj?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface SwaggerUIProps {
    spec?: object;
    url?: string;
    deepLinking?: boolean;
    displayOperationId?: boolean;
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    docExpansion?: 'list' | 'full' | 'none';
    filter?: boolean | string;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    tryItOutEnabled?: boolean;
    persistAuthorization?: boolean;
    displayRequestDuration?: boolean;
    showMutatedRequest?: boolean;
    requestInterceptor?: (request: SwaggerRequest) => SwaggerRequest | Promise<SwaggerRequest>;
    responseInterceptor?: (response: SwaggerResponse) => SwaggerResponse | Promise<SwaggerResponse>;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

// Type declarations for MDX
declare module 'mdx/types' {
  export type MDXComponents = Record<string, unknown>;
}

// Type declarations for SVG imports
declare module '*.svg' {
  const content: string;
  export default content;
}
