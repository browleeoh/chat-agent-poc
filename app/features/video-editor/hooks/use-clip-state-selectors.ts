import { useMemo } from "react";
import { useContextSelector } from "use-context-selector";
import { ClipStateContext } from "../clip-state-context";
import { VideoStateContext } from "../video-state-context";
import type { FrontendId } from "../clip-state-reducer";
import { isClip } from "../clip-utils";

/**
 * Derives clips array from items by filtering out clip sections.
 * Used in 10+ places throughout the video editor.
 */
export const useClips = () => {
  const items = useContextSelector(ClipStateContext, (v) => v!.items);
  return useMemo(() => items.filter(isClip), [items]);
};

/**
 * Derives current clip object by combining currentClipId with clips array.
 * Returns undefined if no clip is currently selected.
 */
export const useCurrentClip = () => {
  const clips = useClips();
  const currentClipId = useContextSelector(
    VideoStateContext,
    (v) => v!.currentClipId
  );
  return useMemo(
    () => clips.find((clip) => clip.frontendId === currentClipId),
    [clips, currentClipId]
  );
};

/**
 * Checks if an item (clip or section) is currently selected.
 * Used for both clips and clip sections in the timeline to show selection highlight.
 *
 * @param itemId - The frontendId of the item to check
 * @returns true if the item is in the selectedClipsSet
 */
export const useIsSelected = (itemId: FrontendId) => {
  return useContextSelector(VideoStateContext, (v) =>
    v!.selectedClipsSet.has(itemId)
  );
};

/**
 * Checks if a clip is the currently playing clip.
 * Used to show the play progress bar overlay on the active clip.
 *
 * @param clipId - The frontendId of the clip to check
 * @returns true if the clip is currently playing
 */
export const useIsCurrentClip = (clipId: FrontendId) => {
  return useContextSelector(
    VideoStateContext,
    (v) => v!.currentClipId === clipId
  );
};
