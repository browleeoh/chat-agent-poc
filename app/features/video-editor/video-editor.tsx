import type { ClipSectionNamingModal } from "./types";
import { ClipSectionNamingModal as ClipSectionNamingModalComponent } from "./components/clip-section-naming-modal";
import { VideoPlayerPanel } from "./components/video-player-panel";
import { ClipTimeline } from "./components/clip-timeline";
import { ErrorOverlay } from "./components/error-overlay";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useWebSocket } from "./hooks/use-websocket";
import { useClipboardOperations } from "./hooks/use-clipboard-operations";
import {
  useClipComputedProps,
  useAreAnyClipsDangerous,
} from "./hooks/use-clip-computed-props";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { useEffectReducer } from "use-effect-reducer";
import { useContextSelector } from "use-context-selector";
import type { FrontendId } from "./clip-state-reducer";
import { isClip } from "./clip-utils";
import {
  makeVideoEditorReducer,
  type videoStateReducer,
} from "./video-state-reducer";
import { ClipStateContext } from "./clip-state-context";
import { VideoStateContext } from "./video-state-context";
import {
  DANGEROUS_TEXT_SIMILARITY_THRESHOLD,
  getDatabaseClipBeforeInsertionPoint,
  calculateViewMode,
  calculateTotalDuration,
} from "./video-editor-utils";

export const VideoEditor = () => {
  // Access ClipStateContext values
  const items = useContextSelector(ClipStateContext, (v) => v!.items);
  const clipIdsBeingTranscribed = useContextSelector(
    ClipStateContext,
    (v) => v!.clipIdsBeingTranscribed
  );
  const insertionPoint = useContextSelector(
    ClipStateContext,
    (v) => v!.insertionPoint
  );
  const error = useContextSelector(ClipStateContext, (v) => v!.error);
  const obsConnectorState = useContextSelector(
    ClipStateContext,
    (v) => v!.obsConnectorState
  );
  const liveMediaStream = useContextSelector(
    ClipStateContext,
    (v) => v!.liveMediaStream
  );
  const speechDetectorState = useContextSelector(
    ClipStateContext,
    (v) => v!.speechDetectorState
  );
  const videoId = useContextSelector(ClipStateContext, (v) => v!.videoId);
  const videoPath = useContextSelector(ClipStateContext, (v) => v!.videoPath);
  const lessonPath = useContextSelector(ClipStateContext, (v) => v!.lessonPath);
  const repoName = useContextSelector(ClipStateContext, (v) => v!.repoName);
  const repoId = useContextSelector(ClipStateContext, (v) => v!.repoId);
  const lessonId = useContextSelector(ClipStateContext, (v) => v!.lessonId);
  const hasExplainerFolder = useContextSelector(
    ClipStateContext,
    (v) => v!.hasExplainerFolder
  );
  const videoCount = useContextSelector(ClipStateContext, (v) => v!.videoCount);
  const onSetInsertionPoint = useContextSelector(
    ClipStateContext,
    (v) => v!.onSetInsertionPoint
  );
  const onToggleBeatForClip = useContextSelector(
    ClipStateContext,
    (v) => v!.onToggleBeatForClip
  );
  const onMoveClip = useContextSelector(ClipStateContext, (v) => v!.onMoveClip);
  const onAddClipSection = useContextSelector(
    ClipStateContext,
    (v) => v!.onAddClipSection
  );
  const onUpdateClipSection = useContextSelector(
    ClipStateContext,
    (v) => v!.onUpdateClipSection
  );
  const onAddClipSectionAt = useContextSelector(
    ClipStateContext,
    (v) => v!.onAddClipSectionAt
  );
  const onClipsRemoved = useContextSelector(
    ClipStateContext,
    (v) => v!.onClipsRemoved
  );
  const onClipsRetranscribe = useContextSelector(
    ClipStateContext,
    (v) => v!.onClipsRetranscribe
  );

  // Filter items to get only clips (excluding clip sections)
  const clips = useMemo(() => items.filter(isClip), [items]);

  // Generate default name for new clip sections based on existing count
  const generateDefaultClipSectionName = () => {
    const existingClipSectionCount = items.filter(
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
      items.map((item) => item.frontendId),
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
        onClipsRemoved(effect.clipIds);
      },
      "retranscribe-clips": (_state, effect, _dispatch) => {
        onClipsRetranscribe(effect.clipIds);
      },
      "toggle-beat-for-clip": (_state, effect, _dispatch) => {
        onToggleBeatForClip(effect.clipId);
      },
      "move-clip": (_state, effect, _dispatch) => {
        onMoveClip(effect.clipId, effect.direction);
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
  ].filter((id) => id !== undefined);

  const currentClipId = state.currentClipId;

  const exportVideoClipsFetcher = useFetcher();
  const exportToDavinciResolveFetcher = useFetcher();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);

  // State for clip section naming modal
  const [clipSectionNamingModal, setClipSectionNamingModal] =
    useState<ClipSectionNamingModal>(null);

  // Setup keyboard shortcuts
  useKeyboardShortcuts();

  // Setup WebSocket connection for Stream Deck integration
  useWebSocket({
    setClipSectionNamingModal,
    generateDefaultClipSectionName,
  });

  // Clipboard operations for transcript and YouTube chapters
  const {
    copyTranscriptToClipboard,
    copyYoutubeChaptersToClipboard,
    isCopied,
    isChaptersCopied,
    youtubeChapters,
  } = useClipboardOperations(items);

  const totalDuration = calculateTotalDuration(clips);

  const viewMode = calculateViewMode(
    state.showLastFrameOfVideo,
    liveMediaStream,
    state.runningState
  );

  const databaseClipToShowLastFrameOf = getDatabaseClipBeforeInsertionPoint(
    clips,
    insertionPoint
  );

  const currentClip = clips.find((clip) => clip.frontendId === currentClipId);

  const allClipsHaveSilenceDetected = clips.every(
    (clip) => clip.type === "on-database"
  );

  const allClipsHaveText = clips.every(
    (clip) => clip.type === "on-database" && clip.text
  );

  // Create a map of clip frontendId -> computed properties (timecode, levenshtein)
  const clipComputedProps = useClipComputedProps(clips);
  const areAnyClipsDangerous = useAreAnyClipsDangerous(
    clips,
    clipComputedProps,
    DANGEROUS_TEXT_SIMILARITY_THRESHOLD
  );

  // Show error overlay if there's a fatal error
  if (error) {
    return <ErrorOverlay error={error} />;
  }

  // Build video state context value
  const videoStateContextValue = {
    runningState: state.runningState,
    currentClipId,
    currentTimeInClip: state.currentTimeInClip,
    selectedClipsSet: state.selectedClipsSet,
    clipIdsPreloaded: state.clipIdsPreloaded,
    playbackRate: state.playbackRate,
    showLastFrameOfVideo: state.showLastFrameOfVideo,
    dispatch,
  };

  return (
    <VideoStateContext.Provider value={videoStateContextValue}>
      <div className="flex flex-col lg:flex-row p-6 gap-6 gap-y-10">
        {/* Video Player Section - Shows first on mobile, second on desktop */}
        <VideoPlayerPanel
          videoPath={videoPath}
          videoId={videoId}
          repoName={repoName}
          lessonPath={lessonPath}
          repoId={repoId}
          lessonId={lessonId}
          totalDuration={totalDuration}
          areAnyClipsDangerous={areAnyClipsDangerous}
          items={items}
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
          obsConnectorState={obsConnectorState}
          liveMediaStream={liveMediaStream}
          speechDetectorState={speechDetectorState}
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
          hasExplainerFolder={hasExplainerFolder}
          videoCount={videoCount}
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
          onAddClipSection={onAddClipSection}
          onUpdateClipSection={onUpdateClipSection}
          onAddClipSectionAt={onAddClipSectionAt}
        />

        {/* Clips Section - Shows second on mobile, first on desktop */}
        <ClipTimeline
          items={items}
          clips={clips}
          insertionPoint={insertionPoint}
          selectedClipsSet={state.selectedClipsSet}
          currentClipId={currentClipId}
          currentTimeInClip={state.currentTimeInClip}
          clipComputedProps={clipComputedProps}
          clipIdsBeingTranscribed={clipIdsBeingTranscribed}
          generateDefaultClipSectionName={generateDefaultClipSectionName}
          onAddIntroSection={() => onAddClipSection("Intro")}
          onSetInsertionPoint={onSetInsertionPoint}
          onMoveClip={onMoveClip}
          onToggleBeatForClip={onToggleBeatForClip}
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
    </VideoStateContext.Provider>
  );
};
