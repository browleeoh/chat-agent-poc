import { Button } from "@/components/ui/button";
import {
  OBSConnectionButton,
  useOBSConnector,
} from "@/features/video-editor/obs-connector";
import { TitleSection } from "@/features/video-editor/title-section";
import {
  LiveMediaStream,
  RecordingSignalIndicator,
  VideoEditor,
} from "@/features/video-editor/video-editor";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { Effect } from "effect";
import { ChevronLeftIcon } from "lucide-react";
import { Link, useFetcher } from "react-router";
import type { Route } from "./+types/videos.$videoId.edit";
import { useDebounceIdStore } from "@/features/video-editor/utils";
import { useEffect, useState } from "react";
import type { Clip } from "@/features/video-editor/reducer";

// Core data model - flat array of clips

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;
  return Effect.gen(function* () {
    const db = yield* DBService;
    const video = yield* db.getVideoWithClipsById(videoId);

    return { video, clips: video.clips, waveformData: undefined };
  }).pipe(Effect.provide(layerLive), Effect.runPromise);
};

// export const clientLoader = async (args: Route.ClientLoaderArgs) => {
//   const { video } = await args.serverLoader();

//   if (video.clips.length === 0) {
//     return { clips: [], video };
//   }

//   const audioBuffer = await extractAudioFromVideoURL(
//     `/view-video?videoPath=${video.clips[0]!.videoFilename}`
//   );

//   const waveformData = video.clips.reduce((acc, clip) => {
//     acc[clip.id] = getWaveformForTimeRange(
//       audioBuffer,
//       clip.sourceStartTime,
//       clip.sourceEndTime,
//       200
//     );
//     return acc;
//   }, {} as Record<string, number[]>);

//   return { clips: video.clips, waveformData, video };
// };

const useDebounceTranscribeClips = (
  onClipsUpdated: (clips: Clip[]) => void
) => {
  const transcribe = useDebounceIdStore(
    (ids) =>
      fetch("/clips/transcribe", {
        method: "POST",
        body: JSON.stringify({ clipIds: ids }),
      })
        .then((res) => res.json())
        .then((clips) => {
          onClipsUpdated(clips);
        }),
    500
  );

  return {
    transcribe,
  };
};

export default function Component(props: Route.ComponentProps) {
  const refetch = useFetcher();
  const [clips, setClips] = useState<Clip[]>(props.loaderData.clips);

  const obsConnector = useOBSConnector({
    videoId: props.loaderData.video.id,
    onNewClips: (clips) => {
      setClips((prev) => [...prev, ...clips]);
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    },
  });

  const transcribeClips = useDebounceTranscribeClips((modifiedClips) => {
    const newClips = clips.map((clip) => {
      const modifiedClip = modifiedClips.find((c) => c.id === clip.id);
      if (modifiedClip) {
        return modifiedClip;
      }
      return clip;
    });
    setClips(newClips);
  });

  const [clipIdsBeingTranscribed, setClipIdsBeingTranscribed] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    if (clips.length === 0) {
      return;
    }

    const clipIdsToTranscribe = clips
      .filter(
        (clip) =>
          !clip.transcribedAt &&
          !clipIdsBeingTranscribed.has(clip.id) &&
          !clip.text
      )
      .map((clip) => clip.id);

    setClipIdsBeingTranscribed(
      (prev) => new Set([...prev, ...clipIdsToTranscribe])
    );

    if (clipIdsToTranscribe.length > 0) {
      transcribeClips.transcribe(clipIdsToTranscribe);
    }
  }, [clips]);

  if (clips.length === 0) {
    return (
      <div className="flex p-6 w-full">
        <div className="flex-1">
          <TitleSection
            videoPath={props.loaderData.video.path}
            lessonPath={props.loaderData.video.lesson.path}
            repoName={props.loaderData.video.lesson.section.repo.name}
          />
          <p className="text-sm text-muted-foreground mb-4">No clips found</p>
          <div className="flex gap-2 mb-4">
            <Button asChild variant="secondary">
              <Link
                to={`/?repoId=${props.loaderData.video.lesson.section.repo.id}#${props.loaderData.video.lesson.id}`}
              >
                <ChevronLeftIcon className="w-4 h-4 mr-1" />
                Go Back
              </Link>
            </Button>
            <OBSConnectionButton state={obsConnector.state} />
          </div>
        </div>
        {obsConnector.mediaStream && (
          <div className="w-full flex-1 relative">
            {obsConnector.state.type === "obs-recording" && (
              <RecordingSignalIndicator />
            )}

            <LiveMediaStream
              mediaStream={obsConnector.mediaStream}
              speechDetectorState={obsConnector.speechDetectorState}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <VideoEditor
      onClipsRemoved={(clipIds) => {
        setClips((prev) => prev.filter((clip) => !clipIds.includes(clip.id)));
      }}
      obsConnectorState={obsConnector.state}
      clips={clips}
      // waveformDataForClip={props.loaderData.waveformData ?? {}}
      repoId={props.loaderData.video.lesson.section.repo.id}
      lessonId={props.loaderData.video.lesson.id}
      videoPath={props.loaderData.video.path}
      lessonPath={props.loaderData.video.lesson.path}
      repoName={props.loaderData.video.lesson.section.repo.name}
      videoId={props.loaderData.video.id}
      liveMediaStream={obsConnector.mediaStream}
      speechDetectorState={obsConnector.speechDetectorState}
      clipIdsBeingTranscribed={clipIdsBeingTranscribed}
    />
  );
}
