import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { useFetcher } from "react-router";

export function DeleteVersionModal(props: {
  repoId: string;
  versionId: string;
  versionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Delete Version
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete version "{props.versionName}"? This
            will permanently delete all sections, lessons, videos, and clips in
            this version. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={`/api/repos/${props.repoId}/delete-version`}
          className="space-y-4 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await fetcher.submit(formData, {
              method: "post",
              action: `/api/repos/${props.repoId}/delete-version`,
            });
            props.onOpenChange(false);
          }}
        >
          <input type="hidden" name="versionId" value={props.versionId} />
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              {fetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete Version"
              )}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
