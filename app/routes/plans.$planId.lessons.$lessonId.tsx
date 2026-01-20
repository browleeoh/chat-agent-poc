import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePlans } from "@/hooks/use-plans";
import { ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/plans.$planId.lessons.$lessonId";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Lesson - CVM" }];
};

export default function LessonDetailPage(_props: Route.ComponentProps) {
  const { planId, lessonId } = useParams();
  const { getPlan, updateLesson } = usePlans();

  const plan = getPlan(planId!);

  // Find the lesson and its section
  let foundLesson: {
    sectionId: string;
    lesson: { id: string; title: string; notes: string };
  } | null = null;
  if (plan) {
    for (const section of plan.sections) {
      const lesson = section.lessons.find((l) => l.id === lessonId);
      if (lesson) {
        foundLesson = { sectionId: section.id, lesson };
        break;
      }
    }
  }

  const [notes, setNotes] = useState(foundLesson?.lesson.notes ?? "");

  // Sync notes when lesson changes
  useEffect(() => {
    if (foundLesson) {
      setNotes(foundLesson.lesson.notes);
    }
  }, [foundLesson?.lesson.notes]);

  // Auto-save notes with debounce
  useEffect(() => {
    if (!foundLesson || notes === foundLesson.lesson.notes) return;

    const timer = setTimeout(() => {
      updateLesson(planId!, foundLesson!.sectionId, lessonId!, { notes });
    }, 500);

    return () => clearTimeout(timer);
  }, [notes, planId, lessonId, foundLesson, updateLesson]);

  if (!plan || !foundLesson) {
    return (
      <div className="flex h-screen bg-background text-foreground">
        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Lesson not found</h1>
            <Link to="/">
              <Button variant="outline">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Link
              to={`/plans/${planId}`}
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to {plan.title}
            </Link>

            <h1 className="text-2xl font-bold mt-2">
              {foundLesson.lesson.title}
            </h1>
          </div>

          {/* Notes Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this lesson..."
              className="min-h-[400px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Notes are auto-saved as you type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
