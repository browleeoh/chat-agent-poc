import { Effect, Schema } from "effect";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import type { Route } from "./+types/api.videos.delete";

const deleteVideoSchema = Schema.Struct({
  videoId: Schema.String,
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);
  return Effect.gen(function* () {
    const { videoId } = yield* Schema.decodeUnknown(deleteVideoSchema)(
      formDataObject
    );

    const db = yield* DBService;

    yield* db.deleteVideo(videoId);

    return { success: true };
  }).pipe(Effect.provide(layerLive), Effect.runPromise);
};
