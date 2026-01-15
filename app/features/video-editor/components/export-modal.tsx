import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, CopyIcon, DownloadIcon, Loader2 } from "lucide-react";
import type { FetcherWithComponents } from "react-router";

/**
 * Modal for exporting video clips to file, with optional YouTube/TikTok short title.
 * Also displays YouTube chapters (generated from clip sections) with copy button.
 */
export const ExportModal = (props: {
  /** Whether the export modal is open */
  isOpen: boolean;
  /** Callback to set modal open state */
  setIsOpen: (isOpen: boolean) => void;
  /** Fetcher for submitting the export request */
  exportVideoClipsFetcher: FetcherWithComponents<unknown>;
  /** Video ID to export */
  videoId: string;
  /** YouTube chapters generated from clip sections (timestamp + name) */
  youtubeChapters: { timestamp: string; name: string }[];
  /** Whether chapters have been copied to clipboard (for showing feedback) */
  isChaptersCopied: boolean;
  /** Callback to copy YouTube chapters to clipboard */
  copyYoutubeChaptersToClipboard: () => void;
}) => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <DownloadIcon className="w-4 h-4 mr-2" />
          <div className="flex flex-col">
            <span className="font-medium">Export</span>
            <span className="text-xs text-muted-foreground">
              Export video clips to file
            </span>
          </div>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
        </DialogHeader>
        <props.exportVideoClipsFetcher.Form
          method="post"
          action={`/api/videos/${props.videoId}/export`}
          className="space-y-4 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await props.exportVideoClipsFetcher.submit(e.currentTarget);
            props.setIsOpen(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="shorts-directory-output-name">Short Title</Label>
            <Input
              id="shorts-directory-output-name"
              placeholder="Leave empty for normal export only..."
              name="shortsDirectoryOutputName"
            />
            <p className="text-xs text-muted-foreground">
              If provided, the video will be queued for YouTube and TikTok under
              the given title.
            </p>
          </div>
          {props.youtubeChapters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>YouTube Chapters</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={props.copyYoutubeChaptersToClipboard}
                  className="h-7 px-2"
                >
                  {props.isChaptersCopied ? (
                    <CheckIcon className="w-4 h-4 mr-1" />
                  ) : (
                    <CopyIcon className="w-4 h-4 mr-1" />
                  )}
                  {props.isChaptersCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              <div className="bg-muted rounded-md p-3 text-sm font-mono">
                {props.youtubeChapters.map((chapter, index) => (
                  <div key={index}>
                    {chapter.timestamp} {chapter.name}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => props.setIsOpen(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit">
              {props.exportVideoClipsFetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <DownloadIcon className="w-4 h-4 mr-1" />
              )}
              Export
            </Button>
          </div>
        </props.exportVideoClipsFetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
