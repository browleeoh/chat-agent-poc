import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { Clip, FrontendId } from "../clip-state-reducer";
import type { videoStateReducer } from "../video-state-reducer";
import { DANGEROUS_TEXT_SIMILARITY_THRESHOLD } from "../video-editor-utils";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2,
  PauseIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

/**
 * Props for the ClipItem component
 */
export type ClipItemProps = {
  clip: Clip;
  isFirstItem: boolean;
  isLastItem: boolean;
  isSelected: boolean;
  isCurrentClip: boolean;
  currentTimeInClip: number;
  timecode: string;
  nextLevenshtein: number;
  clipIdsBeingTranscribed: Set<FrontendId>;
  onSetInsertionPoint: (mode: "after" | "before", clipId: FrontendId) => void;
  onMoveClip: (clipId: FrontendId, direction: "up" | "down") => void;
  onToggleBeatForClip: (clipId: FrontendId) => void;
  onAddSectionBefore: () => void;
  onAddSectionAfter: () => void;
  dispatch: (action: videoStateReducer.Action) => void;
};

/**
 * Individual clip item in the timeline with thumbnail, transcript, and context menu
 */
export const ClipItem = (props: ClipItemProps) => {
  const {
    clip,
    isFirstItem,
    isLastItem,
    isSelected,
    isCurrentClip,
    currentTimeInClip,
    timecode,
    nextLevenshtein,
    clipIdsBeingTranscribed,
    onSetInsertionPoint,
    onMoveClip,
    onToggleBeatForClip,
    onAddSectionBefore,
    onAddSectionAfter,
    dispatch,
  } = props;

  const duration =
    clip.type === "on-database"
      ? clip.sourceEndTime - clip.sourceStartTime
      : null;

  const percentComplete = duration ? currentTimeInClip / duration : 0;

  const isPortrait =
    clip.type === "on-database" &&
    (clip.profile === "TikTok" || clip.profile === "Portrait");

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          className={cn(
            "bg-gray-800 rounded-md text-left relative overflow-hidden allow-keydown flex w-full",
            isSelected && "outline-2 outline-gray-200 bg-gray-700",
            isCurrentClip && "bg-blue-900"
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
                  isPortrait ? "w-24 aspect-[9/16]" : "w-32 aspect-[16/9]",
                  clipIdsBeingTranscribed.has(clip.frontendId) &&
                    "opacity-50 grayscale"
                )}
              />
              {/* Loading spinner overlay */}
              {clipIdsBeingTranscribed.has(clip.frontendId) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
              {/* Timecode overlay on image */}
              <div
                className={cn(
                  "absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-black/60 text-gray-100 flex items-center gap-1",
                  isCurrentClip && "text-blue-100",
                  isSelected && "text-white"
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
            {isCurrentClip && (
              <div
                className="absolute top-0 left-0 h-full bg-blue-700 z-0 rounded"
                style={{
                  width: `${percentComplete * 100}%`,
                }}
              />
            )}

            {/* Transcript text */}
            <div className="z-10 relative text-white text-sm leading-6">
              {clipIdsBeingTranscribed.has(clip.frontendId) ? (
                clip.type === "on-database" &&
                !clip.transcribedAt &&
                !clip.text && (
                  <span className="text-gray-400">Transcribing...</span>
                )
              ) : clip.type === "on-database" ? (
                <>
                  {nextLevenshtein > DANGEROUS_TEXT_SIMILARITY_THRESHOLD && (
                    <span className="text-orange-500 mr-2 text-base font-semibold inline-flex items-center">
                      <AlertTriangleIcon className="w-4 h-4 mr-2" />
                      {nextLevenshtein.toFixed(0)}%
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-gray-100",
                      isCurrentClip && "text-white"
                    )}
                  >
                    {clip.text}
                  </span>
                </>
              ) : (
                <span className="text-gray-400">Detecting silence...</span>
              )}
            </div>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            onSetInsertionPoint("before", clip.frontendId);
          }}
        >
          <ChevronLeftIcon />
          Insert Before
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onSetInsertionPoint("after", clip.frontendId);
          }}
        >
          <ChevronRightIcon />
          Insert After
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onAddSectionBefore}>
          <PlusIcon />
          Add Section Before
        </ContextMenuItem>
        <ContextMenuItem onSelect={onAddSectionAfter}>
          <PlusIcon />
          Add Section After
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={isFirstItem}
          onSelect={() => {
            onMoveClip(clip.frontendId, "up");
          }}
        >
          <ArrowUpIcon />
          Move Up
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isLastItem}
          onSelect={() => {
            onMoveClip(clip.frontendId, "down");
          }}
        >
          <ArrowDownIcon />
          Move Down
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            onToggleBeatForClip(clip.frontendId);
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
        <ContextMenuSeparator />
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
  );
};
