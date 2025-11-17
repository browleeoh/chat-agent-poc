"use client";

import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
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
import { AIMessage, AIMessageContent } from "components/ui/kibo-ui/ai/message";
import { AIResponse } from "components/ui/kibo-ui/ai/response";
import {
  AISuggestion,
  AISuggestions,
} from "components/ui/kibo-ui/ai/suggestion";
import { Array as EffectArray, Effect } from "effect";
import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/videos.$videoId.write";
import path from "path";
import { FileSystem } from "@effect/platform";
import {
  ALWAYS_EXCLUDED_DIRECTORIES,
  DEFAULT_CHECKED_EXTENSIONS,
  DEFAULT_UNCHECKED_PATHS,
} from "./videos.$videoId.completions";
import { FileTree } from "@/components/FileTree";

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
      return !ALWAYS_EXCLUDED_DIRECTORIES.some((excludedDir) =>
        filePath.includes(excludedDir)
      );
    });

    const filesWithMetadata = yield* Effect.forEach(filteredFiles, (filePath) => {
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
    }).pipe(Effect.map(EffectArray.filter((f) => f !== null)));

    return {
      videoPath: video.path,
      lessonPath: lesson.path,
      sectionPath: section.path,
      repoId: video.lesson.section.repoId,
      lessonId: video.lesson.id,
      fullPath: lessonPath,
      files: filesWithMetadata,
    };
  }).pipe(Effect.provide(layerLive), Effect.runPromise);
};

const PROBLEM_PROMPT = () =>
  `
Go.

## Problem Code

Show COPIOUS examples of the problem code. Show the TODO's in the code so the user can navigate to the correct location.

## Solution Code

Do NOT refer to the solution code in the steps. Do not reveal the exact solution - just describe the problem they need to solve. Do not attempt to solve the problem for the user.

The purpose of this material is to help the user solve the problem.

## Steps To Complete Instructions

At the end of the output, add a list of steps to complete to solve the problem.

Include steps to test whether the problem has been solved, such as logging in the terminal (running the exercise via \`pnpm run dev\`), observing the local dev server at localhost:3000, or checking the browser console.

This should be in the format of checkboxes. Only the top level steps should be checkboxes. You can can use nested lists, but they should not be checkboxes.

Each top-level step should be separated by two newlines.

<example>

## Steps To Complete

- [ ] <A description of the step to take>
  - <some substep>

- [ ] <A description of the step to take>

- [ ] <A description of the step to take>
  - <some substep>
  - <some substep>

</example>
`.trim();

const CODE_TIP_PROMPT = () =>
  `
  Go.

  <rules>

  The purpose of the material is to show a user a cool tip that will help them in the future. They are not solving a problem in an active exercise, they are passively learning a tip.

  Stick closely to the transcript. Use copious code examples.

  The code samples shown should mirror the order in the transcript.

  </rules>
`.trim();

const DIAGRAM_TIP_PROMPT = () =>
  `
  Go.

  <rules>

  The purpose of the material is to show a user a cool tip that will help them in the future. They are not solving a problem in an active exercise, they are passively learning a tip.

  Stick closely to the transcript.

  The video the transcript is based on is of an instructor walking through diagrams. You have been provided with the diagrams. Use them as markdown links in the output:

  <example>
  ![Diagram 1](./path/to/diagram.png)
  </example>
  <example>
  ![Diagram 2](./path/to/diagram.png)
  </example>

  </rules>
  `.trim();

const Video = (props: { src: string }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.playbackRate = 2;
    }
  }, [props.src, ref.current]);

  return <video src={props.src} className="w-full" controls ref={ref} />;
};

export default function Component(props: Route.ComponentProps) {
  const { videoId } = props.params;
  const { videoPath, lessonPath, sectionPath, repoId, lessonId, fullPath, files } =
    props.loaderData;
  const [text, setText] = useState<string>("");
  const [enabledFiles, setEnabledFiles] = useState<Set<string>>(() => {
    return new Set(files.filter((f) => f.defaultEnabled).map((f) => f.path));
  });

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/videos/${videoId}/completions`,
    }),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(
      { text },
      { body: { enabledFiles: Array.from(enabledFiles) } }
    );

    setText("");
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/?repoId=${repoId}#${lessonId}`}>
            <ChevronLeftIcon className="size-6" />
          </Link>
        </Button>
        <h1 className="text-lg">
          {sectionPath}/{lessonPath}/{videoPath}
        </h1>
      </div>
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: Video and Files */}
        <div className="w-1/4 border-r overflow-y-auto p-4 space-y-4">
          <Video src={`/videos/${videoId}`} />
          <FileTree
            files={files}
            enabledFiles={enabledFiles}
            onEnabledFilesChange={setEnabledFiles}
          />
        </div>

        {/* Right column: Chat */}
        <div className="w-3/4 flex flex-col">
          <AIConversation className="flex-1 overflow-y-auto">
            <AIConversationContent className="max-w-2xl mx-auto">
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
                    <AIResponse imageBasePath={fullPath}>
                      {partsToText(message.parts)}
                    </AIResponse>
                  </AIMessage>
                );
              })}
            </AIConversationContent>
            <AIConversationScrollButton />
          </AIConversation>
          <div className="border-t p-4">
            <div className="max-w-2xl mx-auto">
              <AISuggestions className="mb-4">
                <AISuggestion
                  suggestion="Problem Description"
                  onClick={() => {
                    sendMessage(
                      { text: PROBLEM_PROMPT() },
                      { body: { enabledFiles: Array.from(enabledFiles) } }
                    );
                  }}
                ></AISuggestion>
                <AISuggestion
                  suggestion="Code Tip"
                  onClick={() => {
                    sendMessage(
                      { text: CODE_TIP_PROMPT() },
                      { body: { enabledFiles: Array.from(enabledFiles) } }
                    );
                  }}
                ></AISuggestion>
                <AISuggestion
                  suggestion="Diagram Tip"
                  onClick={() => {
                    sendMessage(
                      { text: DIAGRAM_TIP_PROMPT() },
                      { body: { enabledFiles: Array.from(enabledFiles) } }
                    );
                  }}
                ></AISuggestion>
              </AISuggestions>
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
    </div>
  );
}
