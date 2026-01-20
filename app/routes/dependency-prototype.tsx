import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  Code,
  GripVertical,
  Link2,
  MessageCircle,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/dependency-prototype";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Dependency Prototype - CVM" }];
};

// Extended lesson type with dependencies
interface LessonWithDeps {
  id: string;
  number: string;
  title: string;
  icon: "watch" | "code" | "discussion";
  description?: string;
  dependencies: string[]; // IDs of lessons this depends on
}

// Mock data for prototype - includes descriptions
const mockLessons: LessonWithDeps[] = [
  {
    id: "1",
    number: "1.1",
    title: "Introduction to TypeScript",
    icon: "watch",
    description:
      "Overview of TypeScript and its benefits for JavaScript developers",
    dependencies: [],
  },
  {
    id: "2",
    number: "1.2",
    title: "Setting Up Your Environment",
    icon: "code",
    description: "Install Node.js and configure your IDE",
    dependencies: ["1"],
  },
  {
    id: "3",
    number: "1.3",
    title: "Basic Types",
    icon: "watch",
    dependencies: ["2"],
  },
  {
    id: "4",
    number: "2.1",
    title: "Functions and Parameters",
    icon: "code",
    description: "Learn how to type function parameters and return values",
    dependencies: ["3"],
  },
  {
    id: "5",
    number: "2.2",
    title: "Generics Introduction",
    icon: "watch",
    dependencies: ["3", "4"],
  },
  {
    id: "6",
    number: "2.3",
    title: "Q&A Session",
    icon: "discussion",
    description: "Live Q&A to answer your questions",
    dependencies: [],
  },
];

// Helper to check if dependency order is violated
function checkDependencyViolation(
  lesson: LessonWithDeps,
  allLessons: LessonWithDeps[]
): LessonWithDeps[] {
  const violations: LessonWithDeps[] = [];
  const lessonIndex = allLessons.findIndex((l) => l.id === lesson.id);

  for (const depId of lesson.dependencies) {
    const depLesson = allLessons.find((l) => l.id === depId);
    if (depLesson) {
      const depIndex = allLessons.findIndex((l) => l.id === depId);
      if (depIndex > lessonIndex) {
        violations.push(depLesson);
      }
    }
  }

  return violations;
}

// Get lesson by ID
function getLessonById(
  id: string,
  lessons: LessonWithDeps[]
): LessonWithDeps | undefined {
  return lessons.find((l) => l.id === id);
}

// Base lesson component that matches the actual plan page UI
function LessonRow({
  lesson,
  violations = [],
  children,
  onDelete,
}: {
  lesson: LessonWithDeps;
  violations?: LessonWithDeps[];
  children?: React.ReactNode;
  onDelete?: () => void;
}) {
  const hasViolation = violations.length > 0;

  return (
    <div
      className={`py-2 px-3 rounded hover:bg-muted/50 group ${
        hasViolation ? "bg-amber-500/5 border border-amber-500/30" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Grip handle */}
        <button className="cursor-grab active:cursor-grabbing p-1 mt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Circle badge icon */}
        <button
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
            lesson.icon === "code"
              ? "bg-yellow-500/20 text-yellow-600"
              : lesson.icon === "discussion"
                ? "bg-green-500/20 text-green-600"
                : "bg-purple-500/20 text-purple-600"
          }`}
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {lesson.number}
              </span>
              <span
                className={`text-sm ${hasViolation ? "text-amber-700" : ""}`}
              >
                {lesson.title}
              </span>
              {hasViolation && (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          {lesson.description ? (
            <div className="mt-1 text-xs text-muted-foreground max-w-[65ch]">
              {lesson.description}
            </div>
          ) : (
            <button className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              + Add description
            </button>
          )}

          {/* Dependency UI - variant specific */}
          {children}
        </div>
      </div>
    </div>
  );
}

// Variant of LessonRow that allows a slot next to the title
function LessonRowWithTitleSlot({
  lesson,
  violations = [],
  children,
  titleSlot,
  onDelete,
}: {
  lesson: LessonWithDeps;
  violations?: LessonWithDeps[];
  children?: React.ReactNode;
  titleSlot?: React.ReactNode;
  onDelete?: () => void;
}) {
  const hasViolation = violations.length > 0;

  return (
    <div
      className={`py-2 px-3 rounded hover:bg-muted/50 group ${
        hasViolation ? "bg-amber-500/5 border border-amber-500/30" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Grip handle */}
        <button className="cursor-grab active:cursor-grabbing p-1 mt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Circle badge icon */}
        <button
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
            lesson.icon === "code"
              ? "bg-yellow-500/20 text-yellow-600"
              : lesson.icon === "discussion"
                ? "bg-green-500/20 text-green-600"
                : "bg-purple-500/20 text-purple-600"
          }`}
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {lesson.number}
              </span>
              <span
                className={`text-sm ${hasViolation ? "text-amber-700" : ""}`}
              >
                {lesson.title}
              </span>
              {titleSlot}
              {hasViolation && !titleSlot && (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          {lesson.description ? (
            <div className="mt-1 text-xs text-muted-foreground max-w-[65ch]">
              {lesson.description}
            </div>
          ) : (
            <button className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              + Add description
            </button>
          )}

          {/* Dependency UI - variant specific */}
          {children}
        </div>
      </div>
    </div>
  );
}

// Variant 1: Badge Pills - Dependencies shown as small clickable badges
function Variant1BadgePills({
  lessons,
  onUpdateDependencies,
}: {
  lessons: LessonWithDeps[];
  onUpdateDependencies: (lessonId: string, deps: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      {lessons.map((lesson) => {
        const violations = checkDependencyViolation(lesson, lessons);
        return (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            violations={violations}
            onDelete={() => {}}
          >
            {/* Dependencies as badges */}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {lesson.dependencies.map((depId) => {
                const dep = getLessonById(depId, lessons);
                const isViolation = violations.some((v) => v.id === depId);
                return dep ? (
                  <span
                    key={depId}
                    className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                      isViolation
                        ? "bg-amber-500/20 text-amber-600"
                        : "bg-blue-500/20 text-blue-600"
                    }`}
                  >
                    <ArrowLeft className="w-3 h-3" />
                    {dep.number}
                    <button
                      className="hover:text-foreground"
                      onClick={() =>
                        onUpdateDependencies(
                          lesson.id,
                          lesson.dependencies.filter((d) => d !== depId)
                        )
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
              {/* Add dependency dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Plus className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Add dependency</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {lessons
                    .filter(
                      (l) =>
                        l.id !== lesson.id &&
                        !lesson.dependencies.includes(l.id)
                    )
                    .map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        onSelect={() =>
                          onUpdateDependencies(lesson.id, [
                            ...lesson.dependencies,
                            l.id,
                          ])
                        }
                      >
                        {l.number} {l.title}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </LessonRow>
        );
      })}
    </div>
  );
}

// Variant 2: Inline Dropdown - Badge-style dropdown next to title
function Variant2InlineDropdown({
  lessons,
  onUpdateDependencies,
}: {
  lessons: LessonWithDeps[];
  onUpdateDependencies: (lessonId: string, deps: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      {lessons.map((lesson) => {
        const violations = checkDependencyViolation(lesson, lessons);
        return (
          <LessonRowWithTitleSlot
            key={lesson.id}
            lesson={lesson}
            violations={violations}
            onDelete={() => {}}
            titleSlot={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted ${
                      violations.length > 0
                        ? "bg-amber-500/20 text-amber-600"
                        : lesson.dependencies.length > 0
                          ? "bg-blue-500/20 text-blue-600"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Link2 className="w-3 h-3" />
                    {lesson.dependencies.length > 0 && (
                      <>
                        {lesson.dependencies
                          .map((id) => getLessonById(id, lessons)?.number)
                          .join(", ")}
                        {violations.length > 0 && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Dependencies</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {lessons
                    .filter((l) => l.id !== lesson.id)
                    .map((l) => (
                      <DropdownMenuCheckboxItem
                        key={l.id}
                        checked={lesson.dependencies.includes(l.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onUpdateDependencies(lesson.id, [
                              ...lesson.dependencies,
                              l.id,
                            ]);
                          } else {
                            onUpdateDependencies(
                              lesson.id,
                              lesson.dependencies.filter((d) => d !== l.id)
                            );
                          }
                        }}
                      >
                        {l.number} {l.title}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
        );
      })}
    </div>
  );
}

// Variant 3: Visual Lines - Show dependency connections with lines
function Variant3VisualLines({ lessons }: { lessons: LessonWithDeps[] }) {
  return (
    <div className="space-y-1 relative">
      {lessons.map((lesson, index) => {
        const violations = checkDependencyViolation(lesson, lessons);
        const hasDeps = lesson.dependencies.length > 0;
        const isDependedOn = lessons.some((l) =>
          l.dependencies.includes(lesson.id)
        );

        return (
          <div key={lesson.id} className="flex items-start gap-2">
            {/* Dependency indicator column */}
            <div className="w-6 flex flex-col items-center relative pt-3">
              {hasDeps && (
                <div
                  className={`absolute -top-1 w-0.5 h-4 ${violations.length > 0 ? "bg-amber-500" : "bg-blue-500"}`}
                />
              )}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  violations.length > 0
                    ? "bg-amber-500"
                    : hasDeps || isDependedOn
                      ? "bg-blue-500"
                      : "bg-muted"
                }`}
              />
              {isDependedOn && index < lessons.length - 1 && (
                <div className="w-0.5 flex-1 bg-blue-500/30 mt-0.5" />
              )}
            </div>

            <div className="flex-1">
              <LessonRow
                lesson={lesson}
                violations={violations}
                onDelete={() => {}}
              >
                {hasDeps && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Requires:{" "}
                    {lesson.dependencies
                      .map((id) => getLessonById(id, lessons)?.number)
                      .join(", ")}
                  </div>
                )}
              </LessonRow>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Variant 4: Subtle Text - Dependencies shown as subtle text below description
function Variant4SubtleText({
  lessons,
  onUpdateDependencies,
}: {
  lessons: LessonWithDeps[];
  onUpdateDependencies: (lessonId: string, deps: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      {lessons.map((lesson) => {
        const violations = checkDependencyViolation(lesson, lessons);
        return (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            violations={violations}
            onDelete={() => {}}
          >
            {/* Subtle dependency text */}
            <div className="mt-1.5 flex items-center gap-2">
              {lesson.dependencies.length > 0 ? (
                <span
                  className={`text-xs ${
                    violations.length > 0
                      ? "text-amber-600"
                      : "text-muted-foreground"
                  }`}
                >
                  ← Requires{" "}
                  {lesson.dependencies
                    .map((id) => getLessonById(id, lessons)?.number)
                    .join(", ")}
                </span>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-muted-foreground/50 hover:text-muted-foreground">
                    {lesson.dependencies.length > 0
                      ? "Edit"
                      : "+ Add dependency"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Dependencies</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {lessons
                    .filter((l) => l.id !== lesson.id)
                    .map((l) => (
                      <DropdownMenuCheckboxItem
                        key={l.id}
                        checked={lesson.dependencies.includes(l.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onUpdateDependencies(lesson.id, [
                              ...lesson.dependencies,
                              l.id,
                            ]);
                          } else {
                            onUpdateDependencies(
                              lesson.id,
                              lesson.dependencies.filter((d) => d !== l.id)
                            );
                          }
                        }}
                      >
                        {l.number} {l.title}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </LessonRow>
        );
      })}
    </div>
  );
}

// Variant 5: Warning Banner - Show violations as prominent banner at top
function Variant5WarningBanner({
  lessons,
  onUpdateDependencies,
}: {
  lessons: LessonWithDeps[];
  onUpdateDependencies: (lessonId: string, deps: string[]) => void;
}) {
  const allViolations: {
    lesson: LessonWithDeps;
    violations: LessonWithDeps[];
  }[] = [];
  lessons.forEach((lesson) => {
    const violations = checkDependencyViolation(lesson, lessons);
    if (violations.length > 0) {
      allViolations.push({ lesson, violations });
    }
  });

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      {allViolations.length > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-amber-700">
                Dependency Order Issues
              </div>
              <ul className="mt-1 text-sm text-amber-600 space-y-1">
                {allViolations.map(({ lesson, violations }) => (
                  <li key={lesson.id}>
                    <strong>{lesson.number}</strong> depends on{" "}
                    {violations.map((v) => v.number).join(", ")} which{" "}
                    {violations.length === 1 ? "comes" : "come"} later
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Lesson list with subtle dependency indicators */}
      <div className="space-y-1">
        {lessons.map((lesson) => {
          const violations = checkDependencyViolation(lesson, lessons);
          return (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              violations={violations}
              onDelete={() => {}}
            >
              {/* Subtle dependency indicators */}
              {lesson.dependencies.length > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-xs text-muted-foreground">
                    Requires:
                  </span>
                  {lesson.dependencies.map((depId) => {
                    const dep = getLessonById(depId, lessons);
                    const isViolation = violations.some((v) => v.id === depId);
                    return dep ? (
                      <span
                        key={depId}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          isViolation
                            ? "bg-amber-500/20 text-amber-600"
                            : "bg-blue-500/20 text-blue-600"
                        }`}
                      >
                        {dep.number}
                      </span>
                    ) : null;
                  })}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-xs text-muted-foreground/50 hover:text-muted-foreground ml-1">
                        Edit
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Dependencies</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {lessons
                        .filter((l) => l.id !== lesson.id)
                        .map((l) => (
                          <DropdownMenuCheckboxItem
                            key={l.id}
                            checked={lesson.dependencies.includes(l.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                onUpdateDependencies(lesson.id, [
                                  ...lesson.dependencies,
                                  l.id,
                                ]);
                              } else {
                                onUpdateDependencies(
                                  lesson.id,
                                  lesson.dependencies.filter((d) => d !== l.id)
                                );
                              }
                            }}
                          >
                            {l.number} {l.title}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </LessonRow>
          );
        })}
      </div>
    </div>
  );
}

export default function DependencyPrototypePage() {
  const [lessons, setLessons] = useState<LessonWithDeps[]>(mockLessons);
  const [activeVariant, setActiveVariant] = useState(1);

  const handleUpdateDependencies = (lessonId: string, deps: string[]) => {
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, dependencies: deps } : l))
    );
  };

  // Create a violated version for demo
  const violatedLessons: LessonWithDeps[] = lessons.map((lesson, index) => {
    if (index === 2) {
      // 1.3 depends on 2.2 (violation!)
      return { ...lesson, dependencies: ["5"] };
    }
    return { ...lesson };
  });

  const variants = [
    {
      id: 1,
      name: "Badge Pills",
      description:
        "Dependencies shown as small removable badges under the content",
    },
    {
      id: 2,
      name: "Inline Dropdown",
      description: "Compact dropdown trigger showing linked lessons",
    },
    {
      id: 3,
      name: "Visual Lines",
      description:
        "Vertical lines in a side column connecting dependent lessons",
    },
    {
      id: 4,
      name: "Subtle Text",
      description: "Dependencies shown as subtle inline text with edit link",
    },
    {
      id: 5,
      name: "Warning Banner",
      description:
        "Violations shown as prominent banner at the top of the section",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Link>
          <h1 className="text-2xl font-bold mt-2">Dependency Prototype</h1>
          <p className="text-muted-foreground mt-1">
            Explore different UI treatments for creating, editing, and
            displaying dependencies between lessons. Each variant includes the
            full lesson UI (grip handle, icon, title, description, delete).
          </p>
        </div>

        {/* Variant selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {variants.map((v) => (
            <Button
              key={v.id}
              variant={activeVariant === v.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveVariant(v.id)}
            >
              {v.id}. {v.name}
            </Button>
          ))}
        </div>

        {/* Current variant description */}
        <div className="mb-6 p-3 rounded bg-muted/50 text-sm">
          <strong>{variants[activeVariant - 1]?.name}:</strong>{" "}
          {variants[activeVariant - 1]?.description}
        </div>

        {/* Main preview */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Normal state */}
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-green-500/20 text-green-600 text-xs">
                <Check className="w-4 h-4" />
              </span>
              Valid Order
            </h2>
            <div className="border rounded-lg p-4">
              {activeVariant === 1 && (
                <Variant1BadgePills
                  lessons={lessons}
                  onUpdateDependencies={handleUpdateDependencies}
                />
              )}
              {activeVariant === 2 && (
                <Variant2InlineDropdown
                  lessons={lessons}
                  onUpdateDependencies={handleUpdateDependencies}
                />
              )}
              {activeVariant === 3 && <Variant3VisualLines lessons={lessons} />}
              {activeVariant === 4 && (
                <Variant4SubtleText
                  lessons={lessons}
                  onUpdateDependencies={handleUpdateDependencies}
                />
              )}
              {activeVariant === 5 && (
                <Variant5WarningBanner
                  lessons={lessons}
                  onUpdateDependencies={handleUpdateDependencies}
                />
              )}
            </div>
          </div>

          {/* Violated state */}
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-amber-500/20 text-amber-600 text-xs">
                <AlertTriangle className="w-4 h-4" />
              </span>
              Order Violation (1.3 depends on 2.2)
            </h2>
            <div className="border rounded-lg p-4">
              {activeVariant === 1 && (
                <Variant1BadgePills
                  lessons={violatedLessons}
                  onUpdateDependencies={() => {}}
                />
              )}
              {activeVariant === 2 && (
                <Variant2InlineDropdown
                  lessons={violatedLessons}
                  onUpdateDependencies={() => {}}
                />
              )}
              {activeVariant === 3 && (
                <Variant3VisualLines lessons={violatedLessons} />
              )}
              {activeVariant === 4 && (
                <Variant4SubtleText
                  lessons={violatedLessons}
                  onUpdateDependencies={() => {}}
                />
              )}
              {activeVariant === 5 && (
                <Variant5WarningBanner
                  lessons={violatedLessons}
                  onUpdateDependencies={() => {}}
                />
              )}
            </div>
          </div>
        </div>

        {/* Implementation notes */}
        <div className="mt-8 border-t pt-6">
          <h2 className="font-semibold mb-3">Implementation Notes</h2>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <strong>Data model:</strong> Add{" "}
              <code className="bg-muted px-1 rounded">
                dependencies: string[]
              </code>{" "}
              field to Lesson type (array of lesson IDs)
            </li>
            <li>
              <strong>Validation:</strong> Check if any dependency appears later
              in the course order than the lesson that depends on it
            </li>
            <li>
              <strong>Cross-section:</strong> Dependencies can span sections
              (e.g., 2.1 can depend on 1.3)
            </li>
            <li>
              <strong>Circular:</strong> Should prevent circular dependencies (A
              depends on B, B depends on A)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
