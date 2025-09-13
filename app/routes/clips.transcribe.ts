import { DBService } from "@/services/db-service";
import { TotalTypeScriptCLIService } from "@/services/tt-cli-service";
import { Effect, Schema } from "effect";
import type { Route } from "./+types/clips.transcribe";
import { withDatabaseDump } from "@/services/dump-service";
import { layerLive } from "@/services/layer";

const transcribeClipsSchema = Schema.Struct({
  clipIds: Schema.Array(Schema.String),
});

export const action = async (args: Route.ActionArgs) => {
  const json = await args.request.json();

  return Effect.gen(function* () {
    const db = yield* DBService;
    const ttCliService = yield* TotalTypeScriptCLIService;

    const { clipIds } = yield* Schema.decodeUnknown(transcribeClipsSchema)(
      json
    );

    const clips = yield* db.getClipsByIds(clipIds);

    const transcribedClips = yield* ttCliService.transcribeClips(
      clips.map((clip) => ({
        id: clip.id,
        inputVideo: clip.videoFilename,
        startTime: clip.sourceStartTime,
        duration: clip.sourceEndTime - clip.sourceStartTime,
      }))
    );

    yield* Effect.forEach(transcribedClips, (transcribedClip) => {
      return db.updateClip(transcribedClip.id, {
        text: transcribedClip.segments.map((segment) => segment.text).join(" "),
        transcribedAt: new Date(),
      });
    });

    return { success: true };
  }).pipe(withDatabaseDump, Effect.provide(layerLive), Effect.runPromise);
};
