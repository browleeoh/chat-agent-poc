import { AddVideoModal } from "@/components/add-video-modal";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatSecondsToTimeCode } from "@/services/utils";
import { LiveMediaStream } from "./live-media-stream";
import { RecordingSignalIndicator } from "./timeline-indicators";
import { TableOfContents } from "./table-of-contents";
import { ActionsDropdown } from "./actions-dropdown";
import type {
  Clip,
  ClipOnDatabase,
  FrontendId,
  TimelineItem,
} from "../clip-state-reducer";
import { isClipSection } from "../clip-utils";
import type { OBSConnectionState } from "../obs-connector";
import type { FrontendSpeechDetectorState } from "../use-speech-detector";
import { PreloadableClipManager } from "../preloadable-clip";
import type { FetcherWithComponents } from "react-router";
import { AlertTriangleIcon, ChevronLeftIcon } from "lucide-react";
import { Link } from "react-router";

/**
 * Video player panel component displaying video preview, controls, and metadata.
 * Includes live stream, video player, table of contents, and action buttons.
 */
export const VideoPlayerPanel = (props: {
  // Video metadata
  videoPath: string;
  videoId: string;
  repoName?: string;
  lessonPath?: string;
  repoId?: string;
  lessonId?: string;
  totalDuration: number;
  areAnyClipsDangerous: boolean;

  // Video state
  items: TimelineItem[];
  clips: Clip[];
  viewMode: "video-player" | "live-stream" | "last-frame";
  databaseClipToShowLastFrameOf?: ClipOnDatabase;
  clipsToAggressivelyPreload: FrontendId[];
  runningState: "playing" | "paused";
  currentClipId: FrontendId | undefined;
  currentClipProfile: string | undefined;
  currentTimeInClip: number;
  selectedClipsSet: Set<FrontendId>;
  clipIdsPreloaded: Set<FrontendId>;
  playbackRate: number;

  // OBS and media
  obsConnectorState: OBSConnectionState;
  liveMediaStream: MediaStream | null;
  speechDetectorState: FrontendSpeechDetectorState;

  // Completion flags
  allClipsHaveSilenceDetected: boolean;
  allClipsHaveText: boolean;

  // Export and actions state
  exportVideoClipsFetcher: FetcherWithComponents<unknown>;
  exportToDavinciResolveFetcher: FetcherWithComponents<unknown>;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (value: boolean) => void;
  isCopied: boolean;
  copyTranscriptToClipboard: () => Promise<void>;
  youtubeChapters: { timestamp: string; name: string }[];
  isChaptersCopied: boolean;
  copyYoutubeChaptersToClipboard: () => Promise<void>;
  isAddVideoModalOpen: boolean;
  setIsAddVideoModalOpen: (value: boolean) => void;
  hasExplainerFolder: boolean;
  videoCount: number;

  // Callbacks
  dispatch: (action: any) => void;
  onClipFinished: () => void;
  onUpdateCurrentTime: (time: number) => void;
  onSectionClick: (sectionId: FrontendId, index: number) => void;
}) => {
  return (
    <>
      <div className="lg:flex-1 relative order-1 lg:order-2">
        <div className="sticky top-6">
          <div className="">
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-1 flex items-center">
                {props.videoPath}
                {" (" + formatSecondsToTimeCode(props.totalDuration) + ")"}
                {props.areAnyClipsDangerous && (
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
                  (props.viewMode === "live-stream" ||
                    props.viewMode === "last-frame") &&
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
                {props.databaseClipToShowLastFrameOf &&
                  props.viewMode === "last-frame" &&
                  // Only show overlay if scenes match, or if no scene is detected
                  (props.obsConnectorState.type !== "obs-recording" &&
                  props.obsConnectorState.type !== "obs-connected"
                    ? true // Default to showing if OBS not connected
                    : props.databaseClipToShowLastFrameOf.scene === null ||
                      props.databaseClipToShowLastFrameOf.scene ===
                        props.obsConnectorState.scene) && (
                    <div
                      className={cn(
                        "absolute top-0 left-0 rounded-lg",
                        props.databaseClipToShowLastFrameOf.profile ===
                          "TikTok" && "w-92 aspect-[9/16]"
                      )}
                    >
                      <img
                        className="w-full h-full rounded-lg opacity-50"
                        src={`/clips/${props.databaseClipToShowLastFrameOf.databaseId}/last-frame`}
                      />
                    </div>
                  )}
              </div>
            )}
            <div
              className={cn(
                "w-full aspect-[16/9]",
                props.viewMode !== "video-player" && "hidden"
              )}
            >
              <PreloadableClipManager
                clipsToAggressivelyPreload={props.clipsToAggressivelyPreload}
                clips={props.clips
                  .filter((clip) => props.clipIdsPreloaded.has(clip.frontendId))
                  .filter((clip) => clip.type === "on-database")}
                finalClipId={props.clips[props.clips.length - 1]?.frontendId}
                state={props.runningState}
                currentClipId={props.currentClipId}
                currentClipProfile={props.currentClipProfile}
                onClipFinished={props.onClipFinished}
                onUpdateCurrentTime={props.onUpdateCurrentTime}
                playbackRate={props.playbackRate}
              />
            </div>

            <div className="flex gap-2 mt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild={props.allClipsHaveSilenceDetected}
                      variant="secondary"
                      aria-label="Go Back"
                      disabled={!props.allClipsHaveSilenceDetected}
                    >
                      {props.allClipsHaveSilenceDetected ? (
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
                  {!props.allClipsHaveSilenceDetected && (
                    <TooltipContent>
                      <p>Waiting for silence detection to complete</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                <ActionsDropdown
                  allClipsHaveSilenceDetected={
                    props.allClipsHaveSilenceDetected
                  }
                  allClipsHaveText={props.allClipsHaveText}
                  exportVideoClipsFetcher={props.exportVideoClipsFetcher}
                  exportToDavinciResolveFetcher={
                    props.exportToDavinciResolveFetcher
                  }
                  videoId={props.videoId}
                  lessonId={props.lessonId}
                  isExportModalOpen={props.isExportModalOpen}
                  setIsExportModalOpen={props.setIsExportModalOpen}
                  isCopied={props.isCopied}
                  copyTranscriptToClipboard={props.copyTranscriptToClipboard}
                  youtubeChapters={props.youtubeChapters}
                  isChaptersCopied={props.isChaptersCopied}
                  copyYoutubeChaptersToClipboard={
                    props.copyYoutubeChaptersToClipboard
                  }
                  onAddVideoClick={() => props.setIsAddVideoModalOpen(true)}
                />
              </TooltipProvider>
            </div>

            {/* Table of Contents */}
            <TableOfContents
              clipSections={props.items.filter(isClipSection)}
              selectedClipsSet={props.selectedClipsSet}
              onSectionClick={props.onSectionClick}
            />
          </div>
        </div>
      </div>

      <AddVideoModal
        lessonId={props.lessonId}
        videoCount={props.videoCount}
        hasExplainerFolder={props.hasExplainerFolder}
        open={props.isAddVideoModalOpen}
        onOpenChange={props.setIsAddVideoModalOpen}
      />
    </>
  );
};
