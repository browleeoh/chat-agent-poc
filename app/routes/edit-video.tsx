import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  extractAudioFromVideoURL,
  getWaveformForTimeRange,
} from "@/services/video-editing";
import { useEffect, useReducer, useRef, useState } from "react";
import type { Route } from "./+types/edit-video";

// Core data model - flat array of clips
interface Clip {
  id: string;
  inputVideo: string;
  sourceStartTime: number; // Start time in source video (seconds)
  sourceEndTime: number; // End time in source video (seconds)
}

interface ClipWithIndex extends Clip {
  index: number;
}

const getPrioritizedListOfClips = (opts: {
  clips: Clip[];
  currentClipId: string;
}): ClipWithIndex[] => {
  const { clips, currentClipId } = opts;

  const clipsWithIndex = clips.map((clip, index) => ({
    ...clip,
    index,
  }));

  const currentClipIndex = clipsWithIndex.findIndex(
    (clip) => clip.id === currentClipId
  );

  if (currentClipIndex === -1) {
    throw new Error("Current clip not found");
  }

  const currentClip = clipsWithIndex[currentClipIndex]!;
  const nextClip = clipsWithIndex[currentClipIndex + 1];
  const nextNextClip = clipsWithIndex[currentClipIndex + 2];
  const previousClip = clipsWithIndex[currentClipIndex - 1];
  const clipsBeforePreviousClip = clipsWithIndex.slice(0, currentClipIndex - 2);
  const clipsAfterNextClip = clipsWithIndex.slice(currentClipIndex + 3);

  return [
    currentClip,
    nextClip,
    nextNextClip,
    previousClip,
    ...clipsAfterNextClip,
    ...clipsBeforePreviousClip,
  ].filter((clip) => clip !== undefined);
};

type ClipState = "playing" | "paused";

const PRELOAD_PLAY_AMOUNT = 0.1;

const Clip = (props: {
  playbackRate: number;
  clip: Clip;
  onFinish: () => void;
  aggressivePreload: boolean;
  onPreloadComplete: () => void;
  hidden: boolean;
  state: ClipState;
  onUpdateCurrentTime: (time: number) => void;
}) => {
  const [preloadState, setPreloadState] = useState<"preloading" | "finished">(
    "preloading"
  );
  const ref = useRef<HTMLVideoElement>(null);

  const preloadFrom = props.clip.sourceStartTime - PRELOAD_PLAY_AMOUNT;
  const preloadTo = props.clip.sourceStartTime;
  const modifiedEndTime = props.clip.sourceEndTime - 0.06;

  const isPlaying = !props.hidden && props.state === "playing";

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    ref.current.playbackRate = props.playbackRate;
  }, [props.playbackRate, ref.current]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (preloadState === "preloading" && props.aggressivePreload) {
      ref.current.muted = true;
      ref.current.play();
      return;
    }

    if (props.hidden || !props.aggressivePreload) {
      ref.current.pause();
      ref.current.currentTime = props.clip.sourceStartTime;
      ref.current.muted = false;
      return;
    }

    if (isPlaying) {
      ref.current.play();
    } else {
      ref.current.pause();
    }
  }, [
    props.hidden,
    ref.current,
    props.state,
    preloadState,
    props.aggressivePreload,
  ]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (!isPlaying && preloadState === "finished") {
      return;
    }
    let animationId: number | null = null;

    const checkCurrentTime = () => {
      const currentTime = ref.current!.currentTime;

      if (preloadState === "preloading") {
        if (currentTime >= preloadTo) {
          setPreloadState("finished");
          ref.current?.pause();
          ref.current!.muted = false;
          ref.current!.currentTime = preloadTo;
          props.onPreloadComplete();
        }
      } else if (currentTime >= modifiedEndTime) {
        props.onFinish();
        ref.current!.currentTime = props.clip.sourceStartTime;
        return;
      }

      props.onUpdateCurrentTime(currentTime - props.clip.sourceStartTime);

      animationId = requestAnimationFrame(checkCurrentTime);
    };

    animationId = requestAnimationFrame(checkCurrentTime);

    return () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    ref.current,
    isPlaying,
    preloadState,
    modifiedEndTime,
    props.clip.sourceStartTime,
    preloadTo,
    props.onUpdateCurrentTime,
  ]);

  return (
    <video
      key={props.clip.id}
      src={`/view-video?videoPath=${props.clip.inputVideo}#t=${preloadFrom},${modifiedEndTime}`}
      className={cn(props.hidden && "hidden")}
      ref={ref}
    />
  );
};

const TimelineView = (props: {
  playbackRate: number;
  clips: Clip[];
  clipsToAggressivelyPreload: string[];
  state: ClipState;
  currentClipId: string;
  onClipFinished: () => void;
  onUpdateCurrentTime: (time: number) => void;
}) => {
  return (
    <div className="">
      {props.clips.map((clip) => {
        const isCurrentlyPlaying = clip.id === props.currentClipId;

        const onFinish = () => {
          if (!isCurrentlyPlaying) {
            return;
          }

          props.onClipFinished();
        };

        return (
          <div key={clip.id}>
            <Clip
              playbackRate={props.playbackRate}
              clip={clip}
              key={clip.id}
              onFinish={onFinish}
              aggressivePreload={props.clipsToAggressivelyPreload.includes(
                clip.id
              )}
              hidden={!isCurrentlyPlaying}
              state={props.state}
              onUpdateCurrentTime={(time) => {
                if (isCurrentlyPlaying) {
                  props.onUpdateCurrentTime(time);
                }
              }}
              onPreloadComplete={() => {}}
            />
          </div>
        );
      })}
    </div>
  );
};

export const clientLoader = async () => {
  const audioBuffer = await extractAudioFromVideoURL(
    `/view-video?videoPath=${initialClips[0]!.inputVideo}`
  );

  const clipsWithWaveformData = initialClips.map((clip) => {
    const waveformDataForTimeRange = getWaveformForTimeRange(
      audioBuffer,
      clip.sourceStartTime,
      clip.sourceEndTime,
      200
    );
    return {
      ...clip,
      waveformDataForTimeRange,
    };
  });

  return { clipsWithWaveformData };
};

interface ClipWithWaveformData extends Clip {
  waveformDataForTimeRange: number[];
}

type State = {
  clipIdsPreloaded: Set<string>;
  runningState: ClipState;
  clips: ClipWithWaveformData[];
  currentClipId: string;
  currentTimeInClip: number;
  selectedClipsSet: Set<string>;
  playbackRate: number;
};

type Action =
  | {
      type: "press-pause";
    }
  | {
      type: "press-play";
    }
  | {
      type: "click-clip";
      clipId: string;
      ctrlKey: boolean;
      shiftKey: boolean;
    }
  | {
      type: "update-clip-current-time";
      time: number;
    }
  | {
      type: "clip-finished";
    }
  | {
      type: "press-delete";
    }
  | {
      type: "press-space-bar";
    }
  | {
      type: "press-return";
    }
  | {
      type: "press-arrow-left";
    }
  | {
      type: "press-arrow-right";
    }
  | {
      type: "press-l";
    }
  | {
      type: "press-home";
    }
  | {
      type: "press-end";
    }
  | {
      type: "press-k";
    };

const preloadSelectedClips = (state: State) => {
  const currentClipIndex = state.clips.findIndex(
    (clip) => clip.id === state.currentClipId
  );

  if (currentClipIndex === -1) {
    return state;
  }

  const nextClip = state.clips[currentClipIndex + 1];
  const nextNextClip = state.clips[currentClipIndex + 2];

  if (nextClip) {
    state.clipIdsPreloaded.add(nextClip.id);
  }
  if (nextNextClip) {
    state.clipIdsPreloaded.add(nextNextClip.id);
  }

  const newClipIdsPreloaded = state.clipIdsPreloaded
    .add(state.currentClipId)
    .union(state.selectedClipsSet);

  console.log(
    "preloadSelectedClips",
    newClipIdsPreloaded,
    nextClip,
    nextNextClip
  );

  return {
    ...state,
    clipIdsPreloaded: newClipIdsPreloaded,
  };
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "press-space-bar":
      return {
        ...state,
        runningState: state.runningState === "playing" ? "paused" : "playing",
      };
    case "press-home":
      return { ...state, selectedClipsSet: new Set([state.clips[0]!.id]) };
    case "press-end":
      return {
        ...state,
        selectedClipsSet: new Set([state.clips[state.clips.length - 1]!.id]),
      };
    case "press-l":
      if (state.playbackRate === 2) {
        return {
          ...state,
          playbackRate: 2,
          runningState: state.runningState === "playing" ? "paused" : "playing",
        };
      }
      return { ...state, playbackRate: 2, runningState: "playing" };
    case "press-k":
      if (state.playbackRate === 1) {
        return {
          ...state,
          playbackRate: 1,
          runningState: state.runningState === "playing" ? "paused" : "playing",
        };
      }
      return { ...state, playbackRate: 1, runningState: "playing" };
    case "press-pause":
      return { ...state, runningState: "paused" };
    case "press-play":
      return { ...state, runningState: "playing" };
    case "press-return":
      if (state.selectedClipsSet.size === 0) {
        return state;
      }
      const mostRecentClipId = Array.from(state.selectedClipsSet).pop()!;

      return preloadSelectedClips({
        ...state,
        currentClipId: mostRecentClipId,
        runningState: "playing",
        currentTimeInClip: 0,
        selectedClipsSet: new Set([mostRecentClipId]),
      });
    case "click-clip":
      if (action.ctrlKey) {
        const newSelectedClipsSet = new Set(state.selectedClipsSet);
        if (newSelectedClipsSet.has(action.clipId)) {
          newSelectedClipsSet.delete(action.clipId);
        } else {
          newSelectedClipsSet.add(action.clipId);
        }
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: newSelectedClipsSet,
        });
      } else if (action.shiftKey) {
        const mostRecentClipId = Array.from(state.selectedClipsSet).pop();

        if (!mostRecentClipId) {
          return preloadSelectedClips({
            ...state,
            selectedClipsSet: new Set([action.clipId]),
          });
        }

        const mostRecentClipIndex = state.clips.findIndex(
          (clip) => clip.id === mostRecentClipId
        );

        if (mostRecentClipIndex === -1) {
          return state;
        }

        const newClipIndex = state.clips.findIndex(
          (clip) => clip.id === action.clipId
        );

        if (newClipIndex === -1) {
          return state;
        }
        const firstIndex = Math.min(mostRecentClipIndex, newClipIndex);
        const lastIndex = Math.max(mostRecentClipIndex, newClipIndex);

        const clipsBetweenMostRecentClipIndexAndNewClipIndex =
          state.clips.slice(firstIndex, lastIndex + 1);

        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set(
            clipsBetweenMostRecentClipIndexAndNewClipIndex.map(
              (clip) => clip.id
            )
          ),
        });
      } else {
        if (state.selectedClipsSet.size > 1) {
          return preloadSelectedClips({
            ...state,
            selectedClipsSet: new Set([action.clipId]),
          });
        }

        if (state.selectedClipsSet.has(action.clipId)) {
          return preloadSelectedClips({
            ...state,
            selectedClipsSet: new Set(),
          });
        }
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set([action.clipId]),
        });
      }
    case "press-delete":
      const lastClipBeingDeletedIndex = state.clips.findLastIndex((clip) => {
        return state.selectedClipsSet.has(clip.id);
      });

      if (lastClipBeingDeletedIndex === -1) {
        return state;
      }

      const clipToMoveSelectionTo = state.clips[lastClipBeingDeletedIndex + 1];
      const backupClipToMoveSelectionTo =
        state.clips[lastClipBeingDeletedIndex - 1];
      const finalBackupClipToMoveSelectionTo = state.clips[0];

      const newSelectedClipId =
        clipToMoveSelectionTo?.id ??
        backupClipToMoveSelectionTo?.id ??
        finalBackupClipToMoveSelectionTo?.id;

      const newClips = state.clips.filter(
        (clip) => !state.selectedClipsSet.has(clip.id)
      );

      const isCurrentClipDeleted = state.selectedClipsSet.has(
        state.currentClipId
      );

      return preloadSelectedClips({
        ...state,
        clips: newClips,
        selectedClipsSet: new Set(
          [newSelectedClipId].filter((id) => id !== undefined)
        ),
        runningState: isCurrentClipDeleted ? "paused" : state.runningState,
        currentClipId: isCurrentClipDeleted
          ? newSelectedClipId!
          : state.currentClipId,
      });
    case "update-clip-current-time":
      return { ...state, currentTimeInClip: action.time };
    case "clip-finished": {
      const currentClipIndex = state.clips.findIndex(
        (clip) => clip.id === state.currentClipId
      );

      if (currentClipIndex === -1) {
        return state;
      }

      const nextClip = state.clips[currentClipIndex + 1];
      const nextNextClip = state.clips[currentClipIndex + 2];
      console.log("Clip Finished", nextClip, nextNextClip);

      const newClipIdsPreloaded = state.clipIdsPreloaded;

      if (nextClip) {
        newClipIdsPreloaded.add(nextClip.id);
      }

      if (nextNextClip) {
        newClipIdsPreloaded.add(nextNextClip.id);
      }

      if (nextClip) {
        return {
          ...state,
          currentClipId: nextClip.id,
          clipIdsPreloaded: newClipIdsPreloaded,
        };
      } else {
        return { ...state, runningState: "paused" };
      }
    }
    case "press-arrow-left": {
      if (state.selectedClipsSet.size === 0) {
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set([state.currentClipId]),
        });
      }

      const mostRecentClipId = Array.from(state.selectedClipsSet).pop()!;

      const currentClipIndex = state.clips.findIndex(
        (clip) => clip.id === mostRecentClipId
      );
      const previousClip = state.clips[currentClipIndex - 1];
      if (previousClip) {
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set([previousClip.id]),
        });
      } else {
        return state;
      }
    }
    case "press-arrow-right": {
      if (state.selectedClipsSet.size === 0) {
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set([state.currentClipId]),
        });
      }

      const mostRecentClipId = Array.from(state.selectedClipsSet).pop()!;

      const currentClipIndex = state.clips.findIndex(
        (clip) => clip.id === mostRecentClipId
      );
      const nextClip = state.clips[currentClipIndex + 1];
      if (nextClip) {
        return preloadSelectedClips({
          ...state,
          selectedClipsSet: new Set([nextClip.id]),
        });
      } else {
        return state;
      }
    }
  }
  action satisfies never;
};

export default function Component(props: Route.ComponentProps) {
  const [state, dispatch] = useReducer(reducer, {
    runningState: "paused",
    clips: props.loaderData.clipsWithWaveformData,
    currentClipId: initialClips[0]!.id,
    currentTimeInClip: 0,
    selectedClipsSet: new Set<string>(),
    clipIdsPreloaded: new Set<string>([
      initialClips[0]!.id,
      initialClips[1]!.id,
    ]),
    playbackRate: 1,
  });

  const currentClipIndex = state.clips.findIndex(
    (clip) => clip.id === state.currentClipId
  );

  const nextClip = state.clips[currentClipIndex + 1];

  const selectedClipId = Array.from(state.selectedClipsSet)[0];

  const clipsToAggressivelyPreload = [
    state.currentClipId,
    nextClip?.id,
    selectedClipId,
  ].filter((id) => id !== undefined);

  const currentClipId = state.currentClipId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("handleKeyDown", e.key);
      if (e.key === " ") {
        if (e.repeat) return;
        dispatch({ type: "press-space-bar" });
      } else if (e.key === "Delete") {
        dispatch({ type: "press-delete" });
      } else if (e.key === "Enter") {
        dispatch({ type: "press-return" });
      } else if (e.key === "ArrowLeft") {
        dispatch({ type: "press-arrow-left" });
      } else if (e.key === "ArrowRight") {
        dispatch({ type: "press-arrow-right" });
      } else if (e.key === "l") {
        dispatch({ type: "press-l" });
      } else if (e.key === "k") {
        dispatch({ type: "press-k" });
      } else if (e.key === "Home") {
        dispatch({ type: "press-home" });
      } else if (e.key === "End") {
        dispatch({ type: "press-end" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex gap-6">
      <div className="flex-1 p-6 flex-wrap flex gap-2 h-full">
        {state.clips.map((clip) => {
          const duration = clip.sourceEndTime - clip.sourceStartTime;

          const waveformData = clip.waveformDataForTimeRange;

          const percentComplete = state.currentTimeInClip / duration;

          return (
            <button
              key={clip.id}
              style={{ width: `${duration * 50}px` }}
              className={cn(
                "bg-gray-800 p-2 rounded-md text-left block relative overflow-hidden h-12",
                state.selectedClipsSet.has(clip.id) &&
                  "outline-2 outline-blue-200 bg-gray-600",
                clip.id === currentClipId && "bg-blue-500"
              )}
              onClick={(e) => {
                dispatch({
                  type: "click-clip",
                  clipId: clip.id,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                });
              }}
            >
              {/* Moving bar indicator */}
              {clip.id === currentClipId && (
                <div
                  className="absolute top-0 left-0 w-full h-full bg-blue-400 z-0"
                  style={{
                    width: `${percentComplete * 100}%`,
                    height: "100%",
                  }}
                />
              )}
              <div className="absolute bottom-0 left-0 w-full h-full flex items-end z-0">
                {waveformData.map((data, index) => {
                  return (
                    <div
                      key={index}
                      style={{ height: `${data * 120}px`, width: "0.5%" }}
                      className="bg-blue-300 z-0"
                    />
                  );
                })}
              </div>
              {/* <Button
                className="z-10 relative"
                onClick={() => {
                  setClips(clips.filter((c) => c.id !== clip.id));

                  if (clip.id === currentClipId) {
                    if (nextClip) {
                      setCurrentClipId(nextClip.id);
                    } else if (previousClip) {
                      setCurrentClipId(previousClip.id);
                    }
                  }
                }}
              >
                Delete
              </Button> */}
              <div
                className={cn(
                  "absolute top-0 right-0 text-xs mt-1 mr-2 text-gray-500",
                  clip.id === currentClipId && "text-blue-200"
                )}
              >
                {formatSecondsToTime(clip.sourceEndTime - clip.sourceStartTime)}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex-1 relative p-6">
        <div className="sticky top-0">
          <TimelineView
            clipsToAggressivelyPreload={clipsToAggressivelyPreload}
            clips={state.clips.filter((clip) =>
              state.clipIdsPreloaded.has(clip.id)
            )}
            state={state.runningState}
            currentClipId={currentClipId}
            onClipFinished={() => {
              dispatch({ type: "clip-finished" });
            }}
            onUpdateCurrentTime={(time) => {
              dispatch({ type: "update-clip-current-time", time });
            }}
            playbackRate={state.playbackRate}
          />
        </div>
      </div>
    </div>
  );
}

const VIDEO_DATA = {
  clips: [
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "2.87",
      endTime: "6.37",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "9.37",
      endTime: "13.55",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "16.95",
      endTime: "20.15",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "36.12",
      endTime: "40.58",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "46.13",
      endTime: "50.68",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "54.68",
      endTime: "60.34",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "64.83",
      endTime: "69.04",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "77.57",
      endTime: "79.62",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "94.92",
      endTime: "98.83",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "105.03",
      endTime: "107.28",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "111.50",
      endTime: "115.65",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "120.78",
      endTime: "126.41",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "131.40",
      endTime: "137.71",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "140.95",
      endTime: "143.66",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "147.10",
      endTime: "152.16",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "165.03",
      endTime: "169.79",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "177.75",
      endTime: "180.28",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "183.55",
      endTime: "185.90",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "191.57",
      endTime: "196.95",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "203.68",
      endTime: "210.43",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "218.03",
      endTime: "221.89",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "225.18",
      endTime: "230.33",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "244.77",
      endTime: "248.55",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "268.32",
      endTime: "272.53",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "275.82",
      endTime: "279.50",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "282.52",
      endTime: "288.57",
    },
    {
      inputVideo: "/mnt/d/raw-footage/2025-09-09_14-03-40.mp4",
      startTime: "303.83",
      endTime: "307.83",
    },
  ],
} as const;

const initialClips: Clip[] = VIDEO_DATA.clips
  .map((clip) => {
    return {
      ...clip,
      sourceVideoStartTime: parseFloat(clip.startTime),
      sourceVideoEndTime: parseFloat(clip.endTime),
    };
  })
  .map((clip, index) => {
    return {
      id: `clip-${index}`,
      inputVideo: clip.inputVideo,
      sourceStartTime: clip.sourceVideoStartTime,
      sourceEndTime: clip.sourceVideoEndTime,
    };
  });

// Should return 3.2s
const formatSecondsToTime = (seconds: number) => {
  return seconds.toFixed(1) + "s";
};
