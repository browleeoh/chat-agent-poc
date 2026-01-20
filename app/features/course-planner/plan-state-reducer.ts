import type { EffectReducer } from "use-effect-reducer";
import type { Plan, Section, Lesson } from "./types";

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

export namespace planStateReducer {
  export type State = {
    plan: Plan;
    syncError: string | null;
    editingTitle: { active: true; value: string } | { active: false };
    editingSection: { sectionId: string; value: string } | null;
    addingSection: { active: true; value: string } | { active: false };
    editingLesson: { lessonId: string; value: string } | null;
    addingLesson: { sectionId: string; value: string } | null;
    editingDescription: { lessonId: string; value: string } | null;
    focusRequest: { type: "add-lesson-button"; sectionId: string } | null;
  };

  export type Action =
    // Plan Title (1-4)
    | { type: "plan-title-clicked" }
    | { type: "plan-title-changed"; value: string }
    | { type: "plan-title-save-requested" }
    | { type: "plan-title-cancel-requested" }
    // Add Section (5-8)
    | { type: "add-section-clicked" }
    | { type: "new-section-title-changed"; value: string }
    | { type: "new-section-save-requested" }
    | { type: "new-section-cancel-requested" }
    // Edit Section (9-11)
    | { type: "section-title-clicked"; sectionId: string }
    | { type: "section-title-changed"; value: string }
    | { type: "section-save-requested" }
    | { type: "section-cancel-requested" }
    // Delete Section (12)
    | { type: "section-delete-requested"; sectionId: string }
    // Add Lesson (13-16)
    | { type: "add-lesson-clicked"; sectionId: string }
    | { type: "new-lesson-title-changed"; value: string }
    | { type: "new-lesson-save-requested" }
    | { type: "new-lesson-cancel-requested" }
    // Edit Lesson (17-20)
    | { type: "lesson-title-clicked"; lessonId: string; sectionId: string }
    | { type: "lesson-title-changed"; value: string }
    | { type: "lesson-save-requested" }
    | { type: "lesson-cancel-requested" }
    // Delete Lesson (21)
    | { type: "lesson-delete-requested"; sectionId: string; lessonId: string }
    // Lesson Description (22-25)
    | {
        type: "lesson-description-clicked";
        lessonId: string;
        sectionId: string;
      }
    | { type: "lesson-description-changed"; value: string }
    | { type: "lesson-description-save-requested" }
    | { type: "lesson-description-cancel-requested" }
    // Lesson Icon (26)
    | {
        type: "lesson-icon-changed";
        sectionId: string;
        lessonId: string;
        icon: Lesson["icon"];
      }
    // Lesson Dependencies (27)
    | {
        type: "lesson-dependencies-changed";
        sectionId: string;
        lessonId: string;
        dependencies: string[];
      }
    // Reordering (28-30)
    | { type: "section-reordered"; sectionId: string; newIndex: number }
    | {
        type: "lesson-reordered";
        fromSectionId: string;
        toSectionId: string;
        lessonId: string;
        newIndex: number;
      }
    // Sync (31-32)
    | { type: "sync-failed"; error: string }
    | { type: "sync-retry-requested" }
    // Focus (33)
    | { type: "focus-handled" };

  export type Effect =
    | { type: "plan-changed"; plan: Plan }
    | {
        type: "focus-element";
        target: { type: "add-lesson-button"; sectionId: string };
      };
}

export const createInitialPlanState = (plan: Plan): planStateReducer.State => ({
  plan,
  syncError: null,
  editingTitle: { active: false },
  editingSection: null,
  addingSection: { active: false },
  editingLesson: null,
  addingLesson: null,
  editingDescription: null,
  focusRequest: null,
});

export const planStateReducer: EffectReducer<
  planStateReducer.State,
  planStateReducer.Action,
  planStateReducer.Effect
> = (
  state: planStateReducer.State,
  action: planStateReducer.Action,
  exec
): planStateReducer.State => {
  switch (action.type) {
    // Plan Title (1-4)
    case "plan-title-clicked": {
      return {
        ...state,
        editingTitle: { active: true, value: state.plan.title },
      };
    }
    case "plan-title-changed": {
      if (!state.editingTitle.active) return state;
      return {
        ...state,
        editingTitle: { active: true, value: action.value },
      };
    }
    case "plan-title-save-requested": {
      if (!state.editingTitle.active) return state;
      const newTitle = state.editingTitle.value.trim();
      if (!newTitle) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        title: newTitle,
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
        editingTitle: { active: false },
      };
    }
    case "plan-title-cancel-requested": {
      return {
        ...state,
        editingTitle: { active: false },
      };
    }

    // Add Section (5-8)
    case "add-section-clicked": {
      return {
        ...state,
        addingSection: { active: true, value: "" },
      };
    }
    case "new-section-title-changed": {
      if (!state.addingSection.active) return state;
      return {
        ...state,
        addingSection: { active: true, value: action.value },
      };
    }
    case "new-section-save-requested": {
      if (!state.addingSection.active) return state;
      const newTitle = state.addingSection.value.trim();
      if (!newTitle) return state;

      const maxOrder = Math.max(0, ...state.plan.sections.map((s) => s.order));
      const newSection: Section = {
        id: generateId(),
        title: newTitle,
        order: maxOrder + 1,
        lessons: [],
      };

      const updatedPlan: Plan = {
        ...state.plan,
        sections: [...state.plan.sections, newSection],
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });
      exec({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId: newSection.id },
      });

      return {
        ...state,
        plan: updatedPlan,
        addingSection: { active: false },
        focusRequest: { type: "add-lesson-button", sectionId: newSection.id },
      };
    }
    case "new-section-cancel-requested": {
      return {
        ...state,
        addingSection: { active: false },
      };
    }

    // Edit Section (9-11)
    case "section-title-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      if (!section) return state;
      return {
        ...state,
        editingSection: { sectionId: action.sectionId, value: section.title },
      };
    }
    case "section-title-changed": {
      if (!state.editingSection) return state;
      return {
        ...state,
        editingSection: { ...state.editingSection, value: action.value },
      };
    }
    case "section-save-requested": {
      if (!state.editingSection) return state;
      const newTitle = state.editingSection.value.trim();
      if (!newTitle) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === state.editingSection!.sectionId
            ? { ...section, title: newTitle }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
        editingSection: null,
      };
    }
    case "section-cancel-requested": {
      return {
        ...state,
        editingSection: null,
      };
    }

    // Delete Section (12)
    case "section-delete-requested": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.filter(
          (section) => section.id !== action.sectionId
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Add Lesson (13-16)
    case "add-lesson-clicked": {
      return {
        ...state,
        addingLesson: { sectionId: action.sectionId, value: "" },
      };
    }
    case "new-lesson-title-changed": {
      if (!state.addingLesson) return state;
      return {
        ...state,
        addingLesson: { ...state.addingLesson, value: action.value },
      };
    }
    case "new-lesson-save-requested": {
      if (!state.addingLesson) return state;
      const newTitle = state.addingLesson.value.trim();
      if (!newTitle) return state;

      const sectionId = state.addingLesson.sectionId;
      const section = state.plan.sections.find((s) => s.id === sectionId);
      if (!section) return state;

      const maxOrder = Math.max(0, ...section.lessons.map((l) => l.order));
      const newLesson: Lesson = {
        id: generateId(),
        title: newTitle,
        order: maxOrder + 1,
        description: "",
      };

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((s) =>
          s.id === sectionId ? { ...s, lessons: [...s.lessons, newLesson] } : s
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });
      exec({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId },
      });

      return {
        ...state,
        plan: updatedPlan,
        addingLesson: null,
        focusRequest: { type: "add-lesson-button", sectionId },
      };
    }
    case "new-lesson-cancel-requested": {
      return {
        ...state,
        addingLesson: null,
      };
    }

    // Edit Lesson (17-20)
    case "lesson-title-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      const lesson = section?.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return state;
      return {
        ...state,
        editingLesson: { lessonId: action.lessonId, value: lesson.title },
      };
    }
    case "lesson-title-changed": {
      if (!state.editingLesson) return state;
      return {
        ...state,
        editingLesson: { ...state.editingLesson, value: action.value },
      };
    }
    case "lesson-save-requested": {
      if (!state.editingLesson) return state;
      const newTitle = state.editingLesson.value.trim();
      if (!newTitle) return state;

      const lessonId = state.editingLesson.lessonId;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, title: newTitle } : lesson
          ),
        })),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
        editingLesson: null,
      };
    }
    case "lesson-cancel-requested": {
      return {
        ...state,
        editingLesson: null,
      };
    }

    // Delete Lesson (21)
    case "lesson-delete-requested": {
      const lessonId = action.lessonId;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => {
          const filteredLessons =
            section.id === action.sectionId
              ? section.lessons.filter((lesson) => lesson.id !== lessonId)
              : section.lessons;

          // Remove deleted lesson from other lessons' dependencies
          const updatedLessons = filteredLessons.map((lesson) => {
            if (lesson.dependencies && lesson.dependencies.includes(lessonId)) {
              return {
                ...lesson,
                dependencies: lesson.dependencies.filter(
                  (id) => id !== lessonId
                ),
              };
            }
            return lesson;
          });

          return {
            ...section,
            lessons: updatedLessons,
          };
        }),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Lesson Description (22-25)
    case "lesson-description-clicked": {
      const section = state.plan.sections.find(
        (s) => s.id === action.sectionId
      );
      const lesson = section?.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return state;
      return {
        ...state,
        editingDescription: {
          lessonId: action.lessonId,
          value: lesson.description || "",
        },
      };
    }
    case "lesson-description-changed": {
      if (!state.editingDescription) return state;
      return {
        ...state,
        editingDescription: {
          ...state.editingDescription,
          value: action.value,
        },
      };
    }
    case "lesson-description-save-requested": {
      if (!state.editingDescription) return state;

      const lessonId = state.editingDescription.lessonId;
      const newDescription = state.editingDescription.value;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) =>
            lesson.id === lessonId
              ? { ...lesson, description: newDescription }
              : lesson
          ),
        })),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
        editingDescription: null,
      };
    }
    case "lesson-description-cancel-requested": {
      return {
        ...state,
        editingDescription: null,
      };
    }

    // Lesson Icon (26)
    case "lesson-icon-changed": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? { ...lesson, icon: action.icon }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Lesson Dependencies (27)
    case "lesson-dependencies-changed": {
      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) =>
          section.id === action.sectionId
            ? {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === action.lessonId
                    ? { ...lesson, dependencies: action.dependencies }
                    : lesson
                ),
              }
            : section
        ),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Reordering (28-30)
    case "section-reordered": {
      const sortedSections = [...state.plan.sections].sort(
        (a, b) => a.order - b.order
      );
      const currentIndex = sortedSections.findIndex(
        (s) => s.id === action.sectionId
      );
      if (currentIndex === -1 || currentIndex === action.newIndex) return state;

      const [movedSection] = sortedSections.splice(currentIndex, 1) as [
        Section,
      ];
      sortedSections.splice(action.newIndex, 0, movedSection);

      const reorderedSections = sortedSections.map((section, index) => ({
        ...section,
        order: index,
      }));

      const updatedPlan: Plan = {
        ...state.plan,
        sections: reorderedSections,
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }
    case "lesson-reordered": {
      const fromSection = state.plan.sections.find(
        (s) => s.id === action.fromSectionId
      );
      const lesson = fromSection?.lessons.find((l) => l.id === action.lessonId);
      if (!lesson) return state;

      const toSection = state.plan.sections.find(
        (s) => s.id === action.toSectionId
      );
      if (!toSection) return state;

      const updatedPlan: Plan = {
        ...state.plan,
        sections: state.plan.sections.map((section) => {
          if (action.fromSectionId === action.toSectionId) {
            if (section.id !== action.toSectionId) return section;

            const sortedLessons = [...section.lessons].sort(
              (a, b) => a.order - b.order
            );
            const currentIndex = sortedLessons.findIndex(
              (l) => l.id === action.lessonId
            );
            if (currentIndex === -1 || currentIndex === action.newIndex)
              return section;

            const [movedLesson] = sortedLessons.splice(currentIndex, 1) as [
              Lesson,
            ];
            sortedLessons.splice(action.newIndex, 0, movedLesson);

            const reorderedLessons = sortedLessons.map((l, index) => ({
              ...l,
              order: index,
            }));

            return {
              ...section,
              lessons: reorderedLessons,
            };
          } else {
            if (section.id === action.fromSectionId) {
              const remainingLessons = section.lessons
                .filter((l) => l.id !== action.lessonId)
                .sort((a, b) => a.order - b.order)
                .map((l, index) => ({ ...l, order: index }));
              return {
                ...section,
                lessons: remainingLessons,
              };
            }
            if (section.id === action.toSectionId) {
              const sortedLessons = [...section.lessons].sort(
                (a, b) => a.order - b.order
              );
              sortedLessons.splice(action.newIndex, 0, lesson);

              const reorderedLessons = sortedLessons.map((l, index) => ({
                ...l,
                order: index,
              }));

              return {
                ...section,
                lessons: reorderedLessons,
              };
            }
          }
          return section;
        }),
        updatedAt: getTimestamp(),
      };

      exec({ type: "plan-changed", plan: updatedPlan });

      return {
        ...state,
        plan: updatedPlan,
      };
    }

    // Sync (31-32)
    case "sync-failed": {
      return {
        ...state,
        syncError: action.error,
      };
    }
    case "sync-retry-requested": {
      exec({ type: "plan-changed", plan: state.plan });
      return state;
    }

    // Focus (33)
    case "focus-handled": {
      return {
        ...state,
        focusRequest: null,
      };
    }
  }

  return state;
};
