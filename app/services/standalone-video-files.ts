import path from "node:path";

/**
 * Gets the base directory for storing standalone video files from environment variable.
 * Defaults to "./standalone-video-files" if not configured.
 */
export function getStandaloneVideoFilesBaseDir(): string {
  return process.env.STANDALONE_VIDEO_FILES_DIR || "./standalone-video-files";
}

/**
 * Constructs the full path to a file for a standalone video.
 * Files are organized as: {BASE_DIR}/{videoId}/{filename}
 *
 * @param videoId - The ID of the video
 * @param filename - The name of the file (optional, returns directory if omitted)
 * @returns The full path to the file or directory
 */
export function getStandaloneVideoFilePath(
  videoId: string,
  filename?: string
): string {
  const baseDir = getStandaloneVideoFilesBaseDir();
  const videoDir = path.join(baseDir, videoId);

  if (filename) {
    return path.join(videoDir, filename);
  }

  return videoDir;
}
