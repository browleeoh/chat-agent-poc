import { Effect, Schema } from "effect";
import type { Route } from "./+types/api.repos.$repoId.rename-version";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { withDatabaseDump } from "@/services/dump-service";

const renameVersionSchema = Schema.Struct({
  versionId: Schema.String.pipe(Schema.minLength(1)),
  name: Schema.String.pipe(
    Schema.minLength(1, { message: () => "Version name cannot be empty" })
  ),
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const { versionId, name } = yield* Schema.decodeUnknown(renameVersionSchema)(
      formDataObject
    );

    const db = yield* DBService;

    yield* db.updateRepoVersionName(versionId, name.trim());

    return { success: true };
  }).pipe(withDatabaseDump, Effect.provide(layerLive), Effect.runPromise);
};
