/**
 * Swagger/OpenAPI Configuration
 *
 * @module lib/swagger/config
 */

/**
 * Base OpenAPI specification definition
 */
export const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Babylon API',
    version: '1.0.0',
    description: 'API documentation for Babylon social conspiracy game',
    contact: {
      name: 'API Support',
      url: 'https://github.com/BabylonSocial/babylon',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5007',
      description: 'Development server',
    },
    ...(process.env.NEXT_PUBLIC_BASE_URL &&
    process.env.NEXT_PUBLIC_BASE_URL !== 'http://localhost:5007'
      ? []
      : [
          {
            url: 'https://babylon.game',
            description: 'Production server',
          },
        ]),
  ],
  components: {
    securitySchemes: {
      OAuth3Auth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'OAuth3 authentication token (Jeju decentralized auth)',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Bearer authentication token (alias for OAuth3Auth)',
      },
      CronSecret: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Cron secret for scheduled jobs (CRON_SECRET environment variable)',
      },
    },
  },
};
