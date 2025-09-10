import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/edit-video";

// Core data model - flat array of clips
interface Clip {
  id: string;
  inputVideo: string;
  sourceStartTime: number; // Start time in source video (seconds)
  sourceEndTime: number; // End time in source video (seconds)
}

const getPrioritizedListOfClips = (opts: {
  clips: Clip[];
  currentClipId: string;
}) => {
  const { clips, currentClipId } = opts;

  const sortedClips = clips.sort(
    (a, b) => a.sourceStartTime - b.sourceStartTime
  );

  const currentClipIndex = sortedClips.findIndex(
    (clip) => clip.id === currentClipId
  );

  if (currentClipIndex === -1) {
    throw new Error("Current clip not found");
  }

  const currentClip = sortedClips[currentClipIndex]!;
  const nextClip = sortedClips[currentClipIndex + 1];
  const nextNextClip = sortedClips[currentClipIndex + 2];
  const previousClip = sortedClips[currentClipIndex - 1];
  const clipsBeforePreviousClip = sortedClips.slice(0, currentClipIndex - 2);
  const clipsAfterNextClip = sortedClips.slice(currentClipIndex + 3);

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

const Clip = (props: {
  clip: Clip;
  onFinish: () => void;
  onPreloadComplete: () => void;
  hidden: boolean;
  state: ClipState;
}) => {
  const ref = useRef<HTMLVideoElement>(null);

  const isPlaying = !props.hidden && props.state === "playing";

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (props.hidden) {
      ref.current.pause();
      return;
    }

    ref.current.playbackRate = 1;

    if (isPlaying) {
      ref.current.play();
    } else {
      ref.current.pause();
    }
  }, [props.hidden, ref.current, props.state]);

  const modifiedEndTime = props.clip.sourceEndTime;

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (!isPlaying) {
      return;
    }
    let animationId: number | null = null;

    const checkCurrentTime = () => {
      if (ref.current!.currentTime >= modifiedEndTime) {
        props.onFinish();
      }
      animationId = requestAnimationFrame(checkCurrentTime);
    };

    animationId = requestAnimationFrame(checkCurrentTime);

    return () => {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [ref.current, isPlaying]);

  return (
    <video
      key={props.clip.id}
      src={`/view-video?videoPath=${props.clip.inputVideo}#t=${props.clip.sourceStartTime},${modifiedEndTime}`}
      onCanPlayThrough={() => {
        props.onPreloadComplete();
      }}
      className={cn(props.hidden && "hidden")}
      ref={ref}
      preload="auto"
    />
  );
};

const TimelineView = (props: { clips: Clip[]; state: ClipState }) => {
  const firstClip = props.clips[0];

  if (!firstClip) {
    throw new Error("No clips");
  }

  const [currentClipId, setCurrentClipId] = useState<string>(firstClip.id);

  const prioritizedClips = getPrioritizedListOfClips({
    clips: props.clips,
    currentClipId,
  }).slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {prioritizedClips.map((clip, index, array) => {
          const nextClip = array[index + 1];
          const isCurrentlyPlaying = clip.id === currentClipId;

          const onFinish = () => {
            if (!isCurrentlyPlaying) {
              return;
            }

            console.log("onFinish", nextClip);
            if (nextClip) {
              setCurrentClipId(nextClip.id);
            }
          };

          return (
            <div key={clip.id}>
              <Clip
                clip={clip}
                key={clip.id}
                onFinish={onFinish}
                hidden={!isCurrentlyPlaying}
                state={props.state}
                onPreloadComplete={() => {
                  console.log("onPreloadComplete", clip.id);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function Component(props: Route.ComponentProps) {
  const [state, setState] = useState<ClipState>("paused");
  return (
    <div className="p-6 space-y-6">
      <TimelineView clips={initialClips} state={state} />
      <Button onClick={() => setState("playing")}>Play</Button>
      <Button onClick={() => setState("paused")}>Pause</Button>
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
