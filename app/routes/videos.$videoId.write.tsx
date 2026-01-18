"use client";

import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import type {
  SectionWithWordCount,
  Mode,
  Model,
} from "@/features/article-writer/types";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  AIConversation,
  AIConversationContent,
  AIConversationScrollButton,
} from "components/ui/kibo-ui/ai/conversation";
import {
  AIInput,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
} from "components/ui/kibo-ui/ai/input";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessage, AIMessageContent } from "components/ui/kibo-ui/ai/message";
import { AIResponse } from "components/ui/kibo-ui/ai/response";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Array as EffectArray, Console, Effect } from "effect";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDown,
  CopyIcon,
  SaveIcon,
  CheckIcon,
  PlusIcon,
  FilmIcon,
  FileTextIcon,
  ListChecksIcon,
  GraduationCapIcon,
  RefreshCwIcon,
  SearchIcon,
  VideoIcon,
  ImageIcon,
  AlignLeftIcon,
  ClipboardIcon,
  MailIcon,
  AlertTriangleIcon,
  MicIcon,
  LightbulbIcon,
  ListTreeIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { data, Link, useFetcher, useRevalidator } from "react-router";
import type { Route } from "./+types/videos.$videoId.write";
import path from "path";
import { FileSystem } from "@effect/platform";
import { FileTree } from "@/components/FileTree";
import { StandaloneFileTree } from "@/components/StandaloneFileTree";
import { StandaloneFileManagementModal } from "@/components/standalone-file-management-modal";
import { StandaloneFilePasteModal } from "@/components/standalone-file-paste-modal";
import { DeleteStandaloneFileModal } from "@/components/delete-standalone-file-modal";
import { LessonFilePasteModal } from "@/components/lesson-file-paste-modal";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { useLint } from "@/hooks/use-lint";
import {
  ALWAYS_EXCLUDED_DIRECTORIES,
  DEFAULT_CHECKED_EXTENSIONS,
  DEFAULT_UNCHECKED_PATHS,
} from "@/services/text-writing-agent";
import { getStandaloneVideoFilePath } from "@/services/standalone-video-files";

const partsToText = (parts: UIMessage["parts"]) => {
  return parts
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("");
};

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;
  return Effect.gen(function* () {
    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;
    const video = yield* db.getVideoWithClipsById(videoId);

    const lesson = video.lesson;

    // Build transcript from clips and clip sections
    // Combine and sort clips and clip sections by order (ASCII ordering to match PostgreSQL COLLATE "C")
    type ClipItem = { type: "clip"; order: string; text: string | null };
    type ClipSectionItem = {
      type: "clip-section";
      order: string;
      name: string;
    };

    const clipItems: ClipItem[] = video.clips.map((clip) => ({
      type: "clip" as const,
      order: clip.order,
      text: clip.text,
    }));

    const clipSectionItems: ClipSectionItem[] = video.clipSections.map(
      (section) => ({
        type: "clip-section" as const,
        order: section.order,
        name: section.name,
      })
    );

    const sortedItems = [...clipItems, ...clipSectionItems].sort((a, b) =>
      a.order < b.order ? -1 : a.order > b.order ? 1 : 0
    );

    // Build formatted transcript with sections as H2 headers
    const transcriptParts: string[] = [];
    let currentParagraph: string[] = [];

    for (const item of sortedItems) {
      if (item.type === "clip-section") {
        // Flush current paragraph before starting a new section
        if (currentParagraph.length > 0) {
          transcriptParts.push(currentParagraph.join(" "));
          currentParagraph = [];
        }
        // Add section as H2 header
        transcriptParts.push(`## ${item.name}`);
      } else if (item.text) {
        currentParagraph.push(item.text);
      }
    }

    // Flush remaining paragraph
    if (currentParagraph.length > 0) {
      transcriptParts.push(currentParagraph.join(" "));
    }

    const transcript = transcriptParts.join("\n\n").trim();
    const transcriptWordCount = transcript ? transcript.split(/\s+/).length : 0;

    // Calculate word count per section
    const sectionsWithWordCount: SectionWithWordCount[] = [];
    let currentSectionIndex = -1;

    for (const item of sortedItems) {
      if (item.type === "clip-section") {
        // Start tracking a new section
        const section = video.clipSections.find((s) => s.order === item.order);
        if (section) {
          currentSectionIndex = sectionsWithWordCount.length;
          sectionsWithWordCount.push({
            id: section.id,
            name: item.name,
            order: item.order,
            wordCount: 0,
          });
        }
      } else if (item.text && currentSectionIndex >= 0) {
        // Add this clip's word count to the current section
        const wordCount = item.text.split(/\s+/).length;
        sectionsWithWordCount[currentSectionIndex]!.wordCount += wordCount;
      }
    }

    // For standalone videos (no lesson), fetch standalone video files
    if (!lesson) {
      const nextVideoId = yield* db.getNextVideoId(videoId);
      const previousVideoId = yield* db.getPreviousVideoId(videoId);

      // Get the standalone video files directory
      const standaloneVideoDir = getStandaloneVideoFilePath(videoId);

      // Check if directory exists
      const dirExists = yield* fs.exists(standaloneVideoDir);

      let standaloneFiles: Array<{
        path: string;
        size: number;
        defaultEnabled: boolean;
      }> = [];

      if (dirExists) {
        // Read all files from the standalone video directory
        const filesInDirectory = yield* fs.readDirectory(standaloneVideoDir);

        standaloneFiles = yield* Effect.forEach(
          filesInDirectory,
          (filename) => {
            return Effect.gen(function* () {
              const filePath = getStandaloneVideoFilePath(videoId, filename);
              const stat = yield* fs.stat(filePath);

              if (stat.type !== "File") {
                return null;
              }

              const extension = path.extname(filename).slice(1);
              const defaultEnabled =
                DEFAULT_CHECKED_EXTENSIONS.includes(extension);

              return {
                path: filename,
                size: Number(stat.size),
                defaultEnabled,
              };
            });
          }
        ).pipe(Effect.map(EffectArray.filter((f) => f !== null)));
      }

      return {
        videoPath: video.path,
        lessonPath: null,
        sectionPath: null,
        repoId: null,
        lessonId: null,
        fullPath: null,
        files: standaloneFiles,
        nextVideoId,
        previousVideoId,
        isStandalone: true,
        transcriptWordCount,
        clipSections: sectionsWithWordCount,
      };
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
      return !ALWAYS_EXCLUDED_DIRECTORIES.some((excludedDir) =>
        filePath.includes(excludedDir)
      );
    });

    const filesWithMetadata = yield* Effect.forEach(
      filteredFiles,
      (filePath) => {
        return Effect.gen(function* () {
          const stat = yield* fs.stat(filePath);

          if (stat.type !== "File") {
            return null;
          }

          const relativePath = path.relative(lessonPath, filePath);
          const extension = path.extname(filePath).slice(1);

          const defaultEnabled =
            DEFAULT_CHECKED_EXTENSIONS.includes(extension) &&
            !DEFAULT_UNCHECKED_PATHS.some((uncheckedPath) =>
              relativePath.toLowerCase().includes(uncheckedPath.toLowerCase())
            );

          return {
            path: relativePath,
            size: Number(stat.size),
            defaultEnabled,
          };
        });
      }
    ).pipe(Effect.map(EffectArray.filter((f) => f !== null)));

    const nextVideoId = yield* db.getNextVideoId(videoId);
    const previousVideoId = yield* db.getPreviousVideoId(videoId);

    return {
      videoPath: video.path,
      lessonPath: lesson.path,
      sectionPath: section.path,
      repoId: section.repoVersion.repoId,
      lessonId: lesson.id,
      fullPath: lessonPath,
      files: filesWithMetadata,
      nextVideoId,
      previousVideoId,
      isStandalone: false,
      transcriptWordCount,
      clipSections: sectionsWithWordCount,
    };
  }).pipe(
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

const Video = (props: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.playbackRate = 2;
    }
  }, [props.src, ref.current]);

  return <video src={props.src} className="w-full" controls ref={ref} />;
};

const modeToLabel: Record<Mode, string> = {
  article: "Article",
  "article-plan": "Article Plan",
  project: "Project Steps",
  "skill-building": "Skill Building Steps",
  "style-guide-skill-building": "Style Guide Pass - Skill Building",
  "style-guide-project": "Style Guide Pass - Project",
  "seo-description": "SEO Description",
  "youtube-title": "YouTube Title",
  "youtube-thumbnail": "YouTube Thumbnail",
  "youtube-description": "YouTube Description",
  newsletter: "Newsletter",
  interview: "Interview Me",
  brainstorming: "Brainstorming",
};

const MODE_STORAGE_KEY = "article-writer-mode";
const MODEL_STORAGE_KEY = "article-writer-model";

export function InnerComponent(props: Route.ComponentProps) {
  const { videoId } = props.params;
  const {
    videoPath,
    lessonPath,
    sectionPath,
    repoId,
    lessonId,
    fullPath,
    files,
    nextVideoId,
    previousVideoId,
    isStandalone,
    transcriptWordCount,
    clipSections,
  } = props.loaderData;
  const [text, setText] = useState<string>("");
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      return (saved as Mode) || "article";
    }
    return "article";
  });
  const [model, setModel] = useState<Model>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      return (saved as Model) || "claude-haiku-4-5";
    }
    return "claude-haiku-4-5";
  });
  const [enabledFiles, setEnabledFiles] = useState<Set<string>>(() => {
    // If mode is style-guide-skill-building, only enable README.md files
    if (mode === "style-guide-skill-building") {
      return new Set(
        files
          .filter((f) => f.path.toLowerCase().endsWith("readme.md"))
          .map((f) => f.path)
      );
    }
    return new Set(files.filter((f) => f.defaultEnabled).map((f) => f.path));
  });
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [enabledSections, setEnabledSections] = useState<Set<string>>(() => {
    // By default, all sections are enabled
    return new Set(clipSections.map((s) => s.id));
  });

  // Check if explainer or problem folder exists
  const hasExplainerOrProblem = files.some(
    (f) => f.path.startsWith("explainer/") || f.path.startsWith("problem/")
  );

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    }

    // If switching to style-guide mode, only enable README.md files
    if (newMode === "style-guide-skill-building") {
      setEnabledFiles(
        new Set(
          files
            .filter((f) => f.path.toLowerCase().endsWith("readme.md"))
            .map((f) => f.path)
        )
      );
    }
  };

  const handleModelChange = (newModel: Model) => {
    setModel(newModel);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MODEL_STORAGE_KEY, newModel);
    }
  };

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/videos/${videoId}/completions`,
    }),
  });

  const writeToReadmeFetcher = useFetcher();
  const [isCopied, setIsCopied] = useState(false);
  const revalidator = useRevalidator();

  // Standalone file management state
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState<string>("");
  const [selectedFileContent, setSelectedFileContent] = useState<string>("");
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string>("");

  // Lesson file paste modal state
  const [isLessonPasteModalOpen, setIsLessonPasteModalOpen] = useState(false);

  // File preview modal state
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFilePath, setPreviewFilePath] = useState<string>("");

  // Get last assistant message
  const lastAssistantMessage = messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant");
  const lastAssistantMessageText = lastAssistantMessage
    ? partsToText(lastAssistantMessage.parts)
    : "";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(lastAssistantMessageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  // Format conversation history as Q&A for interview mode
  const formatConversationAsQA = () => {
    const qaMessages: string[] = [];

    for (const message of messages) {
      const text = partsToText(message.parts);
      if (!text) continue;

      if (message.role === "assistant") {
        qaMessages.push(`Q: ${text}`);
      } else if (message.role === "user") {
        qaMessages.push(`A: ${text}`);
      }
    }

    return qaMessages.join("\n\n");
  };

  const copyConversationHistory = async () => {
    try {
      const qaText = formatConversationAsQA();
      await navigator.clipboard.writeText(qaText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy conversation history:", error);
    }
  };

  // Lint hook for checking violations in real-time
  const { violations, composeFixMessage } = useLint(
    lastAssistantMessageText,
    mode
  );

  const handleFixLintViolations = () => {
    const fixMessage = composeFixMessage();
    if (fixMessage) {
      const transcriptEnabled =
        clipSections.length > 0 ? enabledSections.size > 0 : includeTranscript;

      sendMessage(
        { text: fixMessage },
        {
          body: {
            enabledFiles: Array.from(enabledFiles),
            mode,
            model,
            includeTranscript: transcriptEnabled,
            enabledSections: Array.from(enabledSections),
          },
        }
      );
    }
  };

  const writeToReadme = (mode: "write" | "append") => {
    writeToReadmeFetcher.submit(
      { lessonId, content: lastAssistantMessageText, mode },
      {
        method: "POST",
        action: "/api/write-readme",
        encType: "application/json",
      }
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // When sections exist, derive includeTranscript from enabledSections
    const transcriptEnabled =
      clipSections.length > 0 ? enabledSections.size > 0 : includeTranscript;

    sendMessage(
      { text: text.trim() || "Go" },
      {
        body: {
          enabledFiles: Array.from(enabledFiles),
          mode,
          model,
          includeTranscript: transcriptEnabled,
          enabledSections: Array.from(enabledSections),
        },
      }
    );

    setText("");
  };

  const handleEditFile = async (filename: string) => {
    // Fetch file content
    try {
      const response = await fetch(
        `/api/standalone-files/read?videoId=${videoId}&filename=${encodeURIComponent(filename)}`
      );
      if (response.ok) {
        const content = await response.text();
        setSelectedFilename(filename);
        setSelectedFileContent(content);
        setIsFileModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  };

  const handleDeleteFile = (filename: string) => {
    setFileToDelete(filename);
    setIsDeleteModalOpen(true);
  };

  const handleFileModalClose = (open: boolean) => {
    setIsFileModalOpen(open);
    if (!open) {
      // Revalidate to refresh the file list
      revalidator.revalidate();
    }
  };

  const handlePasteModalClose = (open: boolean) => {
    setIsPasteModalOpen(open);
    if (!open) {
      // Revalidate to refresh the file list
      revalidator.revalidate();
    }
  };

  const handleStandaloneFileCreated = (filename: string) => {
    // Automatically add newly created file to context
    setEnabledFiles((prev) => new Set([...prev, filename]));
  };

  const handleDeleteModalClose = (open: boolean) => {
    setIsDeleteModalOpen(open);
    if (!open) {
      // Revalidate to refresh the file list
      revalidator.revalidate();
    }
  };

  const handleLessonPasteModalClose = (open: boolean) => {
    setIsLessonPasteModalOpen(open);
    if (!open) {
      // Revalidate to refresh the file list
      revalidator.revalidate();
    }
  };

  const handleLessonFileCreated = (filename: string) => {
    // Automatically add newly created file to context
    setEnabledFiles((prev) => new Set([...prev, filename]));
  };

  const handleFileClick = (filePath: string) => {
    setPreviewFilePath(filePath);
    setIsPreviewModalOpen(true);
  };

  const handlePreviewModalClose = (open: boolean) => {
    setIsPreviewModalOpen(open);
    if (!open) {
      setPreviewFilePath("");
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to={isStandalone ? "/" : `/?repoId=${repoId}#${lessonId}`}>
              <ChevronLeftIcon className="size-6" />
            </Link>
          </Button>
          <h1 className="text-lg">
            {isStandalone
              ? videoPath
              : `${sectionPath}/${lessonPath}/${videoPath}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/videos/${videoId}/edit`}>
              <FilmIcon className="size-4 mr-1" />
              Edit Video
            </Link>
          </Button>
          {previousVideoId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/videos/${previousVideoId}/write`}>
                <ChevronLeftIcon className="size-4 mr-1" />
                Previous
              </Link>
            </Button>
          ) : null}
          {nextVideoId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/videos/${nextVideoId}/write`}>
                Next
                <ChevronRightIcon className="size-4 ml-1" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Video and Transcript/Files */}
        <div className="w-1/4 border-r overflow-y-auto p-4 space-y-4 scrollbar scrollbar-track-transparent scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
          <Video src={`/videos/${videoId}`} />
          <div className="flex items-center gap-2 py-1 px-2">
            <Checkbox
              id="include-transcript"
              checked={
                clipSections.length > 0
                  ? enabledSections.size === clipSections.length
                    ? true
                    : enabledSections.size > 0
                      ? "indeterminate"
                      : false
                  : includeTranscript
              }
              onCheckedChange={(checked) => {
                if (clipSections.length > 0) {
                  // If sections exist, toggle all sections
                  if (checked) {
                    setEnabledSections(new Set(clipSections.map((s) => s.id)));
                  } else {
                    setEnabledSections(new Set());
                  }
                } else {
                  // If no sections, just toggle transcript
                  setIncludeTranscript(!!checked);
                }
              }}
            />
            <label
              htmlFor="include-transcript"
              className="text-sm flex-1 cursor-pointer"
            >
              Transcript
            </label>
            <span className="text-xs text-muted-foreground">
              ({transcriptWordCount.toLocaleString()} words)
            </span>
          </div>
          {/* Section checkboxes - only show when sections exist */}
          {clipSections.length > 0 && (
            <div className="shrink-0">
              <ScrollArea className="h-48">
                <div className="space-y-1 px-2">
                  {clipSections.map((section) => (
                    <div
                      key={section.id}
                      className="flex items-center gap-2 py-1 pl-6"
                    >
                      <Checkbox
                        id={`section-${section.id}`}
                        checked={enabledSections.has(section.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(enabledSections);
                          if (checked) {
                            newSet.add(section.id);
                          } else {
                            newSet.delete(section.id);
                          }
                          setEnabledSections(newSet);
                        }}
                      />
                      <label
                        htmlFor={`section-${section.id}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {section.name}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        ({section.wordCount.toLocaleString()} words)
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
          {/* File tree - only show for lesson-connected videos */}
          {!isStandalone && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1 px-2">
                <Checkbox
                  id="include-files"
                  checked={
                    files.length === 0
                      ? false
                      : enabledFiles.size === files.length
                        ? true
                        : enabledFiles.size > 0
                          ? "indeterminate"
                          : false
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEnabledFiles(new Set(files.map((f) => f.path)));
                    } else {
                      setEnabledFiles(new Set());
                    }
                  }}
                />
                <label
                  htmlFor="include-files"
                  className="text-sm flex-1 cursor-pointer"
                >
                  Files
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => setIsLessonPasteModalOpen(true)}
                >
                  <ClipboardIcon className="h-3 w-3 mr-1" />
                  Add from Clipboard
                </Button>
              </div>
              <FileTree
                files={files}
                enabledFiles={enabledFiles}
                onEnabledFilesChange={setEnabledFiles}
                onFileClick={handleFileClick}
              />
            </div>
          )}
          {/* Standalone file tree with management UI */}
          {isStandalone && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-1 px-2">
                <Checkbox
                  id="include-standalone-files"
                  checked={
                    files.length === 0
                      ? false
                      : enabledFiles.size === files.length
                        ? true
                        : enabledFiles.size > 0
                          ? "indeterminate"
                          : false
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEnabledFiles(new Set(files.map((f) => f.path)));
                    } else {
                      setEnabledFiles(new Set());
                    }
                  }}
                />
                <label
                  htmlFor="include-standalone-files"
                  className="text-sm flex-1 cursor-pointer"
                >
                  Files
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => setIsPasteModalOpen(true)}
                >
                  <ClipboardIcon className="h-3 w-3 mr-1" />
                  Add from Clipboard
                </Button>
              </div>
              <StandaloneFileTree
                files={files}
                enabledFiles={enabledFiles}
                onEnabledFilesChange={setEnabledFiles}
                onEditFile={handleEditFile}
                onDeleteFile={handleDeleteFile}
                onFileClick={handleFileClick}
              />
            </div>
          )}
        </div>

        {/* Right column: Chat */}
        <div className="w-3/4 flex flex-col">
          <AIConversation className="flex-1 overflow-y-auto scrollbar scrollbar-track-transparent scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
            <AIConversationContent className="max-w-2xl mx-auto">
              {error && (
                <Card className="p-4 mb-4 border-red-500 bg-red-50 dark:bg-red-950">
                  <div className="flex items-start gap-2">
                    <div className="text-red-500 font-semibold">Error:</div>
                    <div className="text-red-700 dark:text-red-300 flex-1">
                      {error.message}
                    </div>
                  </div>
                </Card>
              )}
              {messages.map((message) => {
                if (message.role === "system") {
                  return null;
                }

                if (message.role === "user") {
                  return (
                    <AIMessage from={message.role} key={message.id}>
                      <AIMessageContent>
                        {partsToText(message.parts)}
                      </AIMessageContent>
                    </AIMessage>
                  );
                }

                return (
                  <AIMessage from={message.role} key={message.id}>
                    <AIResponse imageBasePath={fullPath ?? ""}>
                      {partsToText(message.parts)}
                    </AIResponse>
                  </AIMessage>
                );
              })}
            </AIConversationContent>
            <AIConversationScrollButton />
          </AIConversation>
          <div className="border-t p-4 bg-background">
            <div className="max-w-2xl mx-auto">
              <div className="mb-4 flex gap-2 items-center">
                <Select
                  value={mode}
                  onValueChange={(value) => handleModeChange(value as Mode)}
                >
                  <SelectTrigger>{modeToLabel[mode]}</SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">
                      <div className="flex items-start gap-2">
                        <FileTextIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Article</div>
                          <div className="text-xs text-muted-foreground">
                            Educational content and explanations
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="article-plan">
                      <div className="flex items-start gap-2">
                        <ListTreeIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Article Plan</div>
                          <div className="text-xs text-muted-foreground">
                            Plan article structure with concise bullet points
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="project">
                      <div className="flex items-start gap-2">
                        <ListChecksIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Steps - Project</div>
                          <div className="text-xs text-muted-foreground">
                            Write steps for project
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="skill-building">
                      <div className="flex items-start gap-2">
                        <GraduationCapIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Steps - Skill Building</div>
                          <div className="text-xs text-muted-foreground">
                            Write steps for skill building problem
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="style-guide-skill-building">
                      <div className="flex items-start gap-2">
                        <RefreshCwIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Style Guide Pass - Skill Building</div>
                          <div className="text-xs text-muted-foreground">
                            Refine existing skill-building steps with style
                            guide
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="style-guide-project">
                      <div className="flex items-start gap-2">
                        <RefreshCwIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Style Guide Pass - Project</div>
                          <div className="text-xs text-muted-foreground">
                            Refine existing project steps with style guide
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="seo-description">
                      <div className="flex items-start gap-2">
                        <SearchIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>SEO Description</div>
                          <div className="text-xs text-muted-foreground">
                            Generate SEO description (max 160 characters)
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="youtube-title">
                      <div className="flex items-start gap-2">
                        <VideoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>YouTube Title</div>
                          <div className="text-xs text-muted-foreground">
                            Generate engaging YouTube video title
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="youtube-thumbnail">
                      <div className="flex items-start gap-2">
                        <ImageIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>YouTube Thumbnail</div>
                          <div className="text-xs text-muted-foreground">
                            Generate YouTube thumbnail description
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="youtube-description">
                      <div className="flex items-start gap-2">
                        <AlignLeftIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>YouTube Description</div>
                          <div className="text-xs text-muted-foreground">
                            Generate YouTube video description with timestamps
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="newsletter">
                      <div className="flex items-start gap-2">
                        <MailIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Newsletter</div>
                          <div className="text-xs text-muted-foreground">
                            Generate friendly newsletter preview for AI Hero
                            audience
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="interview">
                      <div className="flex items-start gap-2">
                        <MicIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Interview Me</div>
                          <div className="text-xs text-muted-foreground">
                            Get interviewed about the topic to generate content
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="brainstorming">
                      <div className="flex items-start gap-2">
                        <LightbulbIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div>Brainstorming</div>
                          <div className="text-xs text-muted-foreground">
                            Explore and develop ideas with an AI facilitator
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={model}
                  onValueChange={(value) => handleModelChange(value as Model)}
                >
                  <SelectTrigger>
                    {model === "claude-sonnet-4-5" ? "Sonnet 4.5" : "Haiku 4.5"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-haiku-4-5">
                      <div>
                        <div>Haiku 4.5</div>
                        <div className="text-xs text-muted-foreground">
                          Fast and cost-effective
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude-sonnet-4-5">
                      <div>
                        <div>Sonnet 4.5</div>
                        <div className="text-xs text-muted-foreground">
                          More capable and thorough
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {mode === "interview" || mode === "brainstorming" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          status === "streaming" || messages.length === 0
                        }
                      >
                        {isCopied ? (
                          <>
                            <CheckIcon className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <CopyIcon className="h-4 w-4 mr-1" />
                            Copy
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={copyConversationHistory}>
                        Copy Conversation History
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={copyToClipboard}
                        disabled={!lastAssistantMessageText}
                      >
                        Copy Last Message
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={
                      status === "streaming" || !lastAssistantMessageText
                    }
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
                {/* Lint Fix button - shows when violations detected */}
                {violations.length > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleFixLintViolations}
                          disabled={status === "streaming"}
                        >
                          <AlertTriangleIcon className="h-4 w-4 mr-1 text-orange-500" />
                          Fix ({violations.reduce((sum, v) => sum + v.count, 0)}
                          )
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">Lint Violations:</p>
                          {violations.map((v) => (
                            <p key={v.rule.id} className="text-sm">
                              • {v.rule.name}: {v.count} issue
                              {v.count > 1 ? "s" : ""}
                            </p>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* README dropdown - hidden for standalone videos */}
                {!isStandalone && (
                  <DropdownMenu>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  !hasExplainerOrProblem ||
                                  status === "streaming" ||
                                  writeToReadmeFetcher.state === "submitting" ||
                                  writeToReadmeFetcher.state === "loading" ||
                                  !lastAssistantMessageText
                                }
                              >
                                {writeToReadmeFetcher.state === "submitting" ||
                                writeToReadmeFetcher.state === "loading" ? (
                                  <>
                                    <SaveIcon className="h-4 w-4 mr-1" />
                                    Writing...
                                  </>
                                ) : (
                                  <>
                                    <SaveIcon className="h-4 w-4 mr-1" />
                                    Readme
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                          </span>
                        </TooltipTrigger>
                        {!hasExplainerOrProblem && (
                          <TooltipContent>
                            <p>No explainer or problem folder</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => writeToReadme("write")}>
                        <SaveIcon className="h-4 w-4 mr-2" />
                        <div className="flex flex-col">
                          <span className="font-medium">Write to README</span>
                          <span className="text-xs text-muted-foreground">
                            Replace existing content
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => writeToReadme("append")}
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        <div className="flex flex-col">
                          <span className="font-medium">Append to README</span>
                          <span className="text-xs text-muted-foreground">
                            Add to end of existing content
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <AIInput onSubmit={handleSubmit}>
                <AIInputTextarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What would you like to create?"
                />
                <AIInputToolbar>
                  <AIInputSubmit status={status} />
                </AIInputToolbar>
              </AIInput>
            </div>
          </div>
        </div>
      </div>
      {/* Standalone file modals */}
      {isStandalone && (
        <>
          <StandaloneFileManagementModal
            videoId={videoId}
            filename={selectedFilename}
            content={selectedFileContent}
            open={isFileModalOpen}
            onOpenChange={handleFileModalClose}
          />
          <StandaloneFilePasteModal
            videoId={videoId}
            open={isPasteModalOpen}
            onOpenChange={handlePasteModalClose}
            existingFiles={files}
            onFileCreated={handleStandaloneFileCreated}
          />
          <DeleteStandaloneFileModal
            videoId={videoId}
            filename={fileToDelete}
            open={isDeleteModalOpen}
            onOpenChange={handleDeleteModalClose}
          />
        </>
      )}
      {/* Lesson file modals */}
      {!isStandalone && (
        <LessonFilePasteModal
          videoId={videoId}
          open={isLessonPasteModalOpen}
          onOpenChange={handleLessonPasteModalClose}
          existingFiles={files}
          onFileCreated={handleLessonFileCreated}
        />
      )}
      {/* File preview modal */}
      <FilePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => handlePreviewModalClose(false)}
        videoId={videoId}
        filePath={previewFilePath}
        isStandalone={isStandalone}
      />
    </div>
  );
}

export default function Component(props: Route.ComponentProps) {
  return <InnerComponent {...props} key={props.params.videoId} />;
}
