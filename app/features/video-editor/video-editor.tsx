import { AddVideoModal } from "@/components/add-video-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatSecondsToTimeCode } from "@/services/utils";
import levenshtein from "js-levenshtein";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDown,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleQuestionMarkIcon,
  Columns2,
  CopyIcon,
  DownloadIcon,
  FilmIcon,
  Loader2,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PauseIcon,
  PencilIcon,
  Plus,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UserRound,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { streamDeckForwarderMessageSchema } from "stream-deck-forwarder/stream-deck-forwarder-types";
import { useEffectReducer } from "use-effect-reducer";
import type {
  Clip,
  ClipOnDatabase,
  ClipSection,
  FrontendId,
  FrontendInsertionPoint,
  TimelineItem,
} from "./clip-state-reducer";
import { type OBSConnectionState } from "./obs-connector";
import { PreloadableClipManager } from "./preloadable-clip";
import { type FrontendSpeechDetectorState } from "./use-speech-detector";
import {
  makeVideoEditorReducer,
  type videoStateReducer,
} from "./video-state-reducer";
import { INSERTION_POINT_ID } from "./constants";

function calculateTextSimilarity(str1: string, str2: string): number {
  const distance = levenshtein(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  // Handle edge case of empty strings
  if (maxLength === 0) return 100;

  const similarity = (1 - distance / maxLength) * 100;
  return Math.max(0, Math.round(similarity * 100) / 100); // Round to 2 decimal places
}

const isClip = (item: TimelineItem): item is Clip =>
  item.type === "on-database" || item.type === "optimistically-added";

const isClipSection = (item: TimelineItem): item is ClipSection =>
  item.type === "clip-section-on-database" || item.type === "clip-section-optimistically-added";

export const VideoEditor = (props: {
  obsConnectorState: OBSConnectionState;
  items: TimelineItem[];
  videoPath: string;
  lessonPath?: string;
  repoName?: string;
  repoId?: string;
  lessonId?: string;
  videoId: string;
  liveMediaStream: MediaStream | null;
  speechDetectorState: FrontendSpeechDetectorState;
  clipIdsBeingTranscribed: Set<FrontendId>;
  onClipsRemoved: (clipIds: FrontendId[]) => void;
  onClipsRetranscribe: (clipIds: FrontendId[]) => void;
  hasExplainerFolder: boolean;
  videoCount: number;
  insertionPoint: FrontendInsertionPoint;
  onSetInsertionPoint: (mode: "after" | "before", clipId: FrontendId) => void;
  onDeleteLatestInsertedClip: () => void;
  onToggleBeat: () => void;
  onToggleBeatForClip: (clipId: FrontendId) => void;
  onMoveClip: (clipId: FrontendId, direction: "up" | "down") => void;
  onAddClipSection: (name: string) => void;
  onUpdateClipSection: (clipSectionId: FrontendId, name: string) => void;
  onAddClipSectionAt: (name: string, position: "before" | "after", itemId: FrontendId) => void;
}) => {
  // Filter items to get only clips (excluding clip sections)
  // Clip sections will be rendered separately in a future update
  const clips = useMemo(() => props.items.filter(isClip), [props.items]);

  // Generate default name for new clip sections based on existing count
  const generateDefaultClipSectionName = () => {
    const existingClipSectionCount = props.items.filter(
      (item) => item.type === "clip-section-on-database" || item.type === "clip-section-optimistically-added"
    ).length;
    return `Section ${existingClipSectionCount + 1}`;
  };

  const [state, dispatch] = useEffectReducer<
    videoStateReducer.State,
    videoStateReducer.Action,
    videoStateReducer.Effect
  >(
    makeVideoEditorReducer(clips.map((clip) => clip.frontendId)),
    {
      showLastFrameOfVideo: true,
      runningState: "paused",
      currentClipId: clips[0]?.frontendId,
      currentTimeInClip: 0,
      selectedClipsSet: new Set<FrontendId>(),
      clipIdsPreloaded: new Set<FrontendId>(
        [clips[0]?.frontendId, clips[1]?.frontendId].filter(
          (id) => id !== undefined
        )
      ),
      playbackRate: 1,
    },
    {
      "archive-clips": (_state, effect, _dispatch) => {
        props.onClipsRemoved(effect.clipIds);
      },
      "retranscribe-clips": (_state, effect, _dispatch) => {
        props.onClipsRetranscribe(effect.clipIds);
      },
      "toggle-beat-for-clip": (_state, effect, _dispatch) => {
        props.onToggleBeatForClip(effect.clipId);
      },
      "move-clip": (_state, effect, _dispatch) => {
        props.onMoveClip(effect.clipId, effect.direction);
      },
    }
  );


  const currentClipIndex = clips.findIndex(
    (clip) => clip.frontendId === state.currentClipId
  );

  const nextClip = clips[currentClipIndex + 1];

  const selectedClipId = Array.from(state.selectedClipsSet)[0];

  const clipsToAggressivelyPreload = [
    state.currentClipId,
    nextClip?.frontendId,
    selectedClipId,
  ].filter((id) => id !== undefined) as FrontendId[];

  const currentClipId = state.currentClipId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLButtonElement &&
          !e.target.classList.contains("allow-keydown"))
      ) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (e.repeat) return;
        dispatch({ type: "press-space-bar" });
      } else if (e.key === "Delete") {
        dispatch({ type: "press-delete" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        dispatch({ type: "press-return" });
      } else if (e.key === "ArrowLeft") {
        dispatch({ type: "press-arrow-left" });
      } else if (e.key === "ArrowRight") {
        dispatch({ type: "press-arrow-right" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.altKey) {
          dispatch({ type: "press-alt-arrow-up" });
        } else {
          dispatch({ type: "press-arrow-up" });
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.altKey) {
          dispatch({ type: "press-alt-arrow-down" });
        } else {
          dispatch({ type: "press-arrow-down" });
        }
      } else if (e.key === "l") {
        dispatch({ type: "press-l" });
      } else if (e.key === "k") {
        dispatch({ type: "press-k" });
      } else if (e.key === "Home") {
        dispatch({ type: "press-home" });
      } else if (e.key === "End") {
        dispatch({ type: "press-end" });
      } else if (e.key === "b" || e.key === "B") {
        dispatch({ type: "beat-toggle-key-pressed" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5172");
    socket.addEventListener("message", (event) => {
      const data = streamDeckForwarderMessageSchema.parse(
        JSON.parse(event.data)
      );
      if (data.type === "delete-last-clip") {
        props.onDeleteLatestInsertedClip();
      } else if (data.type === "toggle-last-frame-of-video") {
        dispatch({ type: "toggle-last-frame-of-video" });
      } else if (data.type === "toggle-beat") {
        props.onToggleBeat();
      } else if (data.type === "add-clip-section") {
        setClipSectionNamingModal({
          mode: "create",
          defaultName: generateDefaultClipSectionName(),
        });
      }
    });
    return () => {
      socket.close();
    };
  }, []);

  const exportVideoClipsFetcher = useFetcher();
  const exportToDavinciResolveFetcher = useFetcher();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);

  // State for clip section naming modal
  // When creating: { mode: "create", defaultName: string }
  // When editing: { mode: "edit", clipSectionId: FrontendId, currentName: string }
  // When adding at position: { mode: "add-at", position: "before" | "after", itemId: FrontendId, defaultName: string }
  const [clipSectionNamingModal, setClipSectionNamingModal] = useState<
    | { mode: "create"; defaultName: string }
    | { mode: "edit"; clipSectionId: FrontendId; currentName: string }
    | { mode: "add-at"; position: "before" | "after"; itemId: FrontendId; defaultName: string }
    | null
  >(null);

  const copyTranscriptToClipboard = async () => {
    try {
      // Get all clips with text and concatenate them
      const transcript = clips
        .filter((clip) => clip.type === "on-database")
        .map((clip) => clip.text)
        .join(" ");

      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy transcript to clipboard:", error);
    }
  };

  // Generate YouTube chapters from clip sections
  // Format: "0:00 Section Name" for each clip section
  const youtubeChapters = useMemo(() => {
    const chapters: { timestamp: string; name: string }[] = [];
    let cumulativeDuration = 0;

    for (const item of props.items) {
      if (isClipSection(item)) {
        // Record the timestamp at the start of this clip section
        chapters.push({
          timestamp: formatSecondsToTimeCode(cumulativeDuration),
          name: item.name,
        });
      } else if (isClip(item) && item.type === "on-database") {
        // Add the clip's duration to cumulative total
        cumulativeDuration += item.sourceEndTime - item.sourceStartTime;
      }
    }

    return chapters;
  }, [props.items]);

  const [isChaptersCopied, setIsChaptersCopied] = useState(false);

  const copyYoutubeChaptersToClipboard = async () => {
    try {
      const chaptersText = youtubeChapters
        .map((chapter) => `${chapter.timestamp} ${chapter.name}`)
        .join("\n");

      await navigator.clipboard.writeText(chaptersText);
      setIsChaptersCopied(true);
      setTimeout(() => setIsChaptersCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy YouTube chapters to clipboard:", error);
    }
  };

  const totalDuration = clips.reduce((acc, clip) => {
    if (clip.type === "on-database") {
      return acc + (clip.sourceEndTime - clip.sourceStartTime);
    }
    return acc;
  }, 0);

  let viewMode: "video-player" | "live-stream" | "last-frame" = "video-player";

  if (state.showLastFrameOfVideo) {
    viewMode = "last-frame";
  } else if (!props.liveMediaStream || state.runningState === "playing") {
    viewMode = "video-player";
  } else {
    viewMode = "live-stream";
  }

  const databaseClipToShowLastFrameOf = getDatabaseClipBeforeInsertionPoint(
    clips,
    props.insertionPoint
  );

  const currentClip = clips.find(
    (clip) => clip.frontendId === currentClipId
  );

  const allClipsHaveSilenceDetected = clips.every(
    (clip) => clip.type === "on-database"
  );

  const allClipsHaveText = clips.every(
    (clip) => clip.type === "on-database" && clip.text
  );

  // Create a map of clip frontendId -> computed properties (timecode, levenshtein)
  const clipComputedProps = useMemo(() => {
    let timecode = 0;
    const map = new Map<
      FrontendId,
      { timecode: string; nextLevenshtein: number }
    >();

    clips.forEach((clip, index) => {
      if (clip.type === "optimistically-added") {
        map.set(clip.frontendId, { timecode: "", nextLevenshtein: 0 });
        return;
      }

      const nextClip = clips[index + 1];

      const nextLevenshtein =
        nextClip?.type === "on-database" && nextClip?.text
          ? calculateTextSimilarity(clip.text, nextClip.text)
          : 0;

      const timecodeString = formatSecondsToTimeCode(timecode);

      const duration = clip.sourceEndTime - clip.sourceStartTime;
      timecode += duration;

      map.set(clip.frontendId, { timecode: timecodeString, nextLevenshtein });
    });

    return map;
  }, [clips]);

  const areAnyClipsDangerous = clips.some((clip) => {
    if (clip.type !== "on-database") return false;
    const props = clipComputedProps.get(clip.frontendId);
    return (
      props && props.nextLevenshtein > DANGEROUS_TEXT_SIMILARITY_THRESHOLD
    );
  });

  return (
    <div className="flex flex-col lg:flex-row p-6 gap-6 gap-y-10">
      {/* Video Player Section - Shows first on mobile, second on desktop */}
      <div className="lg:flex-1 relative order-1 lg:order-2">
        <div className="sticky top-6">
          <div className="">
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-1 flex items-center">
                {props.videoPath}
                {" (" + formatSecondsToTimeCode(totalDuration) + ")"}
                {areAnyClipsDangerous && (
                  <span className="text-orange-500 ml-4 text-base font-medium inline-flex items-center">
                    <AlertTriangleIcon className="size-6 mr-2" />
                    Possible duplicate clips
                  </span>
                )}
              </h1>
              {props.repoName && props.lessonPath && (
                <h2 className="text-sm font-medium mb-1">
                  {props.repoName}
                  {" - "}
                  {props.lessonPath}
                </h2>
              )}
            </div>

            {props.liveMediaStream && (
              <div
                className={cn(
                  "w-full h-full relative aspect-[16/9]",
                  (props.obsConnectorState.type === "obs-connected" ||
                    props.obsConnectorState.type === "obs-recording") &&
                    props.obsConnectorState.profile === "TikTok" &&
                    "w-92 aspect-[9/16]",
                  "hidden",
                  (viewMode === "live-stream" || viewMode === "last-frame") &&
                    "block"
                )}
              >
                {props.obsConnectorState.type === "obs-recording" && (
                  <RecordingSignalIndicator />
                )}

                {(props.obsConnectorState.type === "obs-recording" ||
                  props.obsConnectorState.type === "obs-connected") && (
                  <LiveMediaStream
                    mediaStream={props.liveMediaStream}
                    obsConnectorState={props.obsConnectorState}
                    speechDetectorState={props.speechDetectorState}
                    showCenterLine={props.obsConnectorState.scene === "Camera"}
                  />
                )}
                {databaseClipToShowLastFrameOf &&
                  viewMode === "last-frame" &&
                  // Only show overlay if scenes match, or if no scene is detected
                  (props.obsConnectorState.type !== "obs-recording" &&
                  props.obsConnectorState.type !== "obs-connected"
                    ? true // Default to showing if OBS not connected
                    : databaseClipToShowLastFrameOf.scene === null ||
                      databaseClipToShowLastFrameOf.scene ===
                        props.obsConnectorState.scene) && (
                    <div
                      className={cn(
                        "absolute top-0 left-0 rounded-lg",
                        databaseClipToShowLastFrameOf.profile === "TikTok" &&
                          "w-92 aspect-[9/16]"
                      )}
                    >
                      <img
                        className="w-full h-full rounded-lg opacity-50"
                        src={`/clips/${databaseClipToShowLastFrameOf.databaseId}/last-frame`}
                      />
                    </div>
                  )}
              </div>
            )}
            <div className={cn(viewMode !== "video-player" && "hidden")}>
              <PreloadableClipManager
                clipsToAggressivelyPreload={clipsToAggressivelyPreload}
                clips={clips
                  .filter((clip) => state.clipIdsPreloaded.has(clip.frontendId))
                  .filter((clip) => clip.type === "on-database")}
                finalClipId={clips[clips.length - 1]?.frontendId}
                state={state.runningState}
                currentClipId={currentClipId}
                currentClipProfile={currentClip?.profile ?? undefined}
                onClipFinished={() => {
                  dispatch({ type: "clip-finished" });
                }}
                onUpdateCurrentTime={(time) => {
                  dispatch({ type: "update-clip-current-time", time });
                }}
                playbackRate={state.playbackRate}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild={allClipsHaveSilenceDetected}
                      variant="secondary"
                      aria-label="Go Back"
                      disabled={!allClipsHaveSilenceDetected}
                    >
                      {allClipsHaveSilenceDetected ? (
                        <Link
                          to={
                            props.repoId && props.lessonId
                              ? `/?repoId=${props.repoId}#${props.lessonId}`
                              : "/videos"
                          }
                        >
                          <ChevronLeftIcon className="w-4 h-4" />
                        </Link>
                      ) : (
                        <span>
                          <ChevronLeftIcon className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  {!allClipsHaveSilenceDetected && (
                    <TooltipContent>
                      <p>Waiting for silence detection to complete</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            disabled={!allClipsHaveSilenceDetected}
                          >
                            {exportVideoClipsFetcher.state === "submitting" ||
                            exportToDavinciResolveFetcher.state ===
                              "submitting" ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : null}
                            Actions
                            <ChevronDown className="w-4 h-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                      </span>
                    </TooltipTrigger>
                    {!allClipsHaveSilenceDetected && (
                      <TooltipContent>
                        <p>Waiting for silence detection to complete</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem asChild>
                      <Link to={`/videos/${props.videoId}/write`}>
                        <PencilIcon className="w-4 h-4 mr-2" />
                        <div className="flex flex-col">
                          <span className="font-medium">Write Article</span>
                          <span className="text-xs text-muted-foreground">
                            Go to article writing interface
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <DropdownMenuItem
                            disabled={!allClipsHaveText}
                            onSelect={copyTranscriptToClipboard}
                          >
                            {isCopied ? (
                              <CheckIcon className="w-4 h-4 mr-2" />
                            ) : (
                              <CopyIcon className="w-4 h-4 mr-2" />
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium">
                                Copy Transcript
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Copy all transcript to clipboard
                              </span>
                            </div>
                          </DropdownMenuItem>
                        </div>
                      </TooltipTrigger>
                      {!allClipsHaveText && (
                        <TooltipContent side="left">
                          <p>Waiting for transcription to complete</p>
                        </TooltipContent>
                      )}
                    </Tooltip>

                    <Dialog
                      open={isExportModalOpen}
                      onOpenChange={setIsExportModalOpen}
                    >
                      <DialogTrigger asChild>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <DownloadIcon className="w-4 h-4 mr-2" />
                          <div className="flex flex-col">
                            <span className="font-medium">Export</span>
                            <span className="text-xs text-muted-foreground">
                              Export video clips to file
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Export</DialogTitle>
                        </DialogHeader>
                        <exportVideoClipsFetcher.Form
                          method="post"
                          action={`/api/videos/${props.videoId}/export`}
                          className="space-y-4 py-4"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await exportVideoClipsFetcher.submit(
                              e.currentTarget
                            );
                            setIsExportModalOpen(false);
                          }}
                        >
                          <div className="space-y-2">
                            <Label htmlFor="shorts-directory-output-name">
                              Short Title
                            </Label>
                            <Input
                              id="shorts-directory-output-name"
                              placeholder="Leave empty for normal export only..."
                              name="shortsDirectoryOutputName"
                            />
                            <p className="text-xs text-muted-foreground">
                              If provided, the video will be queued for YouTube
                              and TikTok under the given title.
                            </p>
                          </div>
                          {youtubeChapters.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>YouTube Chapters</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={copyYoutubeChaptersToClipboard}
                                  className="h-7 px-2"
                                >
                                  {isChaptersCopied ? (
                                    <CheckIcon className="w-4 h-4 mr-1" />
                                  ) : (
                                    <CopyIcon className="w-4 h-4 mr-1" />
                                  )}
                                  {isChaptersCopied ? "Copied" : "Copy"}
                                </Button>
                              </div>
                              <div className="bg-muted rounded-md p-3 text-sm font-mono">
                                {youtubeChapters.map((chapter, index) => (
                                  <div key={index}>
                                    {chapter.timestamp} {chapter.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => setIsExportModalOpen(false)}
                              type="button"
                            >
                              Cancel
                            </Button>
                            <Button type="submit">
                              {exportVideoClipsFetcher.state ===
                              "submitting" ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <DownloadIcon className="w-4 h-4 mr-1" />
                              )}
                              Export
                            </Button>
                          </div>
                        </exportVideoClipsFetcher.Form>
                      </DialogContent>
                    </Dialog>

                    <DropdownMenuItem
                      onSelect={() => {
                        exportToDavinciResolveFetcher.submit(null, {
                          method: "post",
                          action: `/videos/${props.videoId}/export-to-davinci-resolve`,
                        });
                      }}
                    >
                      <FilmIcon className="w-4 h-4 mr-2" />
                      <div className="flex flex-col">
                        <span className="font-medium">DaVinci Resolve</span>
                        <span className="text-xs text-muted-foreground">
                          Create a new timeline with clips
                        </span>
                      </div>
                    </DropdownMenuItem>

                    {props.lessonId && (
                      <DropdownMenuItem
                        onSelect={() => {
                          setIsAddVideoModalOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        <div className="flex flex-col">
                          <span className="font-medium">Add New Video</span>
                          <span className="text-xs text-muted-foreground">
                            Add another video to this lesson
                          </span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      <AddVideoModal
        lessonId={props.lessonId}
        videoCount={props.videoCount}
        hasExplainerFolder={props.hasExplainerFolder}
        open={isAddVideoModalOpen}
        onOpenChange={setIsAddVideoModalOpen}
      />

      {/* Clip Section Naming Modal */}
      <Dialog
        open={clipSectionNamingModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            // On dismiss, create with default name if in create mode
            if (clipSectionNamingModal?.mode === "create") {
              props.onAddClipSection(clipSectionNamingModal.defaultName);
            } else if (clipSectionNamingModal?.mode === "add-at") {
              props.onAddClipSectionAt(
                clipSectionNamingModal.defaultName,
                clipSectionNamingModal.position,
                clipSectionNamingModal.itemId
              );
            }
            setClipSectionNamingModal(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {clipSectionNamingModal?.mode === "create"
                ? "Name Clip Section"
                : clipSectionNamingModal?.mode === "add-at"
                  ? "Name Clip Section"
                  : "Edit Clip Section"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get("name") as string;
              if (clipSectionNamingModal?.mode === "create") {
                props.onAddClipSection(name);
              } else if (clipSectionNamingModal?.mode === "edit") {
                props.onUpdateClipSection(
                  clipSectionNamingModal.clipSectionId,
                  name
                );
              } else if (clipSectionNamingModal?.mode === "add-at") {
                props.onAddClipSectionAt(
                  name,
                  clipSectionNamingModal.position,
                  clipSectionNamingModal.itemId
                );
              }
              setClipSectionNamingModal(null);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="clip-section-name">Section Name</Label>
              <Input
                id="clip-section-name"
                name="name"
                autoFocus
                defaultValue={
                  clipSectionNamingModal?.mode === "create"
                    ? clipSectionNamingModal.defaultName
                    : clipSectionNamingModal?.mode === "add-at"
                      ? clipSectionNamingModal.defaultName
                      : clipSectionNamingModal?.currentName ?? ""
                }
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  // On cancel in create or add-at mode, create with default name
                  if (clipSectionNamingModal?.mode === "create") {
                    props.onAddClipSection(clipSectionNamingModal.defaultName);
                  } else if (clipSectionNamingModal?.mode === "add-at") {
                    props.onAddClipSectionAt(
                      clipSectionNamingModal.defaultName,
                      clipSectionNamingModal.position,
                      clipSectionNamingModal.itemId
                    );
                  }
                  setClipSectionNamingModal(null);
                }}
                type="button"
              >
                {clipSectionNamingModal?.mode === "create" || clipSectionNamingModal?.mode === "add-at" ? "Skip" : "Cancel"}
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clips Section - Shows second on mobile, first on desktop */}
      <div className="lg:flex-1 flex gap-2 h-full order-2 lg:order-1 overflow-y-auto">
        <div className="grid gap-4 w-full p-2">
          {clips.length === 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
                <CircleQuestionMarkIcon className="size-6" />
                Pre-recording checklist
              </h2>
              <ol className="space-y-3 text-base">
                <li className="flex items-center gap-3">
                  <MonitorIcon className="size-5 flex-shrink-0 text-gray-300" />
                  <span>Close the windows</span>
                </li>
                <li className="flex items-center gap-3">
                  <Columns2 className="size-5 flex-shrink-0 text-gray-300" />
                  <span>Close the blinds</span>
                </li>
                <li className="flex items-center gap-3">
                  <UserRound className="size-5 flex-shrink-0 text-gray-300" />
                  <span>Check bookshelf books are standing up properly</span>
                </li>
              </ol>
            </div>
          )}

          {props.items.length > 0 && (
            <>
              {props.insertionPoint.type === "start" && (
                <InsertionPointIndicator />
              )}
              {props.items.map((item, itemIndex) => {
                const isFirstItem = itemIndex === 0;
                const isLastItem = itemIndex === props.items.length - 1;

                // Render clip section divider
                if (isClipSection(item)) {
                  return (
                    <div key={item.frontendId}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <ClipSectionDivider
                            name={item.name}
                            isSelected={state.selectedClipsSet.has(item.frontendId)}
                            onClick={(e) => {
                              dispatch({
                                type: "click-clip",
                                clipId: item.frontendId,
                                ctrlKey: e.ctrlKey,
                                shiftKey: e.shiftKey,
                              });
                            }}
                          />
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onSelect={() => {
                              props.onSetInsertionPoint("before", item.frontendId);
                            }}
                          >
                            <ChevronLeftIcon />
                            Insert Before
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              props.onSetInsertionPoint("after", item.frontendId);
                            }}
                          >
                            <ChevronRightIcon />
                            Insert After
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              setClipSectionNamingModal({
                                mode: "add-at",
                                position: "before",
                                itemId: item.frontendId,
                                defaultName: generateDefaultClipSectionName(),
                              });
                            }}
                          >
                            <PlusIcon />
                            Add Section Before
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              setClipSectionNamingModal({
                                mode: "add-at",
                                position: "after",
                                itemId: item.frontendId,
                                defaultName: generateDefaultClipSectionName(),
                              });
                            }}
                          >
                            <PlusIcon />
                            Add Section After
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              setClipSectionNamingModal({
                                mode: "edit",
                                clipSectionId: item.frontendId,
                                currentName: item.name,
                              });
                            }}
                          >
                            <PencilIcon />
                            Edit
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isFirstItem}
                            onSelect={() => {
                              props.onMoveClip(item.frontendId, "up");
                            }}
                          >
                            <ArrowUpIcon />
                            Move Up
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={isLastItem}
                            onSelect={() => {
                              props.onMoveClip(item.frontendId, "down");
                            }}
                          >
                            <ArrowDownIcon />
                            Move Down
                          </ContextMenuItem>
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => {
                              dispatch({
                                type: "delete-clip",
                                clipId: item.frontendId,
                              });
                            }}
                          >
                            <Trash2Icon />
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                      {props.insertionPoint.type === "after-clip-section" &&
                        props.insertionPoint.frontendClipSectionId ===
                          item.frontendId && <InsertionPointIndicator />}
                    </div>
                  );
                }

                // Render clip
                const clip = item;
                const computedProps = clipComputedProps.get(clip.frontendId);
                const timecode = computedProps?.timecode ?? "";
                const nextLevenshtein = computedProps?.nextLevenshtein ?? 0;

                const duration =
                  clip.type === "on-database"
                    ? clip.sourceEndTime - clip.sourceStartTime
                    : null;

                const percentComplete = duration
                  ? state.currentTimeInClip / duration
                  : 0;

                const isPortrait =
                  clip.type === "on-database" &&
                  (clip.profile === "TikTok" || clip.profile === "Portrait");

                return (
                  <div key={clip.frontendId}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <button
                          className={cn(
                            "bg-gray-800 rounded-md text-left relative overflow-hidden allow-keydown flex w-full",
                            state.selectedClipsSet.has(clip.frontendId) &&
                              "outline-2 outline-gray-200 bg-gray-700",
                            clip.frontendId === currentClipId && "bg-blue-900"
                          )}
                          onClick={(e) => {
                            dispatch({
                              type: "click-clip",
                              clipId: clip.frontendId,
                              ctrlKey: e.ctrlKey,
                              shiftKey: e.shiftKey,
                            });
                          }}
                        >
                          {/* Thumbnail image */}
                          {clip.type === "on-database" ? (
                            <div className="flex-shrink-0 relative">
                              <img
                                src={`/clips/${clip.databaseId}/first-frame`}
                                alt="First frame"
                                className={cn(
                                  "rounded object-cover h-full object-center",
                                  isPortrait
                                    ? "w-24 aspect-[9/16]"
                                    : "w-32 aspect-[16/9]",
                                  props.clipIdsBeingTranscribed.has(
                                    clip.frontendId
                                  ) && "opacity-50 grayscale"
                                )}
                              />
                              {/* Loading spinner overlay */}
                              {props.clipIdsBeingTranscribed.has(
                                clip.frontendId
                              ) && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                                </div>
                              )}
                              {/* Timecode overlay on image */}
                              <div
                                className={cn(
                                  "absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-black/60 text-gray-100 flex items-center gap-1",
                                  clip.frontendId === currentClipId &&
                                    "text-blue-100",
                                  state.selectedClipsSet.has(clip.frontendId) &&
                                    "text-white"
                                )}
                              >
                                {timecode}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 relative w-32 aspect-[16/9] bg-gray-700 rounded flex items-center justify-center">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          )}

                          {/* Content area */}
                          <div className="flex-1 flex flex-col min-w-0 relative p-3">
                            {/* Progress bar overlay on text */}
                            {clip.frontendId === currentClipId && (
                              <div
                                className="absolute top-0 left-0 h-full bg-blue-700 z-0 rounded"
                                style={{
                                  width: `${percentComplete * 100}%`,
                                }}
                              />
                            )}

                            {/* Transcript text */}
                            <div className="z-10 relative text-white text-sm leading-6">
                              {props.clipIdsBeingTranscribed.has(
                                clip.frontendId
                              ) ? (
                                clip.type === "on-database" &&
                                !clip.transcribedAt &&
                                !clip.text && (
                                  <span className="text-gray-400">
                                    Transcribing...
                                  </span>
                                )
                              ) : clip.type === "on-database" ? (
                                <>
                                  {nextLevenshtein >
                                    DANGEROUS_TEXT_SIMILARITY_THRESHOLD && (
                                    <span className="text-orange-500 mr-2 text-base font-semibold inline-flex items-center">
                                      <AlertTriangleIcon className="w-4 h-4 mr-2" />
                                      {nextLevenshtein.toFixed(0)}%
                                    </span>
                                  )}
                                  <span
                                    className={cn(
                                      "text-gray-100",
                                      clip.frontendId === currentClipId &&
                                        "text-white"
                                    )}
                                  >
                                    {clip.text}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">
                                  Detecting silence...
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => {
                            props.onSetInsertionPoint(
                              "before",
                              clip.frontendId
                            );
                          }}
                        >
                          <ChevronLeftIcon />
                          Insert Before
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            props.onSetInsertionPoint("after", clip.frontendId);
                          }}
                        >
                          <ChevronRightIcon />
                          Insert After
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            setClipSectionNamingModal({
                              mode: "add-at",
                              position: "before",
                              itemId: clip.frontendId,
                              defaultName: generateDefaultClipSectionName(),
                            });
                          }}
                        >
                          <PlusIcon />
                          Add Section Before
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            setClipSectionNamingModal({
                              mode: "add-at",
                              position: "after",
                              itemId: clip.frontendId,
                              defaultName: generateDefaultClipSectionName(),
                            });
                          }}
                        >
                          <PlusIcon />
                          Add Section After
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={isFirstItem}
                          onSelect={() => {
                            props.onMoveClip(clip.frontendId, "up");
                          }}
                        >
                          <ArrowUpIcon />
                          Move Up
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={isLastItem}
                          onSelect={() => {
                            props.onMoveClip(clip.frontendId, "down");
                          }}
                        >
                          <ArrowDownIcon />
                          Move Down
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            props.onToggleBeatForClip(clip.frontendId);
                          }}
                        >
                          <PauseIcon />
                          {clip.beatType === "long" ? "Remove Beat" : "Add Beat"}
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={clip.type !== "on-database"}
                          onSelect={() => {
                            dispatch({
                              type: "retranscribe-clip",
                              clipId: clip.frontendId,
                            });
                          }}
                        >
                          <RefreshCwIcon />
                          Re-transcribe
                        </ContextMenuItem>
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => {
                            dispatch({
                              type: "delete-clip",
                              clipId: clip.frontendId,
                            });
                          }}
                        >
                          <Trash2Icon />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                    {/* Beat indicator dots below clip */}
                    {clip.beatType === "long" && <BeatIndicator />}
                    {props.insertionPoint.type === "after-clip" &&
                      props.insertionPoint.frontendClipId ===
                        clip.frontendId && <InsertionPointIndicator />}
                  </div>
                );
              })}

              {props.insertionPoint.type === "end" && (
                <InsertionPointIndicator />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const InsertionPointIndicator = () => {
  return (
    <div
      id={INSERTION_POINT_ID}
      className="flex items-center justify-center gap-4"
    >
      <div className="border-t-2 w-full border-blue-200 border-dashed flex-1" />
      <div className="flex items-center justify-center">
        <PlusIcon className="size-5 text-blue-200" />
        {/* <span className="text-blue-200 text-sm">New Clips</span> */}
      </div>
      <div className="border-t-2 w-full border-blue-200 border-dashed flex-1" />
    </div>
  );
};

export const BeatIndicator = () => {
  return (
    <div className="flex items-center justify-center gap-1 py-1">
      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
    </div>
  );
};

export const ClipSectionDivider = React.forwardRef<
  HTMLButtonElement,
  {
    name: string;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
  }
>((props, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "flex items-center gap-3 py-2 px-3 w-full allow-keydown",
        "hover:bg-gray-800/50 rounded-md transition-colors",
        props.isSelected && "bg-gray-700 outline-2 outline-gray-200"
      )}
      onClick={props.onClick}
    >
      <div className="border-t-2 border-gray-500 flex-1" />
      <span className="text-sm font-medium text-gray-300 whitespace-nowrap">
        {props.name}
      </span>
      <div className="border-t-2 border-gray-500 flex-1" />
    </button>
  );
});
ClipSectionDivider.displayName = "ClipSectionDivider";

export const LiveMediaStream = (props: {
  mediaStream: MediaStream;
  obsConnectorState: OBSConnectionState;
  speechDetectorState: FrontendSpeechDetectorState;
  showCenterLine: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.mediaStream;
      videoRef.current.play();
    }
  }, [props.mediaStream, videoRef.current]);

  const isRecording = props.obsConnectorState.type === "obs-recording";

  return (
    <div className={cn("relative")}>
      {isRecording && props.speechDetectorState.type === "silence" && (
        <div className="absolute top-4 left-4 bg-blue-600 rounded-full size-8 flex items-center justify-center">
          <CheckIcon className="size-4 text-white" />
        </div>
      )}
      {isRecording &&
        props.speechDetectorState.type === "speaking-detected" && (
          <div className="absolute top-4 left-4 bg-yellow-600 rounded-full size-8 flex items-center justify-center">
            <MicIcon className="size-4 text-white" />
          </div>
        )}
      {isRecording &&
        props.speechDetectorState.type ===
          "long-enough-speaking-for-clip-detected" && (
          <div className="absolute top-4 left-4 bg-green-600 rounded-full size-8 flex items-center justify-center">
            <MicIcon className="size-4 text-white" />
          </div>
        )}
      {isRecording && props.speechDetectorState.type === "warming-up" && (
        <div className="absolute top-4 left-4 bg-red-600 rounded-full size-8 flex items-center justify-center">
          <Loader2 className="size-4 text-white animate-spin" />
        </div>
      )}
      {!isRecording && (
        <div className="absolute top-4 left-4 bg-gray-300 rounded-full size-8 flex items-center justify-center">
          <MicOffIcon className="size-4 text-gray-900" />
        </div>
      )}
      {props.showCenterLine && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-l-2 border-dashed border-gray-300/50 h-full"></div>
        </div>
      )}

      <video
        ref={videoRef}
        muted
        className={cn(
          "outline-4",
          "outline-gray-300",
          "rounded-lg",
          isRecording &&
            props.speechDetectorState.type === "speaking-detected" &&
            "outline-yellow-600",
          isRecording &&
            props.speechDetectorState.type ===
              "long-enough-speaking-for-clip-detected" &&
            "outline-green-600",
          isRecording &&
            props.speechDetectorState.type === "silence" &&
            "outline-blue-600",
          isRecording &&
            props.speechDetectorState.type === "warming-up" &&
            "outline-red-600"
        )}
      />
    </div>
  );
};

export const RecordingSignalIndicator = () => {
  return (
    <div className="absolute top-6 right-6 flex items-center justify-center">
      <div className="w-10 h-10 bg-red-700 rounded-full animate-pulse" />
    </div>
  );
};

const DANGEROUS_TEXT_SIMILARITY_THRESHOLD = 40;

export const getDatabaseClipBeforeInsertionPoint = (
  clips: Clip[],
  insertionPoint: FrontendInsertionPoint
): ClipOnDatabase | undefined => {
  if (insertionPoint.type === "start") {
    return undefined;
  }

  if (insertionPoint.type === "end") {
    return clips.findLast((clip) => clip.type === "on-database");
  }

  if (insertionPoint.type === "after-clip") {
    return clips.find(
      (clip) =>
        clip.frontendId === insertionPoint.frontendClipId &&
        clip.type === "on-database"
    ) as ClipOnDatabase | undefined;
  }
};
