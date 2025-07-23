import { readFile } from "fs/promises";
import path from "node:path";
import type { Route } from "./+types/videos.$videoId";

const ROOT_DIR = `/mnt/d/finished-videos`;

export const loader = async (args: Route.LoaderArgs) => {
  const { videoId } = args.params;

  try {
    const file = await readFile(path.join(ROOT_DIR, videoId + ".mp4"));
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
