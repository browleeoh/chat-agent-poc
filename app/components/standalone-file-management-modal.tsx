import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useFetcher } from "react-router";
import { useEffect, useState } from "react";

export function StandaloneFileManagementModal(props: {
  videoId: string;
  filename?: string;
  content?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher();
  const [filename, setFilename] = useState(props.filename || "");
  const [content, setContent] = useState(props.content || "");

  // Reset form when modal opens with new data
  useEffect(() => {
    setFilename(props.filename || "");
    setContent(props.content || "");
  }, [props.filename, props.content, props.open]);

  const actionUrl = "/api/standalone-files/update";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={actionUrl}
          className="space-y-4 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await fetcher.submit(formData, {
              method: "post",
              action: actionUrl,
            });
            props.onOpenChange(false);
          }}
        >
          <input type="hidden" name="videoId" value={props.videoId} />
          <input type="hidden" name="oldFilename" value={props.filename} />
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              name="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              required
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Enter file content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="min-h-64 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Note: Only text files can be edited. Binary files must be
              re-uploaded via clipboard.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
