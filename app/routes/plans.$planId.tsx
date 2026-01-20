import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlans } from "@/hooks/use-plans";
import { ChevronLeft, PencilIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/plans.$planId";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Plan - CVM" }];
};

export default function PlanDetailPage(_props: Route.ComponentProps) {
  const { planId } = useParams();
  const {
    getPlan,
    updatePlan,
    addSection,
    updateSection,
    deleteSection,
    addLesson,
    updateLesson,
    deleteLesson,
  } = usePlans();

  const plan = getPlan(planId!);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingLessonToSection, setAddingLessonToSection] = useState<
    string | null
  >(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedSectionTitle, setEditedSectionTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editedLessonTitle, setEditedLessonTitle] = useState("");

  if (!plan) {
    return (
      <div className="flex h-screen bg-background text-foreground">
        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Plan not found</h1>
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

  const sortedSections = [...plan.sections].sort((a, b) =>
    a.order.localeCompare(b.order)
  );

  const totalSections = plan.sections.length;
  const totalLessons = plan.sections.reduce(
    (acc, section) => acc + section.lessons.length,
    0
  );

  const handleSaveTitle = () => {
    if (editedTitle.trim()) {
      updatePlan(planId!, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleAddSection = () => {
    if (newSectionTitle.trim()) {
      addSection(planId!, newSectionTitle.trim());
      setNewSectionTitle("");
    }
  };

  const handleSaveSection = (sectionId: string) => {
    if (editedSectionTitle.trim()) {
      updateSection(planId!, sectionId, { title: editedSectionTitle.trim() });
    }
    setEditingSectionId(null);
  };

  const handleAddLesson = (sectionId: string) => {
    if (newLessonTitle.trim()) {
      addLesson(planId!, sectionId, newLessonTitle.trim());
      setNewLessonTitle("");
      setAddingLessonToSection(null);
    }
  };

  const handleSaveLesson = (sectionId: string, lessonId: string) => {
    if (editedLessonTitle.trim()) {
      updateLesson(planId!, sectionId, lessonId, {
        title: editedLessonTitle.trim(),
      });
    }
    setEditingLessonId(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Link>

            <div className="flex items-center gap-2 mt-2">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-2xl font-bold h-auto py-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                  />
                  <Button size="sm" onClick={handleSaveTitle}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingTitle(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">{plan.title}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditedTitle(plan.title);
                      setIsEditingTitle(true);
                    }}
                  >
                    <PencilIcon className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                {totalSections} sections
              </span>
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                {totalLessons} lessons
              </span>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-6">
            {sortedSections.map((section) => {
              const sortedLessons = [...section.lessons].sort((a, b) =>
                a.order.localeCompare(b.order)
              );

              return (
                <div key={section.id} className="border rounded-lg p-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3">
                    {editingSectionId === section.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editedSectionTitle}
                          onChange={(e) =>
                            setEditedSectionTitle(e.target.value)
                          }
                          className="font-semibold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleSaveSection(section.id);
                            if (e.key === "Escape") setEditingSectionId(null);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveSection(section.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSectionId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h2 className="font-semibold text-lg">
                          {section.title}
                        </h2>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingSectionId(section.id);
                              setEditedSectionTitle(section.title);
                            }}
                          >
                            <PencilIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteSection(planId!, section.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Lessons */}
                  <div className="space-y-1 ml-4">
                    {sortedLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 group"
                      >
                        {editingLessonId === lesson.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editedLessonTitle}
                              onChange={(e) =>
                                setEditedLessonTitle(e.target.value)
                              }
                              className="text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSaveLesson(section.id, lesson.id);
                                if (e.key === "Escape")
                                  setEditingLessonId(null);
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                handleSaveLesson(section.id, lesson.id)
                              }
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingLessonId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Link
                              to={`/plans/${planId}/lessons/${lesson.id}`}
                              className="text-sm hover:underline flex-1"
                            >
                              {lesson.title}
                            </Link>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingLessonId(lesson.id);
                                  setEditedLessonTitle(lesson.title);
                                }}
                              >
                                <PencilIcon className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  deleteLesson(planId!, section.id, lesson.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {/* Add Lesson */}
                    {addingLessonToSection === section.id ? (
                      <div className="flex items-center gap-2 py-2 px-3">
                        <Input
                          value={newLessonTitle}
                          onChange={(e) => setNewLessonTitle(e.target.value)}
                          placeholder="Lesson title..."
                          className="text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddLesson(section.id);
                            if (e.key === "Escape") {
                              setAddingLessonToSection(null);
                              setNewLessonTitle("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddLesson(section.id)}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingLessonToSection(null);
                            setNewLessonTitle("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setAddingLessonToSection(section.id)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Lesson
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Section */}
            <div className="border rounded-lg p-4 border-dashed">
              <div className="flex items-center gap-2">
                <Input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="New section title..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSection();
                  }}
                />
                <Button
                  onClick={handleAddSection}
                  disabled={!newSectionTitle.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Section
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
