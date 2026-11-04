# Project Architecture Reference

This document summarizes the uploaded `prisma_project_format` repository. It describes what was observed in that repository; it is not a universal template for every future project.

## Stack observed in this repository
- Node.js, TypeScript (strict), ESM / NodeNext
- Express 5
- Prisma 6 with MongoDB datasource
- Zod request validation
- Redis and Socket.IO
- AWS S3 utilities, Nodemailer, JWT, bcrypt
- pnpm (`pnpm@10.30.1` in package metadata)

## Mandatory database detection for other repositories
For every new repository, independently detect the active database and ORM before implementing features. Do not carry the MongoDB finding from this sample repository into another project.

Detection checklist:
1. Inspect the active Prisma datasource provider in `prisma/schema.prisma` (and any Prisma config/multiple schema paths).
2. Identify `mongodb`, `mysql`, or `postgresql`; do not confuse the PostgreSQL provider spelling with the database product name.
3. Cross-check ORM/database dependencies and the actual client initialization code.
4. Trace environment/configuration references to identify the active connection without displaying secrets.
5. If multiple databases or conflicting configuration exist, trace which datasource the target feature uses; ask if it remains ambiguous.
6. Record the detected provider and ORM in the implementation summary.

Adapt implementation to the detected provider:
- MongoDB: verify ObjectId mappings, document relations, supported transactions, and Mongo-specific schema constraints.
- MySQL: verify MySQL column types, indexes, constraints, relation behavior, and migration workflow.
- PostgreSQL: verify PostgreSQL types, enums, arrays/JSON usage, indexes, constraints, relation behavior, and migration workflow.
- Do not transplant provider-specific schema/query assumptions between these databases.
- Dynamic detection means adapting to the active database in each repository. It does not mean silently configuring one project to run all three databases at once.

## Directory map observed
```text
src/
  server.ts
  app.ts
  app/
    config/
    constants/
    error/
    helpers/
    interface/
    middleware/
    module/
      auth/
      contents/
      notification/
      otp/
      users/
    redis/
    routes/routes.ts
    shared/
    socket/
    utils/
prisma/
  schema.prisma
```

## Feature request lifecycle observed
1. `src/app/routes/routes.ts` mounts each feature router under a URL prefix.
2. Feature route file defines HTTP method/path and middleware chain.
3. `validateRequest` validates request sections using a Zod schema where present.
4. `auth(...roles)` protects routes that require authentication/role access.
5. Controller wraps async work with `catchAsync`, calls a feature service, and returns via `sendResponse`.
6. Service contains business logic and Prisma operations.
7. `AppError` and the global error handler provide centralized error responses.

## Naming and import style observed
- Feature folder: `src/app/module/<feature>/`.
- Existing filenames vary; match the nearest module.
- App imports use `@app/...`; relative ESM imports generally include `.js`.
- Controllers and services export grouped objects.

## API response format observed
Successful responses use the shared `sendResponse` helper with `statusCode`, `success`, `message`, `data`, and optional `meta`.

## Database finding for this sample repository only
- Prisma generator output: `generated/prisma`.
- Datasource provider: `mongodb`.
- IDs commonly use MongoDB ObjectId mapping (`@map("_id") @db.ObjectId`).
- Use the active schema as the authority for model and relation names.

## Existing project-specific conventions observed
- Pagination uses `pickQuery` and `paginationHelper.calculatePagination`.
- Authentication middleware reads a Bearer token, verifies JWT, checks user/role/status/verification, and attaches decoded data to `req.user`.
- File upload routes use Multer memory storage and project upload utilities such as `uploadToS3`.
- Global error handling recognizes Zod, Prisma, Multer, and `AppError`.

## Cautions observed in this source
- JSON parsing is installed twice and body limit is 500 MB; review before changing.
- `notFound` is mounted after `globalErrorHandler`; confirm behavior before changing.
- Some services wrap broad errors as `AppError`, potentially hiding original error types/statuses.
- The `Role` enum includes `supper_admin`; verify exact enum values.
- Route filename singular/plural variants exist; match local precedent.
- `sendResponse` contains `data.data || {} || []`; the final fallback is unreachable. Do not repeat this expression in new helpers without reason.

## Non-goals
- Do not migrate this sample repository from MongoDB to SQL.
- Do not assume a future repository uses MongoDB; detect it independently.
- Do not replace Prisma, Express, Zod, or the response envelope without an explicit request.
- Do not reorganize all feature folders or change unrelated API behavior.
