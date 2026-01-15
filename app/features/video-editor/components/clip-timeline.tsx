import { InsertionPointIndicator, BeatIndicator } from "./timeline-indicators";
import { ClipItem } from "./clip-item";
import { ClipSectionItem } from "./clip-section-item";
import { PreRecordingChecklist } from "./pre-recording-checklist";
import { isClipSection } from "../clip-utils";
import type {
  TimelineItem,
  FrontendId,
  FrontendInsertionPoint,
} from "../clip-state-reducer";
import type { ClipComputedProps } from "../types";
import type { videoStateReducer } from "../video-state-reducer";

/**
 * ClipTimeline component displays the main timeline of clips and clip sections.
 *
 * Handles rendering:
 * - Pre-recording checklist (when no clips exist)
 * - Insertion point indicators (start/end/after-clip positions)
 * - Clip sections (with full interactivity)
 * - Clips (with full interactivity)
 * - Beat indicators between clips
 */
export const ClipTimeline = (props: {
  items: TimelineItem[];
  clips: TimelineItem[];
  insertionPoint: FrontendInsertionPoint;
  selectedClipsSet: Set<FrontendId>;
  currentClipId: FrontendId | undefined;
  currentTimeInClip: number;
  clipComputedProps: ClipComputedProps;
  clipIdsBeingTranscribed: Set<FrontendId>;
  generateDefaultClipSectionName: () => string;
  onAddIntroSection: () => void;
  onSetInsertionPoint: (mode: "after" | "before", clipId: FrontendId) => void;
  onMoveClip: (clipId: FrontendId, direction: "up" | "down") => void;
  onToggleBeatForClip: (clipId: FrontendId) => void;
  onEditSection: (sectionId: FrontendId, currentName: string) => void;
  onAddSectionBefore: (itemId: FrontendId, defaultName: string) => void;
  onAddSectionAfter: (itemId: FrontendId, defaultName: string) => void;
  dispatch: React.Dispatch<videoStateReducer.Action>;
}) => {
  return (
    <div className="lg:flex-1 flex gap-2 h-full order-2 lg:order-1 overflow-y-auto">
      <div className="grid gap-4 w-full p-2">
        {props.clips.length === 0 && (
          <PreRecordingChecklist onAddIntroSection={props.onAddIntroSection} />
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
                  <ClipSectionItem
                    key={item.frontendId}
                    section={item}
                    isFirstItem={isFirstItem}
                    isLastItem={isLastItem}
                    isSelected={props.selectedClipsSet.has(item.frontendId)}
                    insertionPoint={props.insertionPoint}
                    selectedClipsSet={props.selectedClipsSet}
                    dispatch={props.dispatch}
                    onSetInsertionPoint={props.onSetInsertionPoint}
                    onMoveClip={props.onMoveClip}
                    onEditSection={() => {
                      props.onEditSection(item.frontendId, item.name);
                    }}
                    onAddSectionBefore={() => {
                      props.onAddSectionBefore(
                        item.frontendId,
                        props.generateDefaultClipSectionName()
                      );
                    }}
                    onAddSectionAfter={() => {
                      props.onAddSectionAfter(
                        item.frontendId,
                        props.generateDefaultClipSectionName()
                      );
                    }}
                  />
                );
              }

              // Render clip
              const clip = item;
              const computedProps = props.clipComputedProps.get(
                clip.frontendId
              );
              const timecode = computedProps?.timecode ?? "";
              const nextLevenshtein = computedProps?.nextLevenshtein ?? 0;

              return (
                <div key={clip.frontendId}>
                  <ClipItem
                    clip={clip}
                    isFirstItem={isFirstItem}
                    isLastItem={isLastItem}
                    isSelected={props.selectedClipsSet.has(clip.frontendId)}
                    isCurrentClip={clip.frontendId === props.currentClipId}
                    currentTimeInClip={props.currentTimeInClip}
                    timecode={timecode}
                    nextLevenshtein={nextLevenshtein}
                    clipIdsBeingTranscribed={props.clipIdsBeingTranscribed}
                    onSetInsertionPoint={props.onSetInsertionPoint}
                    onMoveClip={props.onMoveClip}
                    onToggleBeatForClip={props.onToggleBeatForClip}
                    onAddSectionBefore={() => {
                      props.onAddSectionBefore(
                        clip.frontendId,
                        props.generateDefaultClipSectionName()
                      );
                    }}
                    onAddSectionAfter={() => {
                      props.onAddSectionAfter(
                        clip.frontendId,
                        props.generateDefaultClipSectionName()
                      );
                    }}
                    dispatch={props.dispatch}
                  />
                  {/* Beat indicator dots below clip */}
                  {clip.beatType === "long" && <BeatIndicator />}
                  {props.insertionPoint.type === "after-clip" &&
                    props.insertionPoint.frontendClipId === clip.frontendId && (
                      <InsertionPointIndicator />
                    )}
                </div>
              );
            })}

            {props.insertionPoint.type === "end" && <InsertionPointIndicator />}
          </>
        )}
      </div>
    </div>
  );
};
