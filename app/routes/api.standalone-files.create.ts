import { Console, Effect, Schema } from "effect";
import { FileSystem } from "@effect/platform";
import type { Route } from "./+types/api.standalone-files.create";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { withDatabaseDump } from "@/services/dump-service";
import { getStandaloneVideoFilePath } from "@/services/standalone-video-files";
import { data } from "react-router";

const createFileSchema = Schema.Struct({
  videoId: Schema.String,
  filename: Schema.String,
  content: Schema.String,
});

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();
  const formDataObject = Object.fromEntries(formData);

  return Effect.gen(function* () {
    const parsed =
      yield* Schema.decodeUnknown(createFileSchema)(formDataObject);

    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;

    // Validate video exists and is a standalone video
    const video = yield* db.getVideoById(parsed.videoId);
    if (video.lessonId !== null) {
      return yield* Effect.die(
        data("Cannot add files to lesson-connected videos", { status: 400 })
      );
    }

    // Construct file path
    const videoDir = getStandaloneVideoFilePath(parsed.videoId);
    const filePath = getStandaloneVideoFilePath(
      parsed.videoId,
      parsed.filename
    );

    // Check if file already exists
    const fileExists = yield* fs.exists(filePath);
    if (fileExists) {
      return yield* Effect.die(data("File already exists", { status: 409 }));
    }

    // Ensure directory exists
    const dirExists = yield* fs.exists(videoDir);
    if (!dirExists) {
      yield* fs.makeDirectory(videoDir, { recursive: true });
    }

    // Write file
    yield* fs.writeFileString(filePath, parsed.content);

    return { success: true, filename: parsed.filename };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("ParseError", () => {
      return Effect.die(data("Invalid request", { status: 400 }));
    }),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Video not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};
