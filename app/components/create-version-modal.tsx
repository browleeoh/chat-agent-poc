import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { useFetcher } from "react-router";

interface CreateVersionModalProps {
  repoId: string;
  sourceVersionId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateVersionModal({
  repoId,
  sourceVersionId,
  isOpen,
  onOpenChange,
}: CreateVersionModalProps) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      onOpenChange(false);
    }
  }, [fetcher.state, fetcher.data, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Version</DialogTitle>
        </DialogHeader>
        <fetcher.Form
          method="post"
          action={`/api/repos/${repoId}/create-version`}
          className="space-y-4 py-4"
        >
          <input type="hidden" name="sourceVersionId" value={sourceVersionId} />
          <div className="space-y-2">
            <Label htmlFor="version-name">Version Name</Label>
            <Input
              id="version-name"
              placeholder="e.g., v2.0"
              name="name"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={fetcher.state === "submitting"}>
              {fetcher.state === "submitting"
                ? "Creating..."
                : "Create Version"}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
