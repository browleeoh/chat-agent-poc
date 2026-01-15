import { Console, Effect } from "effect";
import { FileSystem } from "@effect/platform";
import type { Route } from "./+types/api.standalone-files.create";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { withDatabaseDump } from "@/services/dump-service";
import { getStandaloneVideoFilePath } from "@/services/standalone-video-files";
import { data } from "react-router";

export const action = async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();

  return Effect.gen(function* () {
    const videoId = formData.get("videoId");
    const filenameOverride = formData.get("filename");
    const file = formData.get("file");
    const textContent = formData.get("content");

    if (typeof videoId !== "string" || !videoId) {
      return yield* Effect.die(data("videoId is required", { status: 400 }));
    }

    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;

    // Validate video exists and is a standalone video
    const video = yield* db.getVideoById(videoId);
    if (video.lessonId !== null) {
      return yield* Effect.die(
        data("Cannot add files to lesson-connected videos", { status: 400 })
      );
    }

    let filename: string;
    let fileData: Uint8Array;

    // Handle file upload (binary or text)
    if (file instanceof File) {
      // Use override filename if provided, otherwise use uploaded filename
      filename =
        typeof filenameOverride === "string" && filenameOverride.trim()
          ? filenameOverride.trim()
          : file.name;

      // Read file as binary data
      const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
      fileData = new Uint8Array(arrayBuffer);
    } else if (typeof textContent === "string") {
      // Fallback: handle text content for edit mode
      if (typeof filenameOverride !== "string" || !filenameOverride) {
        return yield* Effect.die(
          data("filename is required for text content", { status: 400 })
        );
      }
      filename = filenameOverride;
      fileData = new TextEncoder().encode(textContent);
    } else {
      return yield* Effect.die(
        data("Either file or content must be provided", { status: 400 })
      );
    }

    // Construct file path
    const videoDir = getStandaloneVideoFilePath(videoId);
    const filePath = getStandaloneVideoFilePath(videoId, filename);

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

    // Write file as binary data
    yield* fs.writeFile(filePath, fileData);

    return { success: true, filename };
  }).pipe(
    withDatabaseDump,
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
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
