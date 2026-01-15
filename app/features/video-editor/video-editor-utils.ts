import type {
  Clip,
  ClipOnDatabase,
  FrontendInsertionPoint,
} from "./clip-state-reducer";

/**
 * Threshold for text similarity above which clips are considered dangerously similar
 * (potential duplicate detection warning)
 */
export const DANGEROUS_TEXT_SIMILARITY_THRESHOLD = 40;

/**
 * Gets the database clip that comes before the current insertion point in the timeline.
 * Used to determine which clip's last frame to show when recording is paused.
 *
 * @param clips - Array of all clips in the timeline
 * @param insertionPoint - Current insertion point location
 * @returns The database clip before the insertion point, or undefined if insertion point is at start
 */
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

/**
 * Calculates the view mode for the video player panel based on current state.
 *
 * @param showLastFrameOfVideo - Whether to show the last frame of the video
 * @param liveMediaStream - The live media stream from OBS (if available)
 * @param runningState - Current playback state ("playing" or "paused")
 * @returns The view mode: "last-frame", "video-player", or "live-stream"
 */
export const calculateViewMode = (
  showLastFrameOfVideo: boolean,
  liveMediaStream: MediaStream | null,
  runningState: "playing" | "paused"
): "video-player" | "live-stream" | "last-frame" => {
  if (showLastFrameOfVideo) {
    return "last-frame";
  } else if (!liveMediaStream || runningState === "playing") {
    return "video-player";
  } else {
    return "live-stream";
  }
};

/**
 * Calculates the total duration of all clips in seconds.
 *
 * @param clips - Array of all clips (only database clips with duration are counted)
 * @returns Total duration in seconds
 */
export const calculateTotalDuration = (clips: Clip[]): number => {
  return clips.reduce((acc, clip) => {
    if (clip.type === "on-database") {
      return acc + (clip.sourceEndTime - clip.sourceStartTime);
    }
    return acc;
  }, 0);
};
