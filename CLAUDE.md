# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Runs both React Router dev server and Stream Deck forwarder in parallel
- `pnpm dev:react-router` - Start React Router dev server only (port 5173)
- `pnpm dev:stream-deck-forwarder` - Start Stream Deck forwarder WebSocket server (port 5172) and HTTP server (port 5174)

### Build & Test
- `pnpm build` - Build for production
- `pnpm typecheck` - Generate React Router types and run TypeScript compiler
- `pnpm test` - Run Vitest tests

### Database
- `pnpm db:push` - Push schema changes to database (uses Drizzle Kit)
- `pnpm db:studio` - Open Drizzle Studio for database management
- Database schema: `app/db/schema.ts`
- Database credentials: `DATABASE_URL` in `.env`

## Architecture

### React Router v7
- Uses file-based routing via `@react-router/fs-routes` with flat routes in `app/routes/`
- Server-side rendering enabled
- Path alias: `@/*` maps to `./app/*`
- Route config: `app/routes.ts`

### Database (Drizzle ORM + PostgreSQL)
Core entities with cascade deletion:
- `repos` - Course repositories
  - `sections` - Ordered sections within repo
    - `lessons` - Ordered lessons within section
      - `videos` - Videos for lesson
        - `clips` - Ordered video clips with transcription

Table prefix: `course-video-manager_*`

### Effect.ts Services
Services live in `app/services/` and use Effect.ts for dependency injection:
- `DBService` - Database operations with typed errors (`NotFoundError`, `UnknownDBServiceError`)
- `RepoParserService` - Parses repo structure from filesystem (expects numbered folders like `01-section-name/02-lesson-name`)
- `DatabaseDumpService` - Database dump operations
- `TotalTypeScriptCLIService` - Integration with Total TypeScript CLI
- Main layer: `layerLive` in `app/services/layer.ts`

### Video Editor Feature
Located in `app/features/video-editor/`:
- Uses `use-effect-reducer` for state management with side effects
- `clip-state-reducer.ts` - Manages clip state with optimistic updates and database sync
- Two clip types:
  - `ClipOnDatabase` - Persisted clips with database ID
  - `ClipOptimisticallyAdded` - Temporary clips during creation
- Branded types: `DatabaseId` and `FrontendId` distinguish ID sources

### Stream Deck Integration
`stream-deck-forwarder/` provides external control:
- WebSocket server (port 5172) broadcasts messages to connected clients
- HTTP server (port 5174) receives commands from Stream Deck
- Endpoints: `/api/delete-last-clip`, `/api/toggle-last-frame-of-video`

### TypeScript
Strict mode enabled with:
- `noUncheckedIndexedAccess: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

### Styling
- TailwindCSS v4 via `@tailwindcss/vite`
- Radix UI components for primitives
- Styles in `app/app.css`
