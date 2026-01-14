import { generateArticlePrompt } from "@/prompts/generate-article";
import { generateStepsToCompleteForProjectPrompt } from "@/prompts/generate-steps-to-complete-for-project";
import { generateStepsToCompleteForSkillBuildingProblemPrompt } from "@/prompts/generate-steps-to-complete-for-skill-building-problem";
import { refineSkillBuildingWithStyleGuidePrompt } from "@/prompts/refine-skill-building-with-style-guide";
import { refineProjectWithStyleGuidePrompt } from "@/prompts/refine-project-with-style-guide";
import {
  Experimental_Agent as Agent,
  convertToModelMessages,
  type LanguageModel,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { Array, Effect } from "effect";
import { DBService } from "./db-service";
import path from "node:path";
import { FileSystem } from "@effect/platform";

const NOT_A_FILE = Symbol("NOT_A_FILE");

export type TextWritingAgentMode =
  | "article"
  | "skill-building"
  | "style-guide-skill-building"
  | "style-guide-project"
  | "project";

export type TextWritingAgentCodeFile = {
  path: string;
  content: string;
};

export type TextWritingAgentImageFile = {
  path: string;
  content: Uint8Array<ArrayBufferLike>;
};

export const createTextWritingAgent = (props: {
  model: LanguageModel;
  mode: TextWritingAgentMode;
  transcript: string;
  code: TextWritingAgentCodeFile[];
  imageFiles: TextWritingAgentImageFile[];
}) => {
  const systemPrompt = (() => {
    switch (props.mode) {
      case "project":
        return generateStepsToCompleteForProjectPrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "skill-building":
        return generateStepsToCompleteForSkillBuildingProblemPrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "style-guide-skill-building":
        return refineSkillBuildingWithStyleGuidePrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "style-guide-project":
        return refineProjectWithStyleGuidePrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "article":
      default:
        return generateArticlePrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
    }
  })();

  return new Agent({
    model: props.model,
    system: systemPrompt,
  });
};

export const createModelMessagesForTextWritingAgent = (props: {
  messages: UIMessage[];
  imageFiles: TextWritingAgentImageFile[];
}): ModelMessage[] => {
  const modelMessages = convertToModelMessages(props.messages);

  if (props.imageFiles.length > 0) {
    modelMessages.unshift({
      role: "user",
      content: props.imageFiles.flatMap((file) => {
        return [
          {
            type: "text",
            text: `The following image is at "${file.path}":`,
          },
          {
            type: "image",
            image: file.content,
          },
        ];
      }),
    });
  }

  return modelMessages;
};

export const DEFAULT_CHECKED_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "md",
  "mdx",
  "txt",
  "csv",
];

export const ALWAYS_EXCLUDED_DIRECTORIES = ["node_modules", ".vite"];

export const DEFAULT_UNCHECKED_PATHS = ["readme.md", "speaker-notes.md"];

export const acquireTextWritingContext = Effect.fn("acquireVideoContext")(
  function* (props: { videoId: string; enabledFiles: string[] | undefined; includeTranscript?: boolean }) {
    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;

    const video = yield* db.getVideoWithClipsById(props.videoId);

    const lesson = video.lesson;
    if (!lesson) {
      throw new Error("Cannot write for standalone videos");
    }
    const repo = lesson.section.repoVersion.repo;
    const section = lesson.section;

    const lessonPath = path.join(repo.filePath, section.path, lesson.path);

    const allFilesInDirectory = yield* fs
      .readDirectory(lessonPath, {
        recursive: true,
      })
      .pipe(
        Effect.map((files) => files.map((file) => path.join(lessonPath, file)))
      );

    const filteredFiles = allFilesInDirectory.filter((filePath) => {
      const relativePath = path.relative(lessonPath, filePath);
      return (
        !ALWAYS_EXCLUDED_DIRECTORIES.some((excludedDir) =>
          filePath.includes(excludedDir)
        ) &&
        (props.enabledFiles === undefined ||
          props.enabledFiles.includes(relativePath))
      );
    });

    const allFiles = yield* Effect.forEach(filteredFiles, (filePath) => {
      return Effect.gen(function* () {
        const stat = yield* fs.stat(filePath);

        if (stat.type !== "File") {
          return NOT_A_FILE;
        }

        const relativePath = path.relative(lessonPath, filePath);
        const imageExtensions = [
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".svg",
          ".webp",
          ".bmp",
        ];
        const isImage = imageExtensions.some((ext) => filePath.endsWith(ext));

        if (isImage) {
          const fileContent = yield* fs.readFile(filePath);
          return {
            type: "image" as const,
            path: relativePath,
            content: fileContent,
          };
        } else {
          const fileContent = yield* fs.readFileString(filePath);
          return {
            type: "text" as const,
            filePath,
            fileContent,
          };
        }
      });
    }).pipe(Effect.map(Array.filter((r) => r !== NOT_A_FILE)));

    const textFiles = allFiles
      .filter((f) => f.type === "text")
      .map((f) => ({
        path: f.filePath,
        content: f.fileContent,
      }));

    const imageFiles = allFiles
      .filter((f) => f.type === "image")
      .map((f) => ({
        path: f.path,
        content: f.content,
      }));

    const includeTranscript = props.includeTranscript ?? true;
    const transcript = includeTranscript
      ? video.clips
          .map((clip) => clip.text)
          .join(" ")
          .trim()
      : "";

    return {
      textFiles,
      imageFiles,
      transcript,
      sectionPath: section.path,
      lessonPath: lesson.path,
    };
  }
);
