import { getVideoPath } from "@/lib/get-video";
import { createReadStream, statSync } from "fs";
import type { Route } from "./+types/videos.$videoId";

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;
  const request = args.request;

  try {
    const videoPath = getVideoPath(videoId);
    const stat = statSync(videoPath);
    const fileSize = stat.size;

    const range = request.headers.get("range");

    let start: number;
    let end: number;

    if (range) {
      // Handle range requests for video seeking
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0]!, 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    } else {
      start = 0;
      end = 1000;
    }

    const chunksize = end - start + 1;

    const stream = createReadStream(videoPath, { start, end });

    return new Response(stream as any, {
      status: 206, // Partial Content
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 404,
    });
  }
};
