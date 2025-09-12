import { withDatabaseDump } from "@/services/dump-service";
import type { Route } from "./+types/videos.$videoId.append-from-obs";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { TotalTypeScriptCLIService } from "@/services/tt-cli-service";
import { Effect, Schema } from "effect";

const appendFromOBSSchema = Schema.Struct({
  filePath: Schema.String.pipe(Schema.optional),
});

export const action = async (args: Route.ActionArgs) => {
  const { videoId } = args.params;
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const result = yield* Schema.decodeUnknown(appendFromOBSSchema)(
      formDataObject
    );

    const db = yield* DBService;

    const ttCliService = yield* TotalTypeScriptCLIService;

    yield* db.getVideoById(videoId);

    const latestOBSVideoClips = yield* ttCliService.getLatestOBSVideoClips({
      filePath: result.filePath,
    });

    const clips = yield* db.appendClips(videoId, latestOBSVideoClips.clips);

    return clips;
  }).pipe(withDatabaseDump, Effect.provide(layerLive), Effect.runPromise);
};
