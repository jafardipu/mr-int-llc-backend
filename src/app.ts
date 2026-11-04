import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import router from '@app/routes/routes.js';
import { setupSwagger } from '@app/docs/swagger.js';
import notFound from '@app/middleware/notfound.js';
import globalErrorHandler from '@app/middleware/globalErrorhandler.js';
import {
  apiRateLimiter,
  authRateLimiter,
  paymentRateLimiter,
} from '@app/middleware/rateLimiter.js';

const app: Application = express();

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

const isDocsPath = (path: string) =>
  path.startsWith('/api/docs') || path === '/api/docs.json';

app.use('/api/v1/auth', authRateLimiter);
app.use('/api/v1/otp', authRateLimiter);
app.use('/api/v1/payments', paymentRateLimiter);
app.use('/api/v1', apiRateLimiter);

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', 'public/ejs');
app.use(
  express.json({
    limit: '500mb',
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = buffer;
    },
  }),
);
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.use(cookieParser());
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'token',
      'Access-Control-Allow-Private-Network',
    ],
  }),
);

app.use((req, res, next) => {
  if (isDocsPath(req.path)) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'",
    );
    return next();
  }
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com; connect-src 'self' https://api.stripe.com; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com",
  );
  next();
});

setupSwagger(app);

app.use('/api/v1', router);

app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'MR International LLC ecommerce server is running',
    docs: '/api/docs',
    openapi: '/api/docs.json',
    apiBase: '/api/v1',
    pages: {
      website: '/website.html',
      marketing: '/marketing.html',
      support: '/support.html',
      privacyPolicy: '/privacy-policy.html',
    },
  });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;
