import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { Effect, Schema } from "effect";
import type { Route } from "./+types/videos.$videoId.completions";
import { DBService } from "@/services/db-service";
import { FileSystem } from "@effect/platform";
import path from "node:path";
import { layerLive } from "@/services/layer";
import { generateArticlePrompt } from "@/prompts/generate-article";

const chatSchema = Schema.Struct({
  messages: Schema.Any,
});

const NOT_A_FILE = Symbol("NOT_A_FILE");

export const action = async (args: Route.ActionArgs) => {
  const body = await args.request.json();
  const videoId = args.params.videoId;

  return Effect.gen(function* () {
    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;

    const { messages }: { messages: UIMessage[] } = yield* Schema.decodeUnknown(
      chatSchema
    )(body);

    const video = yield* db.getVideoById(videoId);

    const repo = video.lesson.section.repo;
    const section = video.lesson.section;
    const lesson = video.lesson;

    const lessonPath = path.join(repo.filePath, section.path, lesson.path);

    const allFilesInDirectory = yield* fs
      .readDirectory(lessonPath, {
        recursive: true,
      })
      .pipe(
        Effect.map((files) => files.map((file) => path.join(lessonPath, file)))
      );

    const filteredFiles = allFilesInDirectory.filter((filePath) => {
      return !filePath.includes("node_modules") && !filePath.includes(".vite");
    });

    const files = yield* Effect.forEach(filteredFiles, (filePath) => {
      return Effect.gen(function* () {
        const stat = yield* fs.stat(filePath);

        if (stat.type !== "File") {
          return NOT_A_FILE;
        }

        const fileContent = yield* fs.readFileString(filePath);
        return {
          filePath,
          fileContent,
        };
      });
    }).pipe(Effect.map((res) => res.filter((r) => r !== NOT_A_FILE)));

    const codeFormatted = files
      .map((file) => {
        const language = path.extname(file.filePath).slice(1);
        return [
          "```" + language,
          `// ${path.relative(lessonPath, file.filePath)}`,
          file.fileContent,
          "```",
        ].join("\n");
      })
      .join("\n\n");

    const result = streamText({
      model: anthropic("claude-3-7-sonnet-20250219"),
      messages: convertToModelMessages(body.messages),
      system: generateArticlePrompt({
        code: codeFormatted,
      }),
    });

    return result.toUIMessageStreamResponse();
  }).pipe(Effect.provide(layerLive), Effect.runPromise);
};
