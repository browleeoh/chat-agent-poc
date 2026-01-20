import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePlans } from "@/hooks/use-plans";
import {
  ChevronLeft,
  Code,
  Copy,
  GripVertical,
  MessageCircle,
  MoreVertical,
  PencilIcon,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Route } from "./+types/plans.$planId";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Section,
  Lesson,
  LessonIcon,
} from "@/features/course-planner/types";

// Custom collision detection that prioritizes lessons over sections
// This allows dropping on a specific lesson position even when crossing sections
const customCollisionDetection: CollisionDetection = (args) => {
  // First check for pointer within collisions (items the pointer is inside)
  const pointerCollisions = pointerWithin(args);

  // If we have pointer collisions, prioritize lessons over sections
  if (pointerCollisions.length > 0) {
    // Check if any collision is with a lesson (not a section)
    // Sections have data.type === 'section', lessons don't
    const lessonCollision = pointerCollisions.find((collision) => {
      const container = args.droppableContainers.find(
        (c) => c.id === collision.id
      );
      return container?.data.current?.type !== "section";
    });
    if (lessonCollision) {
      return [lessonCollision];
    }
    return pointerCollisions;
  }

  // Fall back to closest center if no pointer collisions
  return closestCenter(args);
};

export const meta: Route.MetaFunction = () => {
  return [{ title: "Plan - CVM" }];
};

// Sortable Lesson Component
interface SortableLessonProps {
  lesson: Lesson;
  lessonNumber: string;
  isEditingTitle: boolean;
  editedTitle: string;
  onEditedTitleChange: (value: string) => void;
  onStartEditTitle: () => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
  onDelete: () => void;
  isEditingDescription: boolean;
  editedDescription: string;
  onEditedDescriptionChange: (value: string) => void;
  onStartEditDescription: () => void;
  onSaveDescription: () => void;
  onCancelEditDescription: () => void;
  onIconChange: (icon: LessonIcon) => void;
}

function SortableLesson({
  lesson,
  lessonNumber,
  isEditingTitle,
  editedTitle,
  onEditedTitleChange,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onDelete,
  isEditingDescription,
  editedDescription,
  onEditedDescriptionChange,
  onStartEditDescription,
  onSaveDescription,
  onCancelEditDescription,
  onIconChange,
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
      className="py-2 px-3 rounded hover:bg-muted/50 group"
    >
      <div className="flex items-start gap-3">
        {/* Grip handle */}
        <button
          className="cursor-grab active:cursor-grabbing p-1 mt-0.5"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Circle badge icon */}
        <button
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
            lesson.icon === "code"
              ? "bg-yellow-500/20 text-yellow-600"
              : lesson.icon === "discussion"
                ? "bg-green-500/20 text-green-600"
                : "bg-purple-500/20 text-purple-600"
          }`}
          onClick={() => {
            const nextIcon =
              lesson.icon === "watch"
                ? "code"
                : lesson.icon === "code"
                  ? "discussion"
                  : "watch";
            onIconChange(nextIcon);
          }}
          title={
            lesson.icon === "code"
              ? "Interactive (click to change)"
              : lesson.icon === "discussion"
                ? "Discussion (click to change)"
                : "Watch (click to change)"
          }
        >
          {lesson.icon === "code" ? (
            <Code className="w-3.5 h-3.5" />
          ) : lesson.icon === "discussion" ? (
            <MessageCircle className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Content - title and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editedTitle}
                  onChange={(e) => onEditedTitleChange(e.target.value)}
                  className="text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSaveTitle();
                    if (e.key === "Escape") onCancelEditTitle();
                  }}
                />
                <Button size="sm" onClick={onSaveTitle}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEditTitle}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {lessonNumber}
                  </span>
                  <span className="text-sm">{lesson.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onStartEditTitle}
                  >
                    <PencilIcon className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
          {/* Description */}
          {isEditingDescription ? (
            <div className="mt-1">
              <Textarea
                value={editedDescription}
                onChange={(e) => onEditedDescriptionChange(e.target.value)}
                placeholder="Add a description..."
                className="text-sm min-h-[80px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") onCancelEditDescription();
                  if (e.key === " " && e.ctrlKey) {
                    e.preventDefault();
                    onSaveDescription();
                  }
                }}
              />
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={onSaveDescription}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancelEditDescription}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : lesson.description ? (
            <div
              className="mt-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={onStartEditDescription}
            >
              {lesson.description}
            </div>
          ) : (
            <button
              className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onStartEditDescription}
            >
              + Add description
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sortable Section Component
interface SortableSectionProps {
  section: Section;
  sectionNumber: number;
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
  editingDescriptionLessonId: string | null;
  editedLessonDescription: string;
  onEditedLessonDescriptionChange: (value: string) => void;
  onStartEditDescription: (lessonId: string, description: string) => void;
  onSaveDescription: (lessonId: string) => void;
  onCancelEditDescription: () => void;
  addingLessonToSection: string | null;
  newLessonTitle: string;
  onNewLessonTitleChange: (value: string) => void;
  onStartAddLesson: () => void;
  onAddLesson: () => void;
  onCancelAddLesson: () => void;
  shouldFocusAddLesson: boolean;
  onAddLessonFocused: () => void;
  onLessonIconChange: (lessonId: string, icon: LessonIcon) => void;
}

function SortableSection({
  section,
  sectionNumber,
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
  editingDescriptionLessonId,
  editedLessonDescription,
  onEditedLessonDescriptionChange,
  onStartEditDescription,
  onSaveDescription,
  onCancelEditDescription,
  addingLessonToSection,
  newLessonTitle,
  onNewLessonTitleChange,
  onStartAddLesson,
  onAddLesson,
  onCancelAddLesson,
  shouldFocusAddLesson,
  onAddLessonFocused,
  onLessonIconChange,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, data: { type: "section" } });

  const addLessonButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the Add Lesson button when requested
  useEffect(() => {
    if (shouldFocusAddLesson && addLessonButtonRef.current) {
      addLessonButtonRef.current.focus();
      onAddLessonFocused();
    }
  }, [shouldFocusAddLesson, onAddLessonFocused]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sortedLessons = [...section.lessons].sort((a, b) => a.order - b.order);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 group/section"
    >
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
              <h2 className="font-semibold text-lg">
                <span className="text-muted-foreground mr-2">
                  {sectionNumber}.
                </span>
                {section.title}
              </h2>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
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
          {sortedLessons.map((lesson, lessonIndex) => (
            <SortableLesson
              key={lesson.id}
              lesson={lesson}
              lessonNumber={`${sectionNumber}.${lessonIndex + 1}`}
              isEditingTitle={editingLessonId === lesson.id}
              editedTitle={editedLessonTitle}
              onEditedTitleChange={onEditedLessonTitleChange}
              onStartEditTitle={() =>
                onStartEditLesson(lesson.id, lesson.title)
              }
              onSaveTitle={() => onSaveLesson(lesson.id)}
              onCancelEditTitle={onCancelEditLesson}
              onDelete={() => onDeleteLesson(lesson.id)}
              isEditingDescription={editingDescriptionLessonId === lesson.id}
              editedDescription={editedLessonDescription}
              onEditedDescriptionChange={onEditedLessonDescriptionChange}
              onStartEditDescription={() =>
                onStartEditDescription(lesson.id, lesson.description)
              }
              onSaveDescription={() => onSaveDescription(lesson.id)}
              onCancelEditDescription={onCancelEditDescription}
              onIconChange={(icon) => onLessonIconChange(lesson.id, icon)}
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
              ref={addLessonButtonRef}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={onStartAddLesson}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PlanDetailPage(_props: Route.ComponentProps) {
  const { planId } = useParams();
  const navigate = useNavigate();
  const {
    getPlan,
    updatePlan,
    duplicatePlan,
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
  const [isAddingSectionOpen, setIsAddingSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingLessonToSection, setAddingLessonToSection] = useState<
    string | null
  >(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editedSectionTitle, setEditedSectionTitle] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editedLessonTitle, setEditedLessonTitle] = useState("");
  const [editingDescriptionLessonId, setEditingDescriptionLessonId] = useState<
    string | null
  >(null);
  const [editedLessonDescription, setEditedLessonDescription] = useState("");
  const [focusAddLessonInSection, setFocusAddLessonInSection] = useState<
    string | null
  >(null);

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
      const newSection = addSection(planId!, newSectionTitle.trim());
      setNewSectionTitle("");
      setIsAddingSectionOpen(false);
      // Focus the Add Lesson button in the newly created section
      if (newSection) {
        setFocusAddLessonInSection(newSection.id);
      }
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
      // Focus the Add Lesson button in this section
      setFocusAddLessonInSection(sectionId);
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

  const handleSaveDescription = (sectionId: string, lessonId: string) => {
    updateLesson(planId!, sectionId, lessonId, {
      description: editedLessonDescription,
    });
    setEditingDescriptionLessonId(null);
  };

  const handleLessonIconChange = (
    sectionId: string,
    lessonId: string,
    icon: LessonIcon
  ) => {
    updateLesson(planId!, sectionId, lessonId, { icon });
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

            <div className="flex items-center gap-2 mt-2 group/title">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover/title:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditedTitle(plan.title);
                          setIsEditingTitle(true);
                        }}
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit Title
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const newPlan = duplicatePlan(planId!);
                          if (newPlan) {
                            navigate(`/plans/${newPlan.id}`);
                          }
                        }}
                      >
                        <Copy className="w-4 h-4" />
                        Duplicate Plan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {sortedSections.map((section, index) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    sectionNumber={index + 1}
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
                    editingDescriptionLessonId={editingDescriptionLessonId}
                    editedLessonDescription={editedLessonDescription}
                    onEditedLessonDescriptionChange={setEditedLessonDescription}
                    onStartEditDescription={(lessonId, description) => {
                      setEditingDescriptionLessonId(lessonId);
                      setEditedLessonDescription(description);
                    }}
                    onSaveDescription={(lessonId) =>
                      handleSaveDescription(section.id, lessonId)
                    }
                    onCancelEditDescription={() =>
                      setEditingDescriptionLessonId(null)
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
                    shouldFocusAddLesson={
                      focusAddLessonInSection === section.id
                    }
                    onAddLessonFocused={() => setFocusAddLessonInSection(null)}
                    onLessonIconChange={(lessonId, icon) =>
                      handleLessonIconChange(section.id, lessonId, icon)
                    }
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
          {isAddingSectionOpen ? (
            <div className="border rounded-lg p-4 border-dashed mt-6">
              <div className="flex items-center gap-2">
                <Input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="New section title..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSection();
                    if (e.key === "Escape") {
                      setIsAddingSectionOpen(false);
                      setNewSectionTitle("");
                    }
                  }}
                />
                <Button
                  onClick={handleAddSection}
                  disabled={!newSectionTitle.trim()}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsAddingSectionOpen(false);
                    setNewSectionTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-6 w-full border-dashed"
              onClick={() => setIsAddingSectionOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
