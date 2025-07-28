import { getVideoPath } from "@/lib/get-video";
import { readFile } from "fs/promises";
import type { Route } from "./+types/videos.$videoId";

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;

  try {
    const file = await readFile(getVideoPath(videoId));
    return new Response(file, {
      headers: {
        "Content-Type": "video/mp4",
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 404,
    });
  }
};
