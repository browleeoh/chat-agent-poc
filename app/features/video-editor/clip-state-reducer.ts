import type { DB } from "@/db/schema";

export type ClipOnDatabase = {
  type: "on-database";
  id: string;
  videoFilename: string;
  sourceStartTime: number; // Start time in source video (seconds)
  sourceEndTime: number; // End time in source video (seconds)
  text: string;
  transcribedAt: Date | null;
};

export type ClipOptimisticallyAdded = {
  type: "optimistically-added";
  id: string;
  /**
   * If true, when the optimistically added clip is replaced with the database clip,
   * the clip will be archived. Allows the user to delete the clip before it's transcribed.
   */
  shouldArchive?: boolean;
};

export type Clip = ClipOnDatabase | ClipOptimisticallyAdded;

type State = {
  clips: Clip[];
  clipIdsBeingTranscribed: Set<string>;
};

type Action =
  | {
      type: "new-optimistic-clip-detected";
    }
  | {
      type: "new-database-clips";
      clips: DB.Clip[];
    }
  | {
      type: "clips-deleted";
      clipIds: string[];
    }
  | {
      type: "clips-transcribed";
      clips: DB.Clip[];
    };

type Effect =
  | {
      type: "transcribe-clips";
      clipIds: string[];
    }
  | {
      type: "archive-clips";
      clipIds: string[];
    }
  | {
      type: "scroll-to-bottom";
    };

export const clipStateReducer =
  (reportEffect: (effect: Effect) => void) =>
  (state: State, action: Action): State => {
    switch (action.type) {
      case "new-optimistic-clip-detected": {
        reportEffect({
          type: "scroll-to-bottom",
        });
        return {
          ...state,
          clips: [
            ...state.clips,
            {
              type: "optimistically-added",
              id: crypto.randomUUID(),
            },
          ],
        };
      }
      case "new-database-clips": {
        let shouldScrollToBottom = false;

        const clips: (Clip | undefined)[] = [...state.clips];

        const clipsToArchive = new Set<string>();

        for (const databaseClip of action.clips) {
          // Find the first optimistically added clip
          const index = clips.findIndex(
            (c) => c?.type === "optimistically-added"
          );
          if (index !== -1) {
            const clipToReplace = clips[index]!;
            if (
              clipToReplace.type === "optimistically-added" &&
              clipToReplace.shouldArchive
            ) {
              clipsToArchive.add(databaseClip.id);
              clips[index] = undefined;
            } else {
              clips[index] = { type: "on-database", ...databaseClip };
            }
          } else {
            // If no optimistically added clip is found, add a new one
            clips.push({ type: "on-database", ...databaseClip });
            shouldScrollToBottom = true;
          }
        }

        if (shouldScrollToBottom) {
          reportEffect({
            type: "scroll-to-bottom",
          });
        }

        if (clipsToArchive.size > 0) {
          reportEffect({
            type: "archive-clips",
            clipIds: Array.from(clipsToArchive),
          });
        }

        const clipIdsToTranscribe = action.clips
          .map((clip) => clip.id)
          .filter((id) => !clipsToArchive.has(id));

        if (clipIdsToTranscribe.length > 0) {
          reportEffect({
            type: "transcribe-clips",
            clipIds: clipIdsToTranscribe,
          });
        }

        return {
          ...state,
          clipIdsBeingTranscribed: new Set([
            ...state.clipIdsBeingTranscribed,
            ...action.clips.map((clip) => clip.id),
          ]),
          clips: clips.filter((c) => c !== undefined),
        };
      }
      case "clips-deleted": {
        const clipsToArchive = new Set<string>();
        const clips: (Clip | undefined)[] = [...state.clips];
        for (const clipId of action.clipIds) {
          const index = clips.findIndex((c) => c?.id === clipId);
          if (index === -1) continue;

          const clipToReplace = clips[index]!;
          if (clipToReplace.type === "optimistically-added") {
            clips[index] = { ...clipToReplace, shouldArchive: true };
          } else if (clipToReplace.type === "on-database") {
            clipsToArchive.add(clipToReplace.id);
            clips[index] = undefined;
          }
        }

        if (clipsToArchive.size > 0) {
          reportEffect({
            type: "archive-clips",
            clipIds: Array.from(clipsToArchive),
          });
        }
        return {
          ...state,
          clips: clips.filter((c) => c !== undefined),
        };
      }
      case "clips-transcribed": {
        const set = new Set([...state.clipIdsBeingTranscribed]);

        action.clips.forEach((clip) => {
          set.delete(clip.id);
        });

        const textMap: Record<string, string> = action.clips.reduce(
          (acc, clip) => {
            acc[clip.id] = clip.text;
            return acc;
          },
          {} as Record<string, string>
        );

        return {
          ...state,
          clips: state.clips.map((clip) => {
            if (clip.type === "on-database" && textMap[clip.id]) {
              return { ...clip, text: textMap[clip.id]! };
            }
            return clip;
          }),
          clipIdsBeingTranscribed: set,
        };
      }
    }
    return state;
  };
