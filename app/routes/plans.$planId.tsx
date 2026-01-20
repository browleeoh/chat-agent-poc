import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlans } from "@/hooks/use-plans";
import {
  ChevronLeft,
  GripVertical,
  PencilIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import type { Route } from "./+types/plans.$planId";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Section, Lesson } from "@/features/course-planner/types";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Plan - CVM" }];
};

// Sortable Lesson Component
interface SortableLessonProps {
  lesson: Lesson;
  planId: string;
  isEditing: boolean;
  editedTitle: string;
  onEditedTitleChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function SortableLesson({
  lesson,
  planId,
  isEditing,
  editedTitle,
  onEditedTitleChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
}: SortableLessonProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 group"
    >
      {isEditing ? (
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={editedTitle}
            onChange={(e) => onEditedTitleChange(e.target.value)}
            className="text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
          />
          <Button size="sm" onClick={onSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <button
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <Link
            to={`/plans/${planId}/lessons/${lesson.id}`}
            className="text-sm hover:underline flex-1 ml-1"
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
                onStartEdit();
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
                onDelete();
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Sortable Section Component
interface SortableSectionProps {
  section: Section;
  planId: string;
  isEditing: boolean;
  editedTitle: string;
  onEditedTitleChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  editingLessonId: string | null;
  editedLessonTitle: string;
  onEditedLessonTitleChange: (value: string) => void;
  onStartEditLesson: (lessonId: string, title: string) => void;
  onSaveLesson: (lessonId: string) => void;
  onCancelEditLesson: () => void;
  onDeleteLesson: (lessonId: string) => void;
  addingLessonToSection: string | null;
  newLessonTitle: string;
  onNewLessonTitleChange: (value: string) => void;
  onStartAddLesson: () => void;
  onAddLesson: () => void;
  onCancelAddLesson: () => void;
}

function SortableSection({
  section,
  planId,
  isEditing,
  editedTitle,
  onEditedTitleChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  editingLessonId,
  editedLessonTitle,
  onEditedLessonTitleChange,
  onStartEditLesson,
  onSaveLesson,
  onCancelEditLesson,
  onDeleteLesson,
  addingLessonToSection,
  newLessonTitle,
  onNewLessonTitleChange,
  onStartAddLesson,
  onAddLesson,
  onCancelAddLesson,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedLessons = [...section.lessons].sort((a, b) => a.order - b.order);

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editedTitle}
              onChange={(e) => onEditedTitleChange(e.target.value)}
              className="font-semibold"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave();
                if (e.key === "Escape") onCancel();
              }}
            />
            <Button size="sm" onClick={onSave}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                className="cursor-grab active:cursor-grabbing p-1"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="font-semibold text-lg">{section.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onStartEdit}
              >
                <PencilIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Lessons */}
      <SortableContext
        items={sortedLessons.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1 ml-4">
          {sortedLessons.map((lesson) => (
            <SortableLesson
              key={lesson.id}
              lesson={lesson}
              planId={planId}
              isEditing={editingLessonId === lesson.id}
              editedTitle={editedLessonTitle}
              onEditedTitleChange={onEditedLessonTitleChange}
              onStartEdit={() => onStartEditLesson(lesson.id, lesson.title)}
              onSave={() => onSaveLesson(lesson.id)}
              onCancel={onCancelEditLesson}
              onDelete={() => onDeleteLesson(lesson.id)}
            />
          ))}

          {/* Add Lesson */}
          {addingLessonToSection === section.id ? (
            <div className="flex items-center gap-2 py-2 px-3">
              <Input
                value={newLessonTitle}
                onChange={(e) => onNewLessonTitleChange(e.target.value)}
                placeholder="Lesson title..."
                className="text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAddLesson();
                  if (e.key === "Escape") onCancelAddLesson();
                }}
              />
              <Button size="sm" onClick={onAddLesson}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelAddLesson}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={onStartAddLesson}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Lesson
            </Button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PlanDetailPage(_props: Route.ComponentProps) {
  const { planId } = useParams();
  const {
    getPlan,
    updatePlan,
    addSection,
    updateSection,
    deleteSection,
    reorderSection,
    addLesson,
    updateLesson,
    deleteLesson,
    reorderLesson,
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

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<
    "section" | "lesson" | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!plan) {
    return (
      <div className="flex h-screen bg-background text-foreground">
        <AppSidebar />
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

  const sortedSections = [...plan.sections].sort((a, b) => a.order - b.order);

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

  // Find which section a lesson belongs to
  const findSectionForLesson = (lessonId: string): Section | undefined => {
    return plan.sections.find((section) =>
      section.lessons.some((lesson) => lesson.id === lessonId)
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeIdStr = active.id as string;
    setActiveId(activeIdStr);

    // Determine if we're dragging a section or a lesson
    const isSection = plan.sections.some((s) => s.id === activeIdStr);
    setActiveDragType(isSection ? "section" : "lesson");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragType(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr === overIdStr) return;

    // Handle section reordering
    if (activeDragType === "section") {
      const oldIndex = sortedSections.findIndex((s) => s.id === activeIdStr);
      const newIndex = sortedSections.findIndex((s) => s.id === overIdStr);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSection(planId!, activeIdStr, newIndex);
      }
      return;
    }

    // Handle lesson reordering
    if (activeDragType === "lesson") {
      const fromSection = findSectionForLesson(activeIdStr);
      if (!fromSection) return;

      // Check if dropping on a section (empty or header)
      const toSection = plan.sections.find((s) => s.id === overIdStr);
      if (toSection) {
        // Moving to end of another section
        const sortedLessons = [...toSection.lessons].sort(
          (a, b) => a.order - b.order
        );
        reorderLesson(
          planId!,
          fromSection.id,
          toSection.id,
          activeIdStr,
          sortedLessons.length
        );
        return;
      }

      // Check if dropping on a lesson
      const overSection = findSectionForLesson(overIdStr);
      if (overSection) {
        const sortedLessons = [...overSection.lessons].sort(
          (a, b) => a.order - b.order
        );
        const overIndex = sortedLessons.findIndex((l) => l.id === overIdStr);
        reorderLesson(
          planId!,
          fromSection.id,
          overSection.id,
          activeIdStr,
          overIndex
        );
      }
    }
  };

  // Get active item for overlay
  const activeSection =
    activeDragType === "section"
      ? plan.sections.find((s) => s.id === activeId)
      : null;
  const activeLesson =
    activeDragType === "lesson"
      ? plan.sections.flatMap((s) => s.lessons).find((l) => l.id === activeId)
      : null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      <AppSidebar />
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {sortedSections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    planId={planId!}
                    isEditing={editingSectionId === section.id}
                    editedTitle={editedSectionTitle}
                    onEditedTitleChange={setEditedSectionTitle}
                    onStartEdit={() => {
                      setEditingSectionId(section.id);
                      setEditedSectionTitle(section.title);
                    }}
                    onSave={() => handleSaveSection(section.id)}
                    onCancel={() => setEditingSectionId(null)}
                    onDelete={() => deleteSection(planId!, section.id)}
                    editingLessonId={editingLessonId}
                    editedLessonTitle={editedLessonTitle}
                    onEditedLessonTitleChange={setEditedLessonTitle}
                    onStartEditLesson={(lessonId, title) => {
                      setEditingLessonId(lessonId);
                      setEditedLessonTitle(title);
                    }}
                    onSaveLesson={(lessonId) =>
                      handleSaveLesson(section.id, lessonId)
                    }
                    onCancelEditLesson={() => setEditingLessonId(null)}
                    onDeleteLesson={(lessonId) =>
                      deleteLesson(planId!, section.id, lessonId)
                    }
                    addingLessonToSection={addingLessonToSection}
                    newLessonTitle={newLessonTitle}
                    onNewLessonTitleChange={setNewLessonTitle}
                    onStartAddLesson={() =>
                      setAddingLessonToSection(section.id)
                    }
                    onAddLesson={() => handleAddLesson(section.id)}
                    onCancelAddLesson={() => {
                      setAddingLessonToSection(null);
                      setNewLessonTitle("");
                    }}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeSection ? (
                <div className="border rounded-lg p-4 bg-background shadow-lg opacity-90">
                  <h2 className="font-semibold text-lg">
                    {activeSection.title}
                  </h2>
                </div>
              ) : activeLesson ? (
                <div className="py-2 px-3 rounded bg-background shadow-lg opacity-90 border">
                  <span className="text-sm">{activeLesson.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Add Section */}
          <div className="border rounded-lg p-4 border-dashed mt-6">
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
  );
}
