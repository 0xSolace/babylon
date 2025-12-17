declare module 'swagger-jsdoc' {
  interface Options {
    definition: {
      openapi: string;
      info: {
        title: string;
        version: string;
        description?: string;
      };
      servers?: Array<{
        url: string;
        description?: string;
      }>;
      components?: {
        securitySchemes?: Record<string, unknown>;
        schemas?: Record<string, unknown>;
      };
      security?: Array<Record<string, unknown[]>>;
    };
    apis: string[];
  }

  function swaggerJsdoc(options: Options): object;

  export = swaggerJsdoc;
}


