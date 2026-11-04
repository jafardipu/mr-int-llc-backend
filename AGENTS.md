# Repository Instructions

## Source of truth
- Treat this repository's existing implementation as the authoritative project convention.
- Before adding or changing code, inspect the closest existing module and follow its naming, imports, response shape, and layering.
- Do not introduce a new architecture, ORM, validation library, folder convention, or response format unless explicitly requested.
- Do not rewrite unrelated code or perform broad refactors while implementing a feature.

## Stack and runtime
- Detect the actual stack from the current repository. Do not assume every project uses the same framework, ORM, database, package manager, or runtime.
- For this reference repository, observed stack: Node.js + TypeScript, ESM (`type: module`), Express 5, Prisma 6, Zod, Redis, Socket.IO.
- Package manager: inspect `package.json` (`packageManager`) and lockfiles; respect the existing choice.
- TypeScript uses `NodeNext`, strict mode, `@app/*` alias for `src/app/*`, and emitted `.js` extensions in relative ESM imports in this reference repository.

## Database and ORM: detect dynamically (mandatory)
- Never hardcode MongoDB, MySQL, or PostgreSQL as the assumed database for every project.
- At the start of each task, identify the database and data-access technology used by the current repository.
- Inspect, in this order as applicable: ORM schema/configuration (for Prisma, `prisma/schema.prisma` and any Prisma config), ORM/database packages in `package.json`, database client initialization, and environment-variable names/configuration. Use environment variables to identify connection configuration, not to expose or print credentials.
- For Prisma, read the datasource `provider` in the active schema. Recognize at least `mongodb`, `mysql`, and `postgresql` (PostgreSQL provider is commonly written as `postgresql`). Also recognize other providers if the repository explicitly uses them.
- Cross-check the detected provider against the actual client setup and dependencies. If evidence conflicts, stop and report the conflict instead of guessing.
- If the provider is indirect, selected by environment/configuration, or multiple schemas/databases exist, trace the active runtime configuration and determine which datasource the feature uses. Ask one focused question if it cannot be established safely.
- Adapt queries, schema changes, indexes, relations, transactions, migrations, generated types, and tests to the detected database/ORM. Do not apply MongoDB ObjectId assumptions to SQL databases, or SQL-only assumptions to MongoDB.
- For MongoDB, verify ObjectId fields/mappings and MongoDB relation/transaction limitations from the actual schema and installed Prisma version.
- For MySQL/PostgreSQL, inspect native column types, constraints, relations, indexes, migration workflow, and provider-specific behavior before writing code. Do not assume MySQL and PostgreSQL are interchangeable.
- Do not switch database providers, migrate data, add another database, or claim the same code supports all three simultaneously unless the user explicitly asks for that. Dynamic detection means adapting to the database configured in the current project.
- If this reference repository is the target, its current Prisma datasource is MongoDB. That is a finding about this repository only, not a global rule for future repositories.

## Module structure
- Feature code lives in `src/app/module/<feature>/`.
- Keep feature files in the established pattern where applicable: `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.route.ts` or `<feature>.routes.ts` (match neighboring module), `<feature>.validation.ts` when needed, and interfaces/constants/utils only when needed.
- Register each feature router in `src/app/routes/routes.ts`.
- Controllers handle HTTP request/response concerns and delegate business logic to services. Services contain business logic and data access.
- Use shared infrastructure from the existing shared, middleware, helpers, utilities, and error folders.

## HTTP conventions
- Wrap async controller handlers with the repository's existing async wrapper (in this reference, `catchAsync`).
- Return successful responses through the existing response helper (in this reference, `sendResponse`) using `{ statusCode, success, message, data }` and `meta` for pagination when applicable.
- Use existing HTTP status constants, authentication middleware, role constants, Zod validation, and router registration patterns. Do not invent parallel systems.

## Errors and security
- Use the repository's expected application error type for expected failures and let the global error handler format errors.
- Never expose secrets, tokens, password hashes, or private user fields in API responses or logs.
- Read configuration through the existing config layer and environment variables. Never add real credentials to source files.
- Do not weaken auth, role checks, validation, CORS, or upload restrictions to make a feature pass.
- Treat uploaded files and user input as untrusted.

## Editing workflow
1. Read these instructions and inspect the relevant module, route registration, schema, middleware, utilities, ORM/database configuration, and package metadata.
2. Explicitly record the detected database provider and ORM for the task before designing data access.
3. Make the smallest change consistent with the repository and detected database.
4. Add/update validation, auth, service logic, controller, and route as required.
5. Check imports, generated types, schema validity, and provider-specific requirements.
6. Run relevant checks (for this reference repository, `pnpm build` and `pnpm lint` when available); report failures honestly.
7. Summarize changed files, detected database/ORM, behavior, assumptions, and checks run.

## Important
- Existing source code may contain inconsistencies and potential defects. Do not silently copy a defect into new code. Preserve compatibility and explain necessary fixes.
- If database detection is uncertain, do not guess or generate provider-specific schema/query code until clarified.
