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
  mode: "create" | "edit";
  filename?: string;
  content?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher();
  const [filename, setFilename] = useState(props.filename || "");
  const [content, setContent] = useState(props.content || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reset form when modal opens with new data
  useEffect(() => {
    setFilename(props.filename || "");
    setContent(props.content || "");
    setSelectedFile(null);
  }, [props.filename, props.content, props.open]);

  const isCreate = props.mode === "create";
  const actionUrl = isCreate
    ? "/api/standalone-files/create"
    : "/api/standalone-files/update";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill filename if not set
      if (!filename) {
        setFilename(file.name);
      }
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add File" : "Edit File"}</DialogTitle>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={actionUrl}
          className="space-y-4 py-4"
          encType="multipart/form-data"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await fetcher.submit(formData, {
              method: "post",
              action: actionUrl,
              encType: "multipart/form-data",
            });
            props.onOpenChange(false);
          }}
        >
          <input type="hidden" name="videoId" value={props.videoId} />
          {!isCreate && (
            <input type="hidden" name="oldFilename" value={props.filename} />
          )}
          {isCreate ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  onChange={handleFileSelect}
                  required
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="filename">Filename (optional)</Label>
                <Input
                  id="filename"
                  name="filename"
                  placeholder="Leave blank to use uploaded filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Override the uploaded filename if needed
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="filename">Filename</Label>
                <Input
                  id="filename"
                  name="filename"
                  placeholder="notes.md"
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
                  re-uploaded.
                </p>
              </div>
            </>
          )}
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
              ) : isCreate ? (
                "Upload File"
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
