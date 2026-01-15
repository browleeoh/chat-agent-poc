import { Button } from "@/components/ui/button";
import { formatSecondsToTimeCode } from "@/services/utils";
import type {
  ClipSectionNamingModal,
  ClipComputedProps,
} from "./types";
import { ClipSectionNamingModal as ClipSectionNamingModalComponent } from "./components/clip-section-naming-modal";
import { VideoPlayerPanel } from "./components/video-player-panel";
import { ClipTimeline } from "./components/clip-timeline";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useWebSocket } from "./hooks/use-websocket";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
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
      <VideoPlayerPanel
        videoPath={props.videoPath}
        videoId={props.videoId}
        repoName={props.repoName}
        lessonPath={props.lessonPath}
        repoId={props.repoId}
        lessonId={props.lessonId}
        totalDuration={totalDuration}
        areAnyClipsDangerous={areAnyClipsDangerous}
        items={props.items}
        clips={clips}
        viewMode={viewMode}
        databaseClipToShowLastFrameOf={databaseClipToShowLastFrameOf}
        clipsToAggressivelyPreload={clipsToAggressivelyPreload}
        runningState={state.runningState}
        currentClipId={currentClipId}
        currentClipProfile={currentClip?.profile ?? undefined}
        currentTimeInClip={state.currentTimeInClip}
        selectedClipsSet={state.selectedClipsSet}
        clipIdsPreloaded={state.clipIdsPreloaded}
        playbackRate={state.playbackRate}
        obsConnectorState={props.obsConnectorState}
        liveMediaStream={props.liveMediaStream}
        speechDetectorState={props.speechDetectorState}
        allClipsHaveSilenceDetected={allClipsHaveSilenceDetected}
        allClipsHaveText={allClipsHaveText}
        exportVideoClipsFetcher={exportVideoClipsFetcher}
        exportToDavinciResolveFetcher={exportToDavinciResolveFetcher}
        isExportModalOpen={isExportModalOpen}
        setIsExportModalOpen={setIsExportModalOpen}
        isCopied={isCopied}
        copyTranscriptToClipboard={copyTranscriptToClipboard}
        youtubeChapters={youtubeChapters}
        isChaptersCopied={isChaptersCopied}
        copyYoutubeChaptersToClipboard={copyYoutubeChaptersToClipboard}
        isAddVideoModalOpen={isAddVideoModalOpen}
        setIsAddVideoModalOpen={setIsAddVideoModalOpen}
        hasExplainerFolder={props.hasExplainerFolder}
        videoCount={props.videoCount}
        dispatch={dispatch}
        onClipFinished={() => {
          dispatch({ type: "clip-finished" });
        }}
        onUpdateCurrentTime={(time) => {
          dispatch({ type: "update-clip-current-time", time });
        }}
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
            const allSections = document.querySelectorAll('[id^="section-"]');
            if (allSections[index]) {
              allSections[index].scrollIntoView({
                behavior: "instant",
                block: "center",
              });
            }
          });
        }}
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
      <ClipTimeline
        items={props.items}
        clips={clips}
        insertionPoint={props.insertionPoint}
        selectedClipsSet={state.selectedClipsSet}
        currentClipId={currentClipId}
        currentTimeInClip={state.currentTimeInClip}
        clipComputedProps={clipComputedProps}
        clipIdsBeingTranscribed={props.clipIdsBeingTranscribed}
        generateDefaultClipSectionName={generateDefaultClipSectionName}
        onAddIntroSection={() => props.onAddClipSection("Intro")}
        onSetInsertionPoint={props.onSetInsertionPoint}
        onMoveClip={props.onMoveClip}
        onToggleBeatForClip={props.onToggleBeatForClip}
        onEditSection={(sectionId, currentName) => {
          setClipSectionNamingModal({
            mode: "edit",
            clipSectionId: sectionId,
            currentName,
          });
        }}
        onAddSectionBefore={(itemId, defaultName) => {
          setClipSectionNamingModal({
            mode: "add-at",
            position: "before",
            itemId,
            defaultName,
          });
        }}
        onAddSectionAfter={(itemId, defaultName) => {
          setClipSectionNamingModal({
            mode: "add-at",
            position: "after",
            itemId,
            defaultName,
          });
        }}
        dispatch={dispatch}
      />
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
