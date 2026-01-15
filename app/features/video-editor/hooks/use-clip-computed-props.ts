import { useMemo } from "react";
import { formatSecondsToTimeCode } from "@/services/utils";
import type { Clip } from "../clip-state-reducer";
import { calculateTextSimilarity } from "../clip-utils";
import type { ClipComputedProps } from "../types";

/**
 * Computes derived properties for each clip in the timeline:
 * - timecode: The timestamp where this clip starts in the final video
 * - nextLevenshtein: Text similarity score with the next clip (for duplicate detection)
 *
 * @param clips - Array of all clips in the timeline
 * @returns Map of clip frontendId to computed properties
 */
export const useClipComputedProps = (clips: Clip[]): ClipComputedProps => {
  return useMemo(() => {
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
};

/**
 * Checks if any clips have dangerously similar text to their next clip
 * (potential duplicate detection warning)
 *
 * @param clips - Array of all clips in the timeline
 * @param clipComputedProps - Map of clip computed properties
 * @param threshold - Similarity threshold above which clips are considered dangerous
 * @returns true if any clips exceed the danger threshold
 */
export const useAreAnyClipsDangerous = (
  clips: Clip[],
  clipComputedProps: ClipComputedProps,
  threshold: number
): boolean => {
  return useMemo(() => {
    return clips.some((clip) => {
      if (clip.type !== "on-database") return false;
      const props = clipComputedProps.get(clip.frontendId);
      return props && props.nextLevenshtein > threshold;
    });
  }, [clips, clipComputedProps, threshold]);
};
