# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MR International LLC e-commerce backend for retail and wholesale customers. Express 5 + TypeScript (ESM, `nodenext`), Prisma 6 on **MongoDB**, Redis (Socket.io adapter + BullMQ queues), Stripe, AWS S3, Nodemailer. Package manager: pnpm 10.

Team agent rules also live in `AGENTS.md`, `PROJECT_ARCHITECTURE.md`, `SKILL.md` and `.cursor/rules/backend-project.mdc`. The parts that matter here: copy the closest existing module instead of introducing new patterns; verify every model, field, enum and relation in `prisma/schema.prisma` and don't invent fields, roles, endpoints or env vars; keep the response envelope; avoid unrelated refactors; finish by running the type check and lint and report the results honestly.

## Commands

| Task | Command |
|---|---|
| Generate Prisma client (after install or any schema change; output `generated/prisma`, gitignored) | `pnpm exec prisma generate` |
| Dev server (tsx watch). Needs Redis: start it with `pnpm docker:redis` (host port 5050, matching `.env.example`) | `pnpm dev` |
| Type check only | `pnpm exec tsc --noEmit` |
| Lint. Note `pnpm lint` runs with `--fix` and rewrites files | `pnpm exec eslint "src/**/*.ts"` |
| Build (`tsc`, then `tsc-alias` rewrites `@app/*` to relative paths) / run build | `pnpm build` / `pnpm start` |
| Regenerate `docs/openapi.json` (committed) | `pnpm docs:openapi` |
| Docker: build and run api + redis / stop / remove | `pnpm docker:up` / `docker compose stop` / `pnpm docker:down` |
| Kubernetes (kustomize in `k8s/`) | `pnpm k8s:apply` |

There is no test suite. Verify changes with the type check, lint, and by calling endpoints (Swagger UI at `/api/docs`).

In Docker Compose the API listens on host port **4000** and Socket.io on **4005**. Compose overrides `PORT`/`SOCKET_PORT`/`REDIS_HOST` on top of `.env`, so the `80:5000` mapping in `compose.yaml` goes nowhere. After editing `.env` run `docker compose up -d --force-recreate api`; after code changes rebuild with `pnpm docker:up`.

## Architecture

**Request path:** `src/app.ts` → `src/app/routes/routes.ts` mounts each module router under `/api/v1/<prefix>` → module route file: `auth(...)` → multer → `parseData()` → upload middleware → `validateRequest(schema)` → controller (wrapped in `catchAsync`, replies through `sendResponse`) → service (business logic and Prisma). Throw `AppError` for expected failures; `middleware/globalErrorhandler.ts` turns Zod, Prisma, Multer and `AppError` errors into `{ success: false, message, errorSources }`.

**Startup (`src/server.ts`):**
1. Connect Redis. The process exits if this fails.
2. Schedule BullMQ order jobs.
3. Start Socket.io on its own port (`SOCKET_PORT`, Redis adapter).
4. Start the HTTP server on `PORT`.
5. Run `defaultTask()`. It creates an `admin@gmail.com` / `112233` admin if no admin exists, and seeds the `contents` record.

BullMQ workers in `src/app/workers/` run inside the API process.

### Conventions that aren't obvious

- **Imports:** `@app/*` maps to `src/app/*`. Relative imports must end in `.js`. Prisma types and enums come from a relative path to `generated/prisma/index.js`; the `@prisma` alias in tsconfig is unused. The compiler runs with `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (use `import type`).
- **Validation:** Zod schemas are shaped `z.object({ body: z.object({...}) })`. `validateRequest` checks only `body`/`files`/`file`/`cookies`, never `query` or `params`. It also **discards the parsed result**: `req.body` is not stripped or transformed, so services must read only the fields they expect.
- **Multipart:** requests send JSON in a `data` form field. `parseData()` parses it into `req.body`; `uploadSingle`/`uploadMulti` upload files to S3 and set the resulting URLs on `req.body`.
- **List endpoints** use `pickQuery` + `paginationHelper.calculatePagination`.
  - `page`, `limit` and `sort` are pagination. Every other query key becomes a Prisma `equals` filter; services pull `searchTerm` out first. Unknown query keys therefore fail with a 400.
  - `sort` is comma-separated fields, with a `-` prefix for descending. When it is empty, each service applies its own default order.
  - Lists return `{ data, meta: { page, limit, total } }` as the response `data` (nested), not through `sendResponse`'s `meta`.
- **Soft delete:** most models have `isDeleted`. Always filter `isDeleted: false`.
- **Auth:**
  - `auth(...roles)` takes role lists from `module/users/user.constants.ts`: `ADMIN_ROLES`, `CUSTOMER_ROLES`, `AUTH_ROLES`.
  - The roles are `supper_admin` (that spelling is real), `admin`, `retail` and `wholesale`.
  - A wrong role, a blocked account or an unverified account all return **401**, not 403. A deleted user returns 404.
  - `optionalAuth` is for public endpoints that personalize the response when a token is present.
  - `req.user` is the JWT payload (`userId`, `role`, ...). Global type augmentations (`req.user`, `req.rawBody`, `global.socketio`) live in `src/app/interface/index.d.ts`.

### Orders and payments (spans `order`, `payment`, `promoCode`, `workers`)

- **Pricing:** `priceCart` in `order.service.ts` is the single pricing source for `GET /orders/checkout-summary` and `POST /orders/checkout`. Shipping and tax come from env (`SHIPPING_FEE`, `TAX_RATE` → `config.checkout`). Price fields sent by the client are ignored.
- **Checkout** creates a `pending` order, decrements stock, records the promo redemption and clears the cart, all in one transaction.
- **Payment** goes through a Stripe **Checkout Session** (hosted page). The Stripe wrapper is `src/app/class/string.class.ts`; the file name is misleading. Success and cancel URLs are built from `CLIENT_URL` (`/checkout/success`, `/checkout/cancel`). `Payment.transactionId` holds the session id (`cs_...`) while pending and the PaymentIntent id (`pi_...`) once paid; refunds use the latter.
- **Webhook** `POST /api/v1/payments/webhook`:
  - It is unauthenticated and skips the rate limiters in `app.ts`.
  - It verifies the signature against `req.rawBody`, captured by the `express.json({ verify })` callback in `app.ts`. Keep that intact when touching body parsing.
  - `markPaymentSucceeded` is idempotent. It refunds duplicate payments and payments for orders that were already cancelled.
- **Cancellation:** `cancelOrder` is the single cancellation path, used by admin status changes, customer cancel and the expiry job. It syncs with Stripe, refunds or voids the payment, restores stock and rolls back promo usage.
- **Expiry of unpaid orders:** a BullMQ job scheduler in `workers/order.worker.ts` runs every 15 minutes, only when `UNPAID_ORDER_EXPIRY_HOURS` > 0.
- **Spelling:** the payment status enum uses `canceled`; the order status uses `cancelled`.

### Notifications

Services enqueue `new_notification` jobs on `notificationQueue` (`src/app/redis/index.ts`); use `notifyAdmins()` from `notification.service.ts` to notify every admin. `workers/notification.worker.ts` stores the notification, then emits `new_notification` over Socket.io to the socket id in the Redis hash `userId_to_socketId`.

### API docs

The OpenAPI spec is **hand-maintained** as an operation list in `src/app/docs/buildOpenApi.ts`; it is not generated from the routes. Add or update an entry for every endpoint you change, then run `pnpm docs:openapi`. Swagger UI's "Try it out" sends requests to the hardcoded production origin `http://103.186.20.117:4000` (`src/app/docs/swagger.ts`), even when you open the docs locally.

## Data and environment cautions

- `DATABASE_URL` in `.env` points at a MongoDB Atlas cluster holding real data. There are no migrations on MongoDB. `prisma db push`, `pnpm seed`, and turning on `UNPAID_ORDER_EXPIRY_HOURS` all write to that database.
- The Docker build fails on purpose if any `@app/` import survives in `dist` (a check that the alias rewrite worked).
- `k8s/kustomization.yaml` applies `k8s/secret.example.yaml` directly, and that file contains real credentials. Don't copy values from it.
- Don't trust `pnpm generate` (`generateFolder.js`) as-is:
  - the generated controller imports the service without `.js`;
  - its auto-registration regex doesn't match `routes.ts`, so you must register new routes by hand;
  - the service template turns every error into a 400.
