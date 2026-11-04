# Skill: Implement a Feature in This Backend

## Before coding
- Read `AGENTS.md` and `PROJECT_ARCHITECTURE.md`.
- Inspect at least one comparable module from route through controller to service.
- Detect the active database and ORM for this repository/task before designing data access.
- For Prisma, inspect the active `datasource.provider` in the schema and any Prisma config. Recognize MongoDB (`mongodb`), MySQL (`mysql`), and PostgreSQL (`postgresql`). Cross-check dependencies, client initialization, and runtime configuration.
- If multiple datasources or conflicting configuration exist, trace the target feature's datasource. If still unclear, ask rather than guessing.
- Inspect the schema for exact models, fields, enums, and relations.

## Provider-aware implementation
- Adapt schema design, queries, indexes, relations, transactions, migrations, generated types, and tests to the detected database and ORM version.
- Do not use MongoDB ObjectId assumptions in SQL schemas or SQL-only assumptions in MongoDB.
- Do not treat MySQL and PostgreSQL as interchangeable.
- Do not change the configured provider or add another database unless explicitly requested.
- State the detected database/ORM in the final implementation summary.

## Implementation pattern
- Add files under `src/app/module/<feature>/` when that matches the repository's existing architecture.
- Define Zod validation where input needs validation.
- Add route middleware in the order used by nearby modules.
- Implement business logic and database calls in the service.
- Keep controller thin: call service and return through the existing response helper inside the existing async wrapper.
- Register the router in the central route list.
- Use the existing application error type for expected failures.

## Completion
- Check TypeScript imports, ESM extensions, generated types, schema validity, and provider-specific requirements.
- Run the repository's build, lint, tests, and ORM validation/generation commands when available and safe.
- State which checks were actually run and their outcomes.
- List files changed, detected database/ORM, assumptions, and unresolved requirements.
