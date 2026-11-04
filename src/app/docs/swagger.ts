import type { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument, documentedOperationCount } from './buildOpenApi.js';

function requestOrigin(req: Request) {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const proto = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host');
  if (!host) return process.env.SERVER_URL?.replace(/\/$/, '') || '';
  return `${proto}://${host}`.replace(/\/$/, '');
}

export const setupSwagger = (app: Application) => {
  const envOrigin = process.env.SERVER_URL?.replace(/\/$/, '');
  const fallbackDocument = buildOpenApiDocument(
    envOrigin ? { publicOrigin: envOrigin } : {},
  );

  app.get('/api/docs.json', (req: Request, res: Response) => {
    const origin = requestOrigin(req) || envOrigin;
    const document = buildOpenApiDocument(
      origin ? { publicOrigin: origin } : {},
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json(document);
  });

  app.use(
    '/api/docs',
    ...swaggerUi.serve,
    swaggerUi.setup(fallbackDocument, {
      customSiteTitle: 'MR Int LLC API Docs',
      explorer: true,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        url: '/api/docs.json',
      },
    }),
  );

  // eslint-disable-next-line no-console
  console.log(
    `Swagger UI ready at /api/docs (${documentedOperationCount} operations)`,
  );
};
