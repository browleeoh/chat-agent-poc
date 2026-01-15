import { AddVideoModal } from "@/components/add-video-modal";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatSecondsToTimeCode } from "@/services/utils";
import type {
  ClipSectionNamingModal,
  ClipComputedProps,
} from "./types";
import {
  InsertionPointIndicator,
  BeatIndicator,
  RecordingSignalIndicator,
} from "./components/timeline-indicators";
import { LiveMediaStream } from "./components/live-media-stream";
import { TableOfContents } from "./components/table-of-contents";
import { ClipSectionDivider } from "./components/clip-section-divider";
import { ClipSectionNamingModal as ClipSectionNamingModalComponent } from "./components/clip-section-naming-modal";
import { ActionsDropdown } from "./components/actions-dropdown";
import { ClipItem } from "./components/clip-item";
import { PreRecordingChecklist } from "./components/pre-recording-checklist";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useWebSocket } from "./hooks/use-websocket";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";
import { useEffectReducer } from "use-effect-reducer";
import type {
  Clip,
  ClipOnDatabase,
  EditorError,
  FrontendId,
  FrontendInsertionPoint,
  TimelineItem,
} from "./clip-state-reducer";
import {
  calculateTextSimilarity,
  isClip,
  isClipSection,
} from "./clip-utils";
import { type OBSConnectionState } from "./obs-connector";
import { PreloadableClipManager } from "./preloadable-clip";
import { type FrontendSpeechDetectorState } from "./use-speech-detector";
import {
  makeVideoEditorReducer,
  type videoStateReducer,
} from "./video-state-reducer";

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
  onAddClipSectionAt: (
    name: string,
    position: "before" | "after",
    itemId: FrontendId
  ) => void;
  error: EditorError | null;
}) => {
  // Filter items to get only clips (excluding clip sections)
  // Clip sections will be rendered separately in a future update
  const clips = useMemo(() => props.items.filter(isClip), [props.items]);

  // Generate default name for new clip sections based on existing count
  const generateDefaultClipSectionName = () => {
    const existingClipSectionCount = props.items.filter(
      (item) =>
        item.type === "clip-section-on-database" ||
        item.type === "clip-section-optimistically-added"
    ).length;
    return `Section ${existingClipSectionCount + 1}`;
  };

  const [state, dispatch] = useEffectReducer<
    videoStateReducer.State,
    videoStateReducer.Action,
    videoStateReducer.Effect
  >(
    makeVideoEditorReducer(
      props.items.map((item) => item.frontendId),
      clips.map((clip) => clip.frontendId)
    ),
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

  const exportVideoClipsFetcher = useFetcher();
  const exportToDavinciResolveFetcher = useFetcher();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);

  // State for clip section naming modal
  const [clipSectionNamingModal, setClipSectionNamingModal] =
    useState<ClipSectionNamingModal>(null);

  // Setup keyboard shortcuts
  useKeyboardShortcuts(dispatch);

  // Setup WebSocket connection for Stream Deck integration
  useWebSocket({
    dispatch,
    onDeleteLatestInsertedClip: props.onDeleteLatestInsertedClip,
    onToggleBeat: props.onToggleBeat,
    setClipSectionNamingModal,
    generateDefaultClipSectionName,
  });

  const copyTranscriptToClipboard = async () => {
    try {
      // Build transcript with clip sections as markdown headers
      const parts: string[] = [];
      let currentParagraph: string[] = [];

      for (const item of props.items) {
        if (isClipSection(item)) {
          // Flush current paragraph before starting a new section
          if (currentParagraph.length > 0) {
            parts.push(currentParagraph.join(" "));
            currentParagraph = [];
          }
          // Add section as H2 header
          parts.push(`## ${item.name}`);
        } else if (isClip(item) && item.type === "on-database" && item.text) {
          currentParagraph.push(item.text);
        }
      }

      // Flush remaining paragraph
      if (currentParagraph.length > 0) {
        parts.push(currentParagraph.join(" "));
      }

      // Join sections with double newlines
      const transcript = parts.join("\n\n");

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

  const currentClip = clips.find((clip) => clip.frontendId === currentClipId);

  const allClipsHaveSilenceDetected = clips.every(
    (clip) => clip.type === "on-database"
  );

  const allClipsHaveText = clips.every(
    (clip) => clip.type === "on-database" && clip.text
  );

  // Create a map of clip frontendId -> computed properties (timecode, levenshtein)
  const clipComputedProps = useMemo(() => {
    let timecode = 0;
    const map: ClipComputedProps = new Map();

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
    return props && props.nextLevenshtein > DANGEROUS_TEXT_SIMILARITY_THRESHOLD;
  });

  // Show error overlay if there's a fatal error
  if (props.error) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="bg-zinc-900 border border-red-500 rounded-lg p-8 max-w-md mx-4 text-center">
          <AlertTriangleIcon className="size-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Video Editor Error
          </h2>
          <p className="text-zinc-400 mb-4">
            A fatal error occurred while performing an operation. The editor
            state may be out of sync with the database.
          </p>
          <div className="bg-zinc-800 rounded p-3 mb-6 text-left">
            <p className="text-sm text-zinc-500 mb-1">
              Operation:{" "}
              <span className="text-zinc-300">{props.error.effectType}</span>
            </p>
            <p className="text-sm text-red-400 font-mono break-all">
              {props.error.message}
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <RefreshCwIcon className="size-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

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
            <div
              className={cn(
                "w-full aspect-[16/9]",
                viewMode !== "video-player" && "hidden"
              )}
            >
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

                <ActionsDropdown
                  allClipsHaveSilenceDetected={allClipsHaveSilenceDetected}
                  allClipsHaveText={allClipsHaveText}
                  exportVideoClipsFetcher={exportVideoClipsFetcher}
                  exportToDavinciResolveFetcher={exportToDavinciResolveFetcher}
                  videoId={props.videoId}
                  lessonId={props.lessonId}
                  isExportModalOpen={isExportModalOpen}
                  setIsExportModalOpen={setIsExportModalOpen}
                  isCopied={isCopied}
                  copyTranscriptToClipboard={copyTranscriptToClipboard}
                  youtubeChapters={youtubeChapters}
                  isChaptersCopied={isChaptersCopied}
                  copyYoutubeChaptersToClipboard={copyYoutubeChaptersToClipboard}
                  onAddVideoClick={() => setIsAddVideoModalOpen(true)}
                />
              </TooltipProvider>
            </div>

            {/* Table of Contents */}
            <TableOfContents
              clipSections={props.items.filter(isClipSection)}
              selectedClipsSet={state.selectedClipsSet}
              onSectionClick={(sectionId, index) => {
                // Select the section
                dispatch({
                  type: "click-clip",
                  clipId: sectionId,
                  ctrlKey: false,
                  shiftKey: false,
                });

                // Scroll to the section in the timeline after React finishes re-rendering
                // Use the index to find the section since IDs change on re-render
                requestAnimationFrame(() => {
                  const allSections =
                    document.querySelectorAll('[id^="section-"]');
                  if (allSections[index]) {
                    allSections[index].scrollIntoView({
                      behavior: "instant",
                      block: "center",
                    });
                  }
                });
              }}
            />
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
      <ClipSectionNamingModalComponent
        modalState={clipSectionNamingModal}
        onClose={() => setClipSectionNamingModal(null)}
        onAddClipSection={props.onAddClipSection}
        onUpdateClipSection={props.onUpdateClipSection}
        onAddClipSectionAt={props.onAddClipSectionAt}
      />

      {/* Clips Section - Shows second on mobile, first on desktop */}
      <div className="lg:flex-1 flex gap-2 h-full order-2 lg:order-1 overflow-y-auto">
        <div className="grid gap-4 w-full p-2">
          {clips.length === 0 && (
            <PreRecordingChecklist
              onAddIntroSection={() => props.onAddClipSection("Intro")}
            />
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
                            id={`section-${item.frontendId}`}
                            name={item.name}
                            isSelected={state.selectedClipsSet.has(
                              item.frontendId
                            )}
                            onClick={(e) => {
                              // If already selected and clicked again (without modifiers),
                              // play from the next clip after this section
                              if (
                                !e.ctrlKey &&
                                !e.shiftKey &&
                                state.selectedClipsSet.has(item.frontendId) &&
                                state.selectedClipsSet.size === 1
                              ) {
                                dispatch({
                                  type: "play-from-clip-section",
                                  clipSectionId: item.frontendId,
                                });
                                return;
                              }
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
                              props.onSetInsertionPoint(
                                "before",
                                item.frontendId
                              );
                            }}
                          >
                            <ChevronLeftIcon />
                            Insert Before
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => {
                              props.onSetInsertionPoint(
                                "after",
                                item.frontendId
                              );
                            }}
                          >
                            <ChevronRightIcon />
                            Insert After
                          </ContextMenuItem>
                          <ContextMenuSeparator />
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
                          <ContextMenuSeparator />
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
                          <ContextMenuSeparator />
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

                return (
                  <div key={clip.frontendId}>
                    <ClipItem
                      clip={clip}
                      isFirstItem={isFirstItem}
                      isLastItem={isLastItem}
                      isSelected={state.selectedClipsSet.has(clip.frontendId)}
                      isCurrentClip={clip.frontendId === currentClipId}
                      currentTimeInClip={state.currentTimeInClip}
                      timecode={timecode}
                      nextLevenshtein={nextLevenshtein}
                      clipIdsBeingTranscribed={props.clipIdsBeingTranscribed}
                      onSetInsertionPoint={props.onSetInsertionPoint}
                      onMoveClip={props.onMoveClip}
                      onToggleBeatForClip={props.onToggleBeatForClip}
                      onAddSectionBefore={() => {
                        setClipSectionNamingModal({
                          mode: "add-at",
                          position: "before",
                          itemId: clip.frontendId,
                          defaultName: generateDefaultClipSectionName(),
                        });
                      }}
                      onAddSectionAfter={() => {
                        setClipSectionNamingModal({
                          mode: "add-at",
                          position: "after",
                          itemId: clip.frontendId,
                          defaultName: generateDefaultClipSectionName(),
                        });
                      }}
                      dispatch={dispatch}
                    />
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
