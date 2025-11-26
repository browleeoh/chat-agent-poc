import type { DB } from "@/db/schema";
import type { EffectReducer } from "use-effect-reducer";
import type { Brand } from "./utils";

export type DatabaseId = Brand<string, "DatabaseId">;
export type FrontendId = Brand<string, "FrontendId">;

export type ClipOnDatabase = {
  type: "on-database";
  frontendId: FrontendId;
  databaseId: DatabaseId;
  videoFilename: string;
  sourceStartTime: number; // Start time in source video (seconds)
  sourceEndTime: number; // End time in source video (seconds)
  text: string;
  transcribedAt: Date | null;
  scene: string | null;
  profile: string | null;
};

export type ClipOptimisticallyAdded = {
  type: "optimistically-added";
  frontendId: FrontendId;
  scene: string;
  profile: string;
  /**
   * If true, when the optimistically added clip is replaced with the database clip,
   * the clip will be archived. Allows the user to delete the clip before it's transcribed.
   */
  shouldArchive?: boolean;
};

export const createFrontendId = (): FrontendId => {
  return crypto.randomUUID() as FrontendId;
};

export type Clip = ClipOnDatabase | ClipOptimisticallyAdded;

export namespace clipStateReducer {
  export type State = {
    clips: Clip[];
    clipIdsBeingTranscribed: Set<FrontendId>;
    insertionPointClipId: FrontendId | null;
    lastInsertedClipId: FrontendId | null;
    insertionPointDatabaseId: DatabaseId | null;
  };

  export type Action =
    | {
        type: "new-optimistic-clip-detected";
        scene: string;
        profile: string;
      }
    | {
        type: "new-database-clips";
        clips: DB.Clip[];
      }
    | {
        type: "clips-deleted";
        clipIds: FrontendId[];
      }
    | {
        type: "clips-transcribed";
        clips: {
          databaseId: DatabaseId;
          text: string;
        }[];
      }
    | {
        type: "set-insertion-point";
        clipId: FrontendId;
      }
    | {
        type: "delete-latest-inserted-clip";
      };

  export type Effect =
    | {
        type: "transcribe-clips";
        clipIds: DatabaseId[];
      }
    | {
        type: "archive-clips";
        clipIds: DatabaseId[];
      }
    | {
        type: "scroll-to-bottom";
      }
    | {
        type: "update-clips";
        clips: [DatabaseId, { scene: string; profile: string }][];
      };
}

export const clipStateReducer: EffectReducer<
  clipStateReducer.State,
  clipStateReducer.Action,
  clipStateReducer.Effect
> = (
  state: clipStateReducer.State,
  action: clipStateReducer.Action,
  exec
): clipStateReducer.State => {
  switch (action.type) {
    case "new-optimistic-clip-detected": {
      const newFrontendId = createFrontendId();
      const newClip = {
        type: "optimistically-added" as const,
        frontendId: newFrontendId,
        scene: action.scene,
        profile: action.profile,
      };

      let newClips: Clip[];
      if (state.insertionPointClipId === null) {
        // Append to end
        newClips = [...state.clips, newClip];
      } else {
        // Insert after insertion point
        const insertionPointIndex = state.clips.findIndex(
          (c) => c.frontendId === state.insertionPointClipId
        );
        if (insertionPointIndex === -1) {
          // Insertion point not found, append to end
          newClips = [...state.clips, newClip];
        } else {
          newClips = [
            ...state.clips.slice(0, insertionPointIndex + 1),
            newClip,
            ...state.clips.slice(insertionPointIndex + 1),
          ];
        }
      }

      exec({
        type: "scroll-to-bottom",
      });

      return {
        ...state,
        clips: newClips,
        insertionPointClipId: newFrontendId,
        lastInsertedClipId: newFrontendId,
        insertionPointDatabaseId: null,
      };
    }
    case "new-database-clips": {
      let shouldScrollToBottom = false;

      const clips: (Clip | undefined)[] = [...state.clips];

      const clipsToArchive = new Set<DatabaseId>();
      const databaseClipIdsToTranscribe = new Set<DatabaseId>();
      const frontendClipIdsToTranscribe = new Set<FrontendId>();
      const clipsToUpdateScene = new Map<
        DatabaseId,
        { scene: string; profile: string }
      >();

      let newInsertionPointClipId = state.insertionPointClipId;
      let newInsertionPointDatabaseId = state.insertionPointDatabaseId;
      let newLastInsertedClipId = state.lastInsertedClipId;

      for (const databaseClip of action.clips) {
        // Find the first optimistically added clip
        const index = clips.findIndex(
          (c) => c?.type === "optimistically-added"
        );
        if (index !== -1) {
          const frontendClip = clips[index]!;
          if (
            frontendClip.type === "optimistically-added" &&
            frontendClip.shouldArchive
          ) {
            clipsToArchive.add(databaseClip.id);
            clips[index] = undefined;
          } else if (frontendClip.type === "optimistically-added") {
            const newDatabaseClip: ClipOnDatabase = {
              ...databaseClip,
              type: "on-database",
              frontendId: frontendClip.frontendId,
              databaseId: databaseClip.id,
              scene: frontendClip.scene,
              profile: frontendClip.profile,
            };
            clips[index] = newDatabaseClip;
            clipsToUpdateScene.set(databaseClip.id, {
              scene: frontendClip.scene,
              profile: frontendClip.profile,
            });
            frontendClipIdsToTranscribe.add(frontendClip.frontendId);
            databaseClipIdsToTranscribe.add(databaseClip.id);

            // Update insertion point to database ID if this was the insertion point
            if (newInsertionPointClipId === frontendClip.frontendId) {
              newInsertionPointDatabaseId = databaseClip.id;
            }
            newLastInsertedClipId = frontendClip.frontendId;
          }
        } else {
          const newFrontendId = createFrontendId();
          // If no optimistically added clip is found, add a new one
          clips.push({
            type: "on-database",
            ...databaseClip,
            frontendId: newFrontendId,
            databaseId: databaseClip.id,
          });
          frontendClipIdsToTranscribe.add(newFrontendId);
          databaseClipIdsToTranscribe.add(databaseClip.id);
          newInsertionPointClipId = newFrontendId;
          newInsertionPointDatabaseId = databaseClip.id;
          newLastInsertedClipId = newFrontendId;
          shouldScrollToBottom = true;
        }
      }

      if (clipsToUpdateScene.size > 0) {
        exec({
          type: "update-clips",
          clips: Array.from(clipsToUpdateScene.entries()),
        });
      }

      if (shouldScrollToBottom) {
        exec({
          type: "scroll-to-bottom",
        });
      }

      if (clipsToArchive.size > 0) {
        exec({
          type: "archive-clips",
          clipIds: Array.from(clipsToArchive),
        });
      }

      if (databaseClipIdsToTranscribe.size > 0) {
        exec({
          type: "transcribe-clips",
          clipIds: Array.from(databaseClipIdsToTranscribe),
        });
      }

      return {
        ...state,
        clipIdsBeingTranscribed: new Set([
          ...Array.from(state.clipIdsBeingTranscribed),
          ...Array.from(frontendClipIdsToTranscribe),
        ]),
        clips: clips.filter((c) => c !== undefined),
        insertionPointClipId: newInsertionPointClipId,
        insertionPointDatabaseId: newInsertionPointDatabaseId,
        lastInsertedClipId: newLastInsertedClipId,
      };
    }
    case "clips-deleted": {
      const clipsToArchive = new Set<DatabaseId>();
      const clips: (Clip | undefined)[] = [...state.clips];
      for (const clipId of action.clipIds) {
        const index = clips.findIndex((c) => c?.frontendId === clipId);
        if (index === -1) continue;

        const clipToReplace = clips[index]!;
        if (clipToReplace.type === "optimistically-added") {
          clips[index] = { ...clipToReplace, shouldArchive: true };
        } else if (clipToReplace.type === "on-database") {
          clipsToArchive.add(clipToReplace.databaseId);
          clips[index] = undefined;
        }
      }

      if (clipsToArchive.size > 0) {
        exec({
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

      const textMap: Record<DatabaseId, string> = action.clips.reduce(
        (acc, clip) => {
          acc[clip.databaseId] = clip.text;
          return acc;
        },
        {} as Record<DatabaseId, string>
      );

      return {
        ...state,
        clips: state.clips.map((clip) => {
          if (clip.type === "on-database" && textMap[clip.databaseId]) {
            set.delete(clip.frontendId);
            return { ...clip, text: textMap[clip.databaseId]! };
          }
          return clip;
        }),
        clipIdsBeingTranscribed: set,
      };
    }
    case "set-insertion-point": {
      const clip = state.clips.find((c) => c.frontendId === action.clipId);
      if (!clip) {
        return state;
      }

      return {
        ...state,
        insertionPointClipId: action.clipId,
        insertionPointDatabaseId:
          clip.type === "on-database" ? clip.databaseId : null,
      };
    }
    case "delete-latest-inserted-clip": {
      if (!state.lastInsertedClipId) {
        return state;
      }

      const clipIndex = state.clips.findIndex(
        (c) => c.frontendId === state.lastInsertedClipId
      );
      if (clipIndex === -1) {
        return state;
      }

      const clipToDelete = state.clips[clipIndex]!;

      // Archive if it's a database clip
      if (clipToDelete.type === "on-database") {
        exec({
          type: "archive-clips",
          clipIds: [clipToDelete.databaseId],
        });
      }

      // Update insertion point if we're deleting it
      let newInsertionPointClipId = state.insertionPointClipId;
      let newInsertionPointDatabaseId = state.insertionPointDatabaseId;

      if (state.insertionPointClipId === state.lastInsertedClipId) {
        // Fall back to previous clip in array
        const previousClip = state.clips[clipIndex - 1];
        if (previousClip) {
          newInsertionPointClipId = previousClip.frontendId;
          newInsertionPointDatabaseId =
            previousClip.type === "on-database"
              ? previousClip.databaseId
              : null;
        } else {
          // No previous clip, append to end
          newInsertionPointClipId = null;
          newInsertionPointDatabaseId = null;
        }
      }

      return {
        ...state,
        clips: state.clips.filter((c) => c.frontendId !== state.lastInsertedClipId),
        insertionPointClipId: newInsertionPointClipId,
        insertionPointDatabaseId: newInsertionPointDatabaseId,
        lastInsertedClipId: null,
      };
    }
  }
  return state;
};
