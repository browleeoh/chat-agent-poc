import { DBService } from "@/services/db-service";
import { withDatabaseDump } from "@/services/dump-service";
import { layerLive } from "@/services/layer";
import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/api.repos.$repoId.create-version";

const createVersionSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  sourceVersionId: Schema.String,
});

export const action = async ({ request, params }: Route.ActionArgs) => {
  const formData = await request.formData();
  const formDataObject = Object.fromEntries(formData);

  return await Effect.gen(function* () {
    const result = yield* Schema.decodeUnknown(createVersionSchema)(formDataObject);
    const db = yield* DBService;

    const newVersion = yield* db.copyVersionStructure({
      sourceVersionId: result.sourceVersionId,
      repoId: params.repoId,
      newVersionName: result.name,
    });

    return { id: newVersion.id, name: newVersion.name };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () =>
      Effect.succeed(new Response("Invalid request - version name required", { status: 400 }))
    ),
    Effect.catchTag("NotLatestVersionError", () =>
      Effect.succeed(new Response("Can only create new version from latest version", { status: 400 }))
    ),
    Effect.catchAll(() =>
      Effect.succeed(new Response("Internal server error", { status: 500 }))
    ),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
