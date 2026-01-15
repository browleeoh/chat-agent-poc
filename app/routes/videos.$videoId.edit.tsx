import type { DB } from "@/db/schema";
import type {
  ApiInsertionPoint,
  ClipOnDatabase,
  ClipSectionOnDatabase,
  DatabaseId,
  FrontendId,
  FrontendInsertionPoint,
  TimelineItem,
} from "@/features/video-editor/clip-state-reducer";
import {
  clipStateReducer,
  createFrontendId,
} from "@/features/video-editor/clip-state-reducer";
import type { BeatType } from "@/services/tt-cli-service";
import { useOBSConnector } from "@/features/video-editor/obs-connector";
import { VideoEditor } from "@/features/video-editor/video-editor";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { FileSystem } from "@effect/platform";
import { Console, Effect } from "effect";
import { useEffectReducer } from "use-effect-reducer";
import type { Route } from "./+types/videos.$videoId.edit";
import { useMemo, useCallback } from "react";
import { INSERTION_POINT_ID } from "@/features/video-editor/constants";
import { data } from "react-router";
import { ClipStateContext } from "@/features/video-editor/clip-state-context";

// Core data model - flat array of clips

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;
  return Effect.gen(function* () {
    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;
    const video = yield* db.getVideoWithClipsById(videoId);

    // Check if lesson has explainer folder (only for lesson-attached videos)
    const lesson = video.lesson;
    const hasExplainerFolder = lesson
      ? yield* fs.exists(
          `${lesson.section.repoVersion.repo.filePath}/${lesson.section.path}/${lesson.path}/explainer`
        )
      : false;

    // Combine clips and clipSections into a unified items array, sorted by order
    const clipItems: Array<{ type: "clip"; order: string; data: DB.Clip }> = (
      video.clips as DB.Clip[]
    ).map((clip) => ({
      type: "clip" as const,
      order: clip.order,
      data: clip,
    }));

    const clipSectionItems: Array<{
      type: "clip-section";
      order: string;
      data: DB.ClipSection;
    }> = (video.clipSections as DB.ClipSection[]).map((clipSection) => ({
      type: "clip-section" as const,
      order: clipSection.order,
      data: clipSection,
    }));

    // Sort using ASCII ordering to match PostgreSQL COLLATE "C" behavior.
    // fractional-indexing generates keys like "Zz" to sort before "a0",
    // which requires byte ordering (where 'Z' (90) < 'a' (97)).
    // localeCompare() uses locale-aware sorting which doesn't match this.
    const sortedItems = [...clipItems, ...clipSectionItems].sort((a, b) =>
      a.order < b.order ? -1 : a.order > b.order ? 1 : 0
    );

    return {
      video,
      items: sortedItems,
      waveformData: undefined,
      hasExplainerFolder,
      videoCount: lesson?.videos.length ?? 1,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchTag("NotFoundError", () => {
      return Effect.die(data("Video not found", { status: 404 }));
    }),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};

export default function Component(props: Route.ComponentProps) {
  return <ComponentInner {...props} key={props.loaderData.video.id} />;
}

export const ComponentInner = (props: Route.ComponentProps) => {
  const [clipState, dispatch] = useEffectReducer(
    clipStateReducer,
    {
      items: props.loaderData.items.map((item): TimelineItem => {
        if (item.type === "clip") {
          const clip = item.data;
          return {
            ...clip,
            type: "on-database",
            frontendId: createFrontendId(),
            databaseId: clip.id,
            insertionOrder: null,
            beatType: clip.beatType as BeatType,
          } satisfies ClipOnDatabase;
        } else {
          const clipSection = item.data;
          return {
            type: "clip-section-on-database",
            frontendId: createFrontendId(),
            databaseId: clipSection.id,
            name: clipSection.name,
            insertionOrder: null,
          } satisfies ClipSectionOnDatabase;
        }
      }),
      clipIdsBeingTranscribed: new Set() satisfies Set<FrontendId>,
      insertionOrder: 0,
      insertionPoint: { type: "end" },
      error: null,
    },
    {
      "archive-clips": (_state, effect, dispatch) => {
        fetch("/clips/archive", {
          method: "POST",
          body: JSON.stringify({ clipIds: effect.clipIds }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "archive-clips",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to archive clips",
            });
          });
      },
      "transcribe-clips": (_state, effect, dispatch) => {
        fetch("/clips/transcribe", {
          method: "POST",
          body: JSON.stringify({ clipIds: effect.clipIds }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then((clips: DB.Clip[]) => {
            dispatch({
              type: "clips-transcribed",
              clips: clips.map((clip) => ({
                databaseId: clip.id,
                text: clip.text,
              })),
            });
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "transcribe-clips",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to transcribe clips",
            });
          });
      },
      "scroll-to-insertion-point": () => {
        window.scrollTo({
          top:
            (document.getElementById(INSERTION_POINT_ID)?.offsetTop ?? 0) - 200,
          behavior: "smooth",
        });
      },
      "update-clips": (_state, effect, dispatch) => {
        fetch("/clips/update", {
          method: "POST",
          body: JSON.stringify({ clips: effect.clips }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "update-clips",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to update clips",
            });
          });
      },
      "update-beat": (_state, effect, dispatch) => {
        fetch("/clips/update-beat", {
          method: "POST",
          body: JSON.stringify({
            clipId: effect.clipId,
            beatType: effect.beatType,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "update-beat",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to update beat",
            });
          });
      },
      "reorder-clip": (_state, effect, dispatch) => {
        fetch("/clips/reorder", {
          method: "POST",
          body: JSON.stringify({
            clipId: effect.clipId,
            direction: effect.direction,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "reorder-clip",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to reorder clip",
            });
          });
      },
      "reorder-clip-section": (_state, effect, dispatch) => {
        fetch("/clip-sections/reorder", {
          method: "POST",
          body: JSON.stringify({
            clipSectionId: effect.clipSectionId,
            direction: effect.direction,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "reorder-clip-section",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to reorder clip section",
            });
          });
      },
      "archive-clip-sections": (_state, effect, dispatch) => {
        fetch("/clip-sections/archive", {
          method: "POST",
          body: JSON.stringify({ clipSectionIds: effect.clipSectionIds }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "archive-clip-sections",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to archive clip sections",
            });
          });
      },
      "create-clip-section": (state, effect, dispatch) => {
        // Convert frontend insertion point to database insertion point for API
        const apiInsertionPoint = toDatabaseInsertionPoint(
          effect.insertionPoint,
          state.items
        );
        fetch("/clip-sections/create-at-insertion-point", {
          method: "POST",
          body: JSON.stringify({
            videoId: props.loaderData.video.id,
            name: effect.name,
            insertionPoint: apiInsertionPoint,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "create-clip-section",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to create clip section",
            });
          });
      },
      "update-clip-section": (_state, effect, dispatch) => {
        fetch("/clip-sections/update", {
          method: "POST",
          body: JSON.stringify({
            clipSectionId: effect.clipSectionId,
            name: effect.name,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "update-clip-section",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to update clip section",
            });
          });
      },
      "create-clip-section-at": (_state, effect, dispatch) => {
        fetch("/clip-sections/create-at-position", {
          method: "POST",
          body: JSON.stringify({
            videoId: props.loaderData.video.id,
            name: effect.name,
            position: effect.position,
            targetItemId: effect.targetItemId,
            targetItemType: effect.targetItemType,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
          })
          .catch((error) => {
            dispatch({
              type: "effect-failed",
              effectType: "create-clip-section-at",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to create clip section at position",
            });
          });
      },
    }
  );

  const databaseInsertionPoint = useMemo(
    () => toDatabaseInsertionPoint(clipState.insertionPoint, clipState.items),
    [clipState.insertionPoint, clipState.items]
  );

  const obsConnector = useOBSConnector({
    videoId: props.loaderData.video.id,
    insertionPoint: databaseInsertionPoint,
    onNewDatabaseClips: (databaseClips) => {
      dispatch({ type: "new-database-clips", clips: databaseClips });
    },
    onNewClipOptimisticallyAdded: ({ scene, profile, soundDetectionId }) => {
      dispatch({
        type: "new-optimistic-clip-detected",
        scene,
        profile,
        soundDetectionId,
      });
    },
  });

  // Create stable callbacks for context
  const onSetInsertionPoint = useCallback(
    (mode: "after" | "before", clipId: FrontendId) => {
      if (mode === "after") {
        dispatch({ type: "set-insertion-point-after", clipId });
      } else {
        dispatch({ type: "set-insertion-point-before", clipId });
      }
    },
    [dispatch]
  );

  const onDeleteLatestInsertedClip = useCallback(() => {
    dispatch({ type: "delete-latest-inserted-clip" });
  }, [dispatch]);

  const onToggleBeat = useCallback(() => {
    dispatch({ type: "toggle-beat-at-insertion-point" });
  }, [dispatch]);

  const onToggleBeatForClip = useCallback(
    (clipId: FrontendId) => {
      dispatch({ type: "toggle-beat-for-clip", clipId });
    },
    [dispatch]
  );

  const onMoveClip = useCallback(
    (clipId: FrontendId, direction: "up" | "down") => {
      dispatch({ type: "move-clip", clipId, direction });
    },
    [dispatch]
  );

  const onAddClipSection = useCallback(
    (name: string) => {
      dispatch({ type: "add-clip-section", name });
    },
    [dispatch]
  );

  const onUpdateClipSection = useCallback(
    (clipSectionId: FrontendId, name: string) => {
      dispatch({ type: "update-clip-section", clipSectionId, name });
    },
    [dispatch]
  );

  const onAddClipSectionAt = useCallback(
    (name: string, position: "before" | "after", itemId: FrontendId) => {
      dispatch({ type: "add-clip-section-at", name, position, itemId });
    },
    [dispatch]
  );

  const onClipsRemoved = useCallback(
    (clipIds: FrontendId[]) => {
      dispatch({ type: "clips-deleted", clipIds: clipIds });
    },
    [dispatch]
  );

  const onClipsRetranscribe = useCallback(
    (clipIds: FrontendId[]) => {
      const databaseIds = clipIds
        .map((frontendId) => {
          const clip = clipState.items.find((c) => c.frontendId === frontendId);
          return clip?.type === "on-database" ? clip.databaseId : null;
        })
        .filter((id): id is DatabaseId => id !== null);

      fetch("/clips/transcribe", {
        method: "POST",
        body: JSON.stringify({ clipIds: databaseIds }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((clips: DB.Clip[]) => {
          dispatch({
            type: "clips-transcribed",
            clips: clips.map((clip) => ({
              databaseId: clip.id,
              text: clip.text,
            })),
          });
        })
        .catch((error) => {
          dispatch({
            type: "effect-failed",
            effectType: "transcribe-clips",
            message:
              error instanceof Error
                ? error.message
                : "Failed to transcribe clips",
          });
        });
    },
    [clipState.items, dispatch]
  );

  // Filter items to remove archived optimistic items
  const filteredItems = useMemo(
    () =>
      clipState.items.filter((item) => {
        if (item.type === "optimistically-added" && item.shouldArchive) {
          return false;
        }
        if (
          item.type === "clip-section-optimistically-added" &&
          item.shouldArchive
        ) {
          return false;
        }
        return true;
      }),
    [clipState.items]
  );

  // Build context value with stable callbacks
  const clipStateContextValue = useMemo(
    () => ({
      items: filteredItems,
      clipIdsBeingTranscribed: clipState.clipIdsBeingTranscribed,
      insertionPoint: clipState.insertionPoint,
      error: clipState.error,
      obsConnectorState: obsConnector.state,
      liveMediaStream: obsConnector.mediaStream,
      speechDetectorState: obsConnector.speechDetectorState,
      videoId: props.loaderData.video.id,
      videoPath: props.loaderData.video.path,
      lessonPath: props.loaderData.video.lesson?.path,
      repoName: props.loaderData.video.lesson?.section.repoVersion.repo.name,
      repoId: props.loaderData.video.lesson?.section.repoVersion.repo.id,
      lessonId: props.loaderData.video.lesson?.id,
      hasExplainerFolder: props.loaderData.hasExplainerFolder,
      videoCount: props.loaderData.videoCount,
      onSetInsertionPoint,
      onDeleteLatestInsertedClip,
      onToggleBeat,
      onToggleBeatForClip,
      onMoveClip,
      onAddClipSection,
      onUpdateClipSection,
      onAddClipSectionAt,
      onClipsRemoved,
      onClipsRetranscribe,
    }),
    [
      filteredItems,
      clipState.clipIdsBeingTranscribed,
      clipState.insertionPoint,
      clipState.error,
      obsConnector.state,
      obsConnector.mediaStream,
      obsConnector.speechDetectorState,
      props.loaderData.video.id,
      props.loaderData.video.path,
      props.loaderData.video.lesson?.path,
      props.loaderData.video.lesson?.section.repoVersion.repo.name,
      props.loaderData.video.lesson?.section.repoVersion.repo.id,
      props.loaderData.video.lesson?.id,
      props.loaderData.hasExplainerFolder,
      props.loaderData.videoCount,
      onSetInsertionPoint,
      onDeleteLatestInsertedClip,
      onToggleBeat,
      onToggleBeatForClip,
      onMoveClip,
      onAddClipSection,
      onUpdateClipSection,
      onAddClipSectionAt,
      onClipsRemoved,
      onClipsRetranscribe,
    ]
  );

  return (
    <ClipStateContext.Provider value={clipStateContextValue}>
      <VideoEditor />
    </ClipStateContext.Provider>
  );
};

const toDatabaseInsertionPoint = (
  insertionPoint: FrontendInsertionPoint,
  items: TimelineItem[]
): ApiInsertionPoint => {
  if (insertionPoint.type === "start") {
    return { type: "start" };
  }
  if (insertionPoint.type === "after-clip") {
    const frontendClipIndex = items.findIndex(
      (c) => c.frontendId === insertionPoint.frontendClipId
    );
    if (frontendClipIndex === -1) {
      throw new Error("Clip not found");
    }

    const previousDatabaseClipId = items
      .slice(0, frontendClipIndex + 1)
      .findLast((c) => c.type === "on-database")?.databaseId;

    if (!previousDatabaseClipId) {
      return { type: "start" };
    }

    return { type: "after-clip", databaseClipId: previousDatabaseClipId };
  }

  if (insertionPoint.type === "after-clip-section") {
    const frontendClipSectionIndex = items.findIndex(
      (c) => c.frontendId === insertionPoint.frontendClipSectionId
    );
    if (frontendClipSectionIndex === -1) {
      throw new Error("Clip section not found");
    }

    // Find the last database clip before or at this clip section
    const previousDatabaseClipId = items
      .slice(0, frontendClipSectionIndex + 1)
      .findLast((c) => c.type === "on-database")?.databaseId;

    // For now, the backend doesn't understand clip sections,
    // so we return the last database clip or start
    if (!previousDatabaseClipId) {
      return { type: "start" };
    }

    return { type: "after-clip", databaseClipId: previousDatabaseClipId };
  }

  if (insertionPoint.type === "end") {
    const lastDatabaseClipId = items.findLast(
      (c) => c.type === "on-database"
    )?.databaseId;
    if (!lastDatabaseClipId) {
      return { type: "start" };
    }
    return { type: "after-clip", databaseClipId: lastDatabaseClipId };
  }

  throw new Error("Invalid insertion point");
};
