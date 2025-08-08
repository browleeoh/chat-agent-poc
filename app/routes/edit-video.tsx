import { useEffect, useRef, useState, useCallback } from "react";
import type { Route } from "./+types/edit-video";
import { Button } from "@/components/ui/button";
import {
  PauseIcon,
  PlayIcon,
  ScissorsIcon,
  TrashIcon,
  MoveIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Core data model - flat array of clips
interface Clip {
  id: string;
  source: "guest" | "host";
  sourceStartTime: number; // Start time in source video (seconds)
  duration: number; // Duration of clip (seconds)
  timelinePosition: number; // Calculated position on master timeline (seconds)
}

export default function Component(props: Route.ComponentProps) {
  // Core state
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Video refs for pre-loaded pool
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const guestVideoRef = useRef<HTMLVideoElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);

  // Animation frame for time tracking
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Find which clip contains the current timeline position
  const findClipAtTime = useCallback(
    (time: number): { clip: Clip; offset: number } | null => {
      for (const clip of clips) {
        if (
          time >= clip.timelinePosition &&
          time < clip.timelinePosition + clip.duration
        ) {
          return {
            clip,
            offset: time - clip.timelinePosition,
          };
        }
      }
      return null;
    },
    [clips]
  );

  // Update timeline positions when clips change
  useEffect(() => {
    setClips((prevClips) =>
      prevClips.map((clip, index) => ({
        ...clip,
        timelinePosition: prevClips
          .slice(0, index)
          .reduce((sum, c) => sum + c.duration, 0),
      }))
    );
  }, [clips.length]);

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateTime = () => {
      const clipInfo = findClipAtTime(currentTime);
      if (!clipInfo) return;

      const { clip, offset } = clipInfo;
      const sourceTime = clip.sourceStartTime + offset;

      // Update current video
      if (clip.source === "guest") {
        guestVideoRef.current!.currentTime = sourceTime;
        guestVideoRef.current!.volume = 1;
        hostVideoRef.current!.volume = 0;
      } else {
        hostVideoRef.current!.currentTime = sourceTime;
        hostVideoRef.current!.volume = 1;
        guestVideoRef.current!.volume = 0;
      }

      // Check if we need to switch to next clip
      if (offset >= clip.duration) {
        const nextTime = currentTime + 0.1; // Small increment
        setCurrentTime(nextTime);
      } else {
        setCurrentTime(currentTime + 0.1);
      }

      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, findClipAtTime]);

  // Handle video ended events
  const handleVideoEnded = useCallback(() => {
    const clipInfo = findClipAtTime(currentTime);
    if (!clipInfo) return;

    const nextTime = clipInfo.clip.timelinePosition + clipInfo.clip.duration;
    setCurrentTime(nextTime);
  }, [currentTime, findClipAtTime]);

  // Cut clip at current time
  const cutClipAtTime = useCallback(() => {
    const clipInfo = findClipAtTime(currentTime);
    if (!clipInfo) return;

    const { clip, offset } = clipInfo;
    if (offset <= 0 || offset >= clip.duration) return; // Can't cut at edges

    setClips((prevClips) => {
      const clipIndex = prevClips.findIndex((c) => c.id === clip.id);
      if (clipIndex === -1) return prevClips;

      const newClips = [...prevClips];

      // Create two new clips from the original
      const firstClip: Clip = {
        id: `${clip.id}-a`,
        source: clip.source,
        sourceStartTime: clip.sourceStartTime,
        duration: offset,
        timelinePosition: clip.timelinePosition,
      };

      const secondClip: Clip = {
        id: `${clip.id}-b`,
        source: clip.source,
        sourceStartTime: clip.sourceStartTime + offset,
        duration: clip.duration - offset,
        timelinePosition: clip.timelinePosition + offset,
      };

      // Replace original clip with two new clips
      newClips.splice(clipIndex, 1, firstClip, secondClip);
      return newClips;
    });
  }, [currentTime, findClipAtTime]);

  // Delete selected clip
  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) return;

    setClips((prevClips) =>
      prevClips.filter((clip) => clip.id !== selectedClipId)
    );
    setSelectedClipId(null);
  }, [selectedClipId]);

  // Seek to time
  const seekToTime = useCallback(
    (time: number) => {
      setCurrentTime(time);
      const clipInfo = findClipAtTime(time);
      if (!clipInfo) return;

      const { clip, offset } = clipInfo;
      const sourceTime = clip.sourceStartTime + offset;

      if (clip.source === "guest") {
        guestVideoRef.current!.currentTime = sourceTime;
      } else {
        hostVideoRef.current!.currentTime = sourceTime;
      }
    },
    [findClipAtTime]
  );

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate total duration
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Video</h1>

      {/* Video Display */}
      <div className="relative">
        <video
          ref={guestVideoRef}
          src={`/view-video?videoPath=${encodeURIComponent(
            VIDEO_DATA.sources.guest
          )}`}
          className="max-w-lg"
          onEnded={handleVideoEnded}
        />
        <video
          ref={hostVideoRef}
          src={`/view-video?videoPath=${encodeURIComponent(
            VIDEO_DATA.sources.host
          )}`}
          className="max-w-lg"
          onEnded={handleVideoEnded}
        />
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-2"
        >
          {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          {isPlaying ? "Pause" : "Play"}
        </Button>

        <div className="text-sm">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Timeline</span>
          <span>{clips.length} clips</span>
        </div>

        <div className="relative h-20 bg-gray-100 rounded-lg overflow-hidden">
          {/* Timeline ruler */}
          <div className="absolute top-0 left-0 right-0 h-6 bg-gray-200 border-b">
            {Array.from(
              { length: Math.ceil(totalDuration / 10) + 1 },
              (_, i) => (
                <div
                  key={i}
                  className="absolute top-1 text-xs text-gray-500"
                  style={{ left: `${((i * 10) / totalDuration) * 100}%` }}
                >
                  {formatTime(i * 10)}
                </div>
              )
            )}
          </div>

          {/* Clips */}
          <div className="absolute top-6 left-0 right-0 bottom-0">
            {clips.map((clip) => {
              const left = (clip.timelinePosition / totalDuration) * 100;
              const width = (clip.duration / totalDuration) * 100;
              const isSelected = selectedClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  className={cn(
                    "absolute h-full border cursor-pointer",
                    clip.source === "guest"
                      ? "bg-blue-200 border-blue-400"
                      : "bg-green-200 border-green-400",
                    isSelected && "ring-2 ring-blue-500"
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() => setSelectedClipId(clip.id)}
                >
                  <div className="text-xs p-1 truncate">
                    {clip.source} ({formatTime(clip.duration)})
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-6 w-0.5 h-full bg-red-500 z-10"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>
      </div>

      {/* Edit Controls */}
      <div className="flex gap-2">
        <Button
          onClick={cutClipAtTime}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ScissorsIcon size={16} />
          Cut at Playhead
        </Button>

        <Button
          onClick={deleteSelectedClip}
          variant="outline"
          disabled={!selectedClipId}
          className="flex items-center gap-2"
        >
          <TrashIcon size={16} />
          Delete Selected
        </Button>
      </div>

      {/* Clip List */}
      <div className="space-y-2">
        <h3 className="font-semibold">Clips</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {clips.map((clip) => (
            <div
              key={clip.id}
              className={cn(
                "p-2 rounded border cursor-pointer text-sm",
                clip.source === "guest"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-green-50 border-green-200",
                selectedClipId === clip.id && "ring-2 ring-blue-500"
              )}
              onClick={() => setSelectedClipId(clip.id)}
            >
              <div className="flex justify-between">
                <span className="font-medium">{clip.source}</span>
                <span className="text-gray-600">
                  {formatTime(clip.duration)}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {formatTime(clip.timelinePosition)} →{" "}
                {formatTime(clip.timelinePosition + clip.duration)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const VIDEO_DATA = {
  sources: {
    guest: "/mnt/d/Dropbox/AI Hero/Interviews/Raw/Jeff/Guest.mp4",
    host: "/mnt/d/Dropbox/AI Hero/Interviews/Raw/Jeff/Host.mp4",
  },
  clips: [
    {
      source: "guest",
      sourceVideoStartTime: 6.3,
      sourceVideoEndTime: 10.11,
    },
    {
      source: "host",
      sourceVideoStartTime: 13.433333333333334,
      sourceVideoEndTime: 20.183333333333334,
    },
    {
      source: "host",
      sourceVideoStartTime: 20.9,
      sourceVideoEndTime: 22.366666666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 22.366666666666667,
      sourceVideoEndTime: 22.909999999999997,
    },
    {
      source: "guest",
      sourceVideoStartTime: 22.909999999999997,
      sourceVideoEndTime: 27.866666666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 27.866666666666667,
      sourceVideoEndTime: 28.076666666666668,
    },
    {
      source: "host",
      sourceVideoStartTime: 28.076666666666668,
      sourceVideoEndTime: 32.346666666666664,
    },
    {
      source: "host",
      sourceVideoStartTime: 34.2,
      sourceVideoEndTime: 42.910000000000004,
    },
    {
      source: "host",
      sourceVideoStartTime: 43.63333333333333,
      sourceVideoEndTime: 59.443333333333335,
    },
    {
      source: "host",
      sourceVideoStartTime: 61.63333333333333,
      sourceVideoEndTime: 67.14333333333333,
    },
    {
      source: "host",
      sourceVideoStartTime: 67.96666666666667,
      sourceVideoEndTime: 87.71666666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 90.56666666666666,
      sourceVideoEndTime: 226.97666666666666,
    },
    {
      source: "guest",
      sourceVideoStartTime: 227.8,
      sourceVideoEndTime: 240.05,
    },
    {
      source: "host",
      sourceVideoStartTime: 243.86666666666667,
      sourceVideoEndTime: 246.11666666666667,
    },
    {
      source: "host",
      sourceVideoStartTime: 247.3,
      sourceVideoEndTime: 271.95,
    },
    {
      source: "host",
      sourceVideoStartTime: 272.6666666666667,
      sourceVideoEndTime: 282.4166666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 283.8333333333333,
      sourceVideoEndTime: 326.11333333333334,
    },
    {
      source: "guest",
      sourceVideoStartTime: 326.96666666666664,
      sourceVideoEndTime: 338.7466666666666,
    },
    {
      source: "guest",
      sourceVideoStartTime: 339.43333333333334,
      sourceVideoEndTime: 556.2833333333333,
    },
    {
      source: "host",
      sourceVideoStartTime: 557.3333333333334,
      sourceVideoEndTime: 583.9833333333333,
    },
    {
      source: "host",
      sourceVideoStartTime: 585.2666666666667,
      sourceVideoEndTime: 613.3466666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 614.2,
      sourceVideoEndTime: 676.75,
    },
    {
      source: "guest",
      sourceVideoStartTime: 677.5,
      sourceVideoEndTime: 680.31,
    },
    {
      source: "guest",
      sourceVideoStartTime: 681.4,
      sourceVideoEndTime: 694.18,
    },
    {
      source: "guest",
      sourceVideoStartTime: 694.9333333333333,
      sourceVideoEndTime: 703.0833333333333,
    },
    {
      source: "guest",
      sourceVideoStartTime: 704.0666666666667,
      sourceVideoEndTime: 741.9466666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 742.7333333333333,
      sourceVideoEndTime: 847.5833333333334,
    },
    {
      source: "guest",
      sourceVideoStartTime: 848.2666666666667,
      sourceVideoEndTime: 849.9166666666666,
    },
    {
      source: "guest",
      sourceVideoStartTime: 850.6666666666666,
      sourceVideoEndTime: 860.2166666666666,
    },
    {
      source: "guest",
      sourceVideoStartTime: 860.9666666666667,
      sourceVideoEndTime: 909.3466666666667,
    },
    {
      source: "guest",
      sourceVideoStartTime: 910.2666666666667,
      sourceVideoEndTime: 915.0766666666666,
    },
    {
      source: "guest",
      sourceVideoStartTime: 915.8,
      sourceVideoEndTime: 918.31,
    },
    {
      source: "guest",
      sourceVideoStartTime: 919.1333333333333,
      sourceVideoEndTime: 920.2433333333333,
    },
    {
      source: "guest",
      sourceVideoStartTime: 921.6,
      sourceVideoEndTime: 1007.65,
    },
    {
      source: "host",
      sourceVideoStartTime: 1009.2666666666667,
      sourceVideoEndTime: 1016.4466666666666,
    },
    {
      source: "host",
      sourceVideoStartTime: 1017.9,
      sourceVideoEndTime: 1041.85,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1042.5333333333333,
      sourceVideoEndTime: 1139.8133333333333,
    },
    {
      source: "host",
      sourceVideoStartTime: 1141.4333333333334,
      sourceVideoEndTime: 1151.3133333333335,
    },
    {
      source: "host",
      sourceVideoStartTime: 1154.3666666666666,
      sourceVideoEndTime: 1168.7166666666665,
    },
    {
      source: "host",
      sourceVideoStartTime: 1170.4333333333334,
      sourceVideoEndTime: 1188.7133333333334,
    },
    {
      source: "host",
      sourceVideoStartTime: 1189.4,
      sourceVideoEndTime: 1191.8100000000002,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1193.5,
      sourceVideoEndTime: 1212.88,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1213.6,
      sourceVideoEndTime: 1221.85,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1222.7,
      sourceVideoEndTime: 1284.68,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1285.5666666666666,
      sourceVideoEndTime: 1386.6166666666666,
    },
    {
      source: "host",
      sourceVideoStartTime: 1388.8666666666666,
      sourceVideoEndTime: 1390.6466666666665,
    },
    {
      source: "host",
      sourceVideoStartTime: 1391.6333333333334,
      sourceVideoEndTime: 1402.2433333333333,
    },
    {
      source: "guest",
      sourceVideoStartTime: 1403,
      sourceVideoEndTime: 1468.47,
    },
    {
      source: "host",
      sourceVideoStartTime: 1471,
      sourceVideoEndTime: 1473.17,
    },
  ],
};

const initialClips: Clip[] = VIDEO_DATA.clips
  .map((clip, index) => {
    const duration = clip.sourceVideoEndTime - clip.sourceVideoStartTime;

    return {
      id: `clip-${index}`,
      source: clip.source as "host" | "guest",
      sourceStartTime: clip.sourceVideoStartTime,
      duration,
    };
  })
  .map((clip, index, clips) => {
    const timelinePosition = clips
      .slice(0, index)
      .reduce((sum, c) => sum + c.duration, 0);

    return {
      ...clip,
      timelinePosition,
    };
  });
