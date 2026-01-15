import { createContext } from "use-context-selector";
import type { FrontendId } from "./clip-state-reducer";
import type { videoStateReducer } from "./video-state-reducer";

/**
 * Context for video playback state.
 * This context is provided within VideoEditor and contains:
 * - Playback state (playing/paused, current clip, time, rate)
 * - Selection state (selected clips for bulk operations)
 * - Preloading state (which clips have been preloaded)
 * - Last frame display toggle
 * - Dispatch function for state updates
 */
export type VideoStateContextValue = {
  runningState: "playing" | "paused";
  currentClipId: FrontendId | undefined;
  currentTimeInClip: number;
  selectedClipsSet: Set<FrontendId>;
  clipIdsPreloaded: Set<FrontendId>;
  playbackRate: number;
  showLastFrameOfVideo: boolean;
  dispatch: (action: videoStateReducer.Action) => void;
};

export const VideoStateContext = createContext<VideoStateContextValue | null>(
  null
);
