import type { FrontendId } from "./clip-state-reducer";
import type { OBSConnectionState } from "./obs-connector";
import type { FrontendSpeechDetectorState } from "./use-speech-detector";

/**
 * State for the clip section naming modal.
 * Supports three modes:
 * - create: Creating a new section with a default name
 * - edit: Editing an existing section's name
 * - add-at: Adding a new section before or after an existing item
 */
export type ClipSectionNamingModal =
  | { mode: "create"; defaultName: string }
  | { mode: "edit"; clipSectionId: FrontendId; currentName: string }
  | {
      mode: "add-at";
      position: "before" | "after";
      itemId: FrontendId;
      defaultName: string;
    }
  | null;

/**
 * Map of clip frontendId to computed properties used for rendering.
 * - timecode: Display string for the clip's position in the video
 * - nextLevenshtein: Text similarity score to the next clip (0-100)
 */
export type ClipComputedProps = Map<
  FrontendId,
  { timecode: string; nextLevenshtein: number }
>;

/**
 * Props for the ClipSectionDivider component.
 * Renders a visual divider between clip sections in the timeline.
 */
export type ClipSectionDividerProps = {
  name: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Props for the LiveMediaStream component.
 * Displays the live OBS/camera feed with speech detection indicators.
 */
export type LiveMediaStreamProps = {
  mediaStream: MediaStream;
  obsConnectorState: OBSConnectionState;
  speechDetectorState: FrontendSpeechDetectorState;
  showCenterLine: boolean;
};
