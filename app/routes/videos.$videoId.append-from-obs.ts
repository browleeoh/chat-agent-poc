import { DBService } from "@/services/db-service";
import { withDatabaseDump } from "@/services/dump-service";
import { layerLive } from "@/services/layer";
import { TotalTypeScriptCLIService } from "@/services/tt-cli-service";
import { Console, Effect, Schema } from "effect";
import type { Route } from "./+types/videos.$videoId.append-from-obs";

const appendFromOBSSchema = Schema.Struct({
  filePath: Schema.String.pipe(Schema.optional),
  insertAfterId: Schema.String.pipe(Schema.NullOr, Schema.optional),
});

function windowsToWSL(windowsPath: string) {
  // Convert C:\Users\... to /mnt/c/Users/...
  const drive = windowsPath.charAt(0).toLowerCase();
  const pathWithoutDrive = windowsPath.slice(3); // Remove "C:\"

  // Convert backslashes to forward slashes
  const unixPath = pathWithoutDrive.replace(/\\/g, "/");

  return `/mnt/${drive}/${unixPath}`;
}

export const action = async (args: Route.ActionArgs) => {
  const { videoId } = args.params;
  const json = await args.request.json();

  return Effect.gen(function* () {
    const result = yield* Schema.decodeUnknown(appendFromOBSSchema)(json);

    const resolvedFilePath = result.filePath
      ? windowsToWSL(result.filePath)
      : undefined;

    const db = yield* DBService;

    const ttCliService = yield* TotalTypeScriptCLIService;

    const firstClipsResult = yield* db.getVideoWithClipsById(videoId, {
      withArchived: true,
    });

    const clipsWithThisInputVideo = firstClipsResult.clips
      .filter((clip) => clip.videoFilename === resolvedFilePath)
      .sort((a, b) => b.sourceStartTime - a.sourceStartTime);

    const lastClipWithThisInputVideo = clipsWithThisInputVideo[0];

    const resolvedStartTime =
      typeof lastClipWithThisInputVideo?.sourceEndTime === "number"
        ? Math.max(lastClipWithThisInputVideo.sourceEndTime - 1, 0)
        : undefined;

    const latestOBSVideoClips = yield* ttCliService.getLatestOBSVideoClips({
      filePath: resolvedFilePath,
      startTime: resolvedStartTime,
    });

    if (latestOBSVideoClips.clips.length === 0) {
      return [];
    }

    const secondClipsResult = yield* db.getVideoWithClipsById(videoId, {
      withArchived: true,
    });

    // Only add new clips
    const clipsToAdd = latestOBSVideoClips.clips.filter(
      (clip) =>
        !secondClipsResult.clips.some(
          (existingClip) =>
            existingClip.videoFilename === clip.inputVideo &&
            existingClip.sourceStartTime === clip.startTime &&
            existingClip.sourceEndTime === clip.endTime
        )
    );

    if (clipsToAdd.length === 0) {
      return [];
    }

    const clips = yield* db.appendClips(
      videoId,
      result.insertAfterId ?? null,
      clipsToAdd
    );

    return clips;
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => {
      return Console.log(e);
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
