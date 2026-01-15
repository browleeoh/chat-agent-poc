import { createContext } from "use-context-selector";
import type {
  TimelineItem,
  FrontendId,
  FrontendInsertionPoint,
  EditorError,
} from "./clip-state-reducer";
import type { OBSConnectionState } from "./obs-connector";
import type { FrontendSpeechDetectorState } from "./use-speech-detector";

/**
 * Context for clip state and OBS connector state.
 * This context is provided at the route level and contains:
 * - Timeline items (clips and clip sections)
 * - Transcription state
 * - Insertion point for new clips
 * - Error state
 * - OBS connector state (connection, media stream, speech detection)
 * - Loader data (video/lesson metadata)
 * - Action callbacks (all stable refs via useCallback)
 */
export type ClipStateContextValue = {
  // State
  items: TimelineItem[];
  clipIdsBeingTranscribed: Set<FrontendId>;
  insertionPoint: FrontendInsertionPoint;
  error: EditorError | null;

  // OBS
  obsConnectorState: OBSConnectionState;
  liveMediaStream: MediaStream | null;
  speechDetectorState: FrontendSpeechDetectorState;

  // Loader data
  videoId: string;
  videoPath: string;
  lessonPath?: string;
  repoName?: string;
  repoId?: string;
  lessonId?: string;
  hasExplainerFolder: boolean;
  videoCount: number;

  // Actions (stable refs via useCallback in provider)
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
  onClipsRemoved: (clipIds: FrontendId[]) => void;
  onClipsRetranscribe: (clipIds: FrontendId[]) => void;
};

export const ClipStateContext = createContext<ClipStateContextValue | null>(
  null
);
