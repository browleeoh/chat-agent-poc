import { AddStandaloneVideoModal } from "@/components/add-standalone-video-modal";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFocusRevalidate } from "@/hooks/use-focus-revalidate";
import { getVideoPath } from "@/lib/get-video";
import { formatSecondsToTimeCode } from "@/services/utils";
import { DBService } from "@/services/db-service";
import { layerLive } from "@/services/layer";
import { FileSystem } from "@effect/platform";
import { Console, Effect } from "effect";
import { ArrowLeft, Plus, Trash2, VideoIcon, VideoOffIcon } from "lucide-react";
import { useState } from "react";
import { data, Link, useFetcher } from "react-router";
import type { Route } from "./+types/videos._index";

export const meta: Route.MetaFunction = () => {
  return [{ title: "CVM - Videos" }];
};

export const loader = async () => {
  return Effect.gen(function* () {
    const db = yield* DBService;
    const fs = yield* FileSystem.FileSystem;

    const videos = yield* db.getStandaloneVideos();

    // Check export status for each video
    const hasExportedVideoMap: Record<string, boolean> = {};
    yield* Effect.forEach(videos, (video) => {
      return Effect.gen(function* () {
        const hasExportedVideo = yield* fs.exists(getVideoPath(video.id));
        hasExportedVideoMap[video.id] = hasExportedVideo;
      });
    });

    return {
      videos,
      hasExportedVideoMap,
    };
  }).pipe(
    Effect.tapErrorCause((e) => Console.dir(e, { depth: null })),
    Effect.catchAll(() => {
      return Effect.die(data("Internal server error", { status: 500 }));
    }),
    Effect.provide(layerLive),
    Effect.runPromise
  );
};

export default function Component(props: Route.ComponentProps) {
  const { videos, hasExportedVideoMap } = props.loaderData;
  const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
  const deleteVideoFetcher = useFetcher();

  useFocusRevalidate({ enabled: true });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Repos
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <VideoIcon className="w-6 h-6" />
            Standalone Videos
          </h1>
          <Button onClick={() => setIsAddVideoOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Video
          </Button>
        </div>

        <AddStandaloneVideoModal
          open={isAddVideoOpen}
          onOpenChange={setIsAddVideoOpen}
        />

        {videos.length === 0 ? (
          <div className="text-center py-12">
            <VideoIcon className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No standalone videos</h3>
            <p className="text-muted-foreground">
              Standalone videos are videos not attached to any lesson.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((video) => {
              const totalDuration = video.clips.reduce((acc, clip) => {
                return acc + (clip.sourceEndTime - clip.sourceStartTime);
              }, 0);

              return (
                <ContextMenu key={video.id}>
                  <ContextMenuTrigger asChild>
                    <Link
                      to={`/videos/${video.id}/edit`}
                      className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors cursor-context-menu"
                    >
                      <div className="flex items-center gap-3">
                        {hasExportedVideoMap[video.id] ? (
                          <VideoIcon className="w-5 h-5 flex-shrink-0" />
                        ) : (
                          <VideoOffIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium">{video.path}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatSecondsToTimeCode(totalDuration)}
                      </span>
                    </Link>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => {
                        deleteVideoFetcher.submit(
                          { videoId: video.id },
                          {
                            method: "post",
                            action: "/api/videos/delete",
                          }
                        );
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
