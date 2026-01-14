import { generateArticlePrompt } from "@/prompts/generate-article";
import { generateStepsToCompleteForProjectPrompt } from "@/prompts/generate-steps-to-complete-for-project";
import { generateStepsToCompleteForSkillBuildingProblemPrompt } from "@/prompts/generate-steps-to-complete-for-skill-building-problem";
import { refineSkillBuildingWithStyleGuidePrompt } from "@/prompts/refine-skill-building-with-style-guide";
import { refineProjectWithStyleGuidePrompt } from "@/prompts/refine-project-with-style-guide";
import { generateSeoDescriptionPrompt } from "@/prompts/generate-seo-description";
import { generateYoutubeTitlePrompt } from "@/prompts/generate-youtube-title";
import { generateYoutubeThumbnailPrompt } from "@/prompts/generate-youtube-thumbnail";
import { generateYoutubeDescriptionPrompt } from "@/prompts/generate-youtube-description";
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
import { formatSecondsToTimeCode } from "./utils";

const NOT_A_FILE = Symbol("NOT_A_FILE");

export type TextWritingAgentMode =
  | "article"
  | "skill-building"
  | "style-guide-skill-building"
  | "style-guide-project"
  | "project"
  | "seo-description"
  | "youtube-title"
  | "youtube-thumbnail"
  | "youtube-description";

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
  youtubeChapters?: { timestamp: string; name: string }[];
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
      case "seo-description":
        return generateSeoDescriptionPrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "youtube-title":
        return generateYoutubeTitlePrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "youtube-thumbnail":
        return generateYoutubeThumbnailPrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
        });
      case "youtube-description":
        return generateYoutubeDescriptionPrompt({
          code: props.code,
          transcript: props.transcript,
          images: props.imageFiles.map((file) => file.path),
          youtubeChapters: props.youtubeChapters || [],
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
  function* (props: { videoId: string; enabledFiles: string[] | undefined; includeTranscript?: boolean; enabledSections?: string[] }) {
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

    // Build transcript with section filtering
    let transcript = "";
    if (includeTranscript) {
      const enabledSectionIds = new Set(props.enabledSections ?? []);
      const allSectionsEnabled = enabledSectionIds.size === 0 || (props.enabledSections?.length === 0 && video.clipSections.length === 0);

      // Combine clips and clip sections, sort by order (ASCII ordering to match PostgreSQL COLLATE "C")
      const allItems = [
        ...video.clips.map((clip) => ({ type: "clip" as const, order: clip.order, clip })),
        ...video.clipSections.map((section) => ({ type: "clip-section" as const, order: section.order, section })),
      ].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));

      // Build formatted transcript with sections as H2 headers
      const transcriptParts: string[] = [];
      let currentParagraph: string[] = [];
      let currentSectionEnabled = allSectionsEnabled; // If no sections exist, include clips before first section

      for (const item of allItems) {
        if (item.type === "clip-section") {
          // Flush current paragraph before starting a new section
          if (currentParagraph.length > 0 && currentSectionEnabled) {
            transcriptParts.push(currentParagraph.join(" "));
            currentParagraph = [];
          } else {
            currentParagraph = [];
          }

          // Check if this section is enabled
          currentSectionEnabled = allSectionsEnabled || enabledSectionIds.has(item.section.id);

          // Add section as H2 header if enabled
          if (currentSectionEnabled) {
            transcriptParts.push(`## ${item.section.name}`);
          }
        } else if (item.clip.text && currentSectionEnabled) {
          currentParagraph.push(item.clip.text);
        }
      }

      // Flush remaining paragraph
      if (currentParagraph.length > 0 && currentSectionEnabled) {
        transcriptParts.push(currentParagraph.join(" "));
      }

      transcript = transcriptParts.join("\n\n").trim();
    }

    // Calculate YouTube chapters from clip sections
    const youtubeChapters: { timestamp: string; name: string }[] = [];
    let cumulativeDuration = 0;

    // Combine clips and clip sections, sort by order (ASCII ordering to match PostgreSQL COLLATE "C")
    const allItems = [
      ...video.clips.map((clip) => ({ type: "clip" as const, order: clip.order, clip })),
      ...video.clipSections.map((section) => ({ type: "clip-section" as const, order: section.order, section })),
    ].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));

    for (const item of allItems) {
      if (item.type === "clip-section") {
        // Record the timestamp at the start of this clip section
        youtubeChapters.push({
          timestamp: formatSecondsToTimeCode(cumulativeDuration),
          name: item.section.name,
        });
      } else if (item.type === "clip") {
        // Add the clip's duration to cumulative total
        cumulativeDuration += item.clip.sourceEndTime - item.clip.sourceStartTime;
      }
    }

    return {
      textFiles,
      imageFiles,
      transcript,
      sectionPath: section.path,
      lessonPath: lesson.path,
      youtubeChapters,
    };
  }
);
