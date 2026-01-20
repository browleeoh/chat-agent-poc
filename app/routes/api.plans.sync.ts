import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.plans.sync";
import { layerLive } from "@/services/layer";
import { data } from "react-router";
import { DBService } from "@/services/db-service";

const PlanLessonSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  order: Schema.Number,
  description: Schema.String,
  icon: Schema.optional(Schema.Literal("watch", "code", "discussion")),
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

const SyncRequestSchema = Schema.Struct({
  plans: Schema.Array(PlanSchema),
});

export const action = async (args: Route.ActionArgs) => {
  const body = await args.request.json();

  return Effect.gen(function* () {
    const parsed = yield* Schema.decodeUnknown(SyncRequestSchema)(body);
    const db = yield* DBService;

    yield* db.syncPlans(parsed.plans);

    return { success: true };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request body", { status: 400 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
