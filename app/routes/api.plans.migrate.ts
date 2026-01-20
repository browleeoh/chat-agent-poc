import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.plans.migrate";
import { layerLive } from "@/services/layer";
import { data } from "react-router";
import { DBService } from "@/services/db-service";

const PlanLessonSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  order: Schema.Number,
  description: Schema.optional(Schema.String),
  icon: Schema.optional(
    Schema.NullOr(Schema.Literal("watch", "code", "discussion"))
  ),
  dependencies: Schema.optional(Schema.Array(Schema.String)),
});

const PlanSectionSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  order: Schema.Number,
  lessons: Schema.Array(PlanLessonSchema),
});

const PlanSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  sections: Schema.Array(PlanSectionSchema),
});

const MigrateRequestSchema = Schema.Struct({
  plans: Schema.Array(PlanSchema),
});

/**
 * POST /api/plans/migrate
 *
 * Migrates plans from localStorage to Postgres.
 * Only migrates if the database is empty (no existing plans).
 * This is a one-time operation triggered on first app load.
 */
export const action = async (args: Route.ActionArgs) => {
  const body = await args.request.json();

  return Effect.gen(function* () {
    const parsed = yield* Schema.decodeUnknown(MigrateRequestSchema)(body);
    const db = yield* DBService;

    // Check if database already has plans
    const existingPlans = yield* db.getPlans();

    if (existingPlans.length > 0) {
      // Database already has plans, skip migration
      return { migrated: false, reason: "database_not_empty" };
    }

    if (parsed.plans.length === 0) {
      // No plans to migrate
      return { migrated: false, reason: "no_plans_to_migrate" };
    }

    // Migrate by syncing plans to database
    yield* db.syncPlans(parsed.plans);

    return { migrated: true };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", (e) => {
      return Effect.die(
        data("Invalid request body: " + e.message, { status: 400 })
      );
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
