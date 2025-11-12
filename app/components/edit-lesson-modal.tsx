import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useFetcher } from "react-router";

export function EditLessonModal(props: {
  lessonId: string;
  currentPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editLessonFetcher = useFetcher();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lesson Name</DialogTitle>
        </DialogHeader>
        <editLessonFetcher.Form
          method="post"
          action={`/api/lessons/${props.lessonId}/update-name`}
          className="space-y-4 py-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await editLessonFetcher.submit(e.currentTarget);
            props.onOpenChange(false);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="lesson-path">Lesson Name</Label>
            <Input
              id="lesson-path"
              name="path"
              defaultValue={props.currentPath}
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => props.onOpenChange(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit">
              {editLessonFetcher.state === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </editLessonFetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
