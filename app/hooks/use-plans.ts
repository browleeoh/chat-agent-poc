import { useState, useEffect, useCallback } from "react";
import { generateKeyBetween } from "fractional-indexing";
import type { Plan, Section, Lesson } from "@/features/course-planner/types";

const STORAGE_KEY = "course-plans";

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Hook to manage course plans stored in localStorage.
 */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(() => {
    if (typeof localStorage === "undefined") {
      return [];
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Plan[];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist to localStorage whenever plans change
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    }
  }, [plans]);

  // Plan operations
  const createPlan = useCallback((title: string): Plan => {
    const now = getTimestamp();
    const newPlan: Plan = {
      id: generateId(),
      title,
      createdAt: now,
      updatedAt: now,
      sections: [],
    };
    setPlans((prev) => [...prev, newPlan]);
    return newPlan;
  }, []);

  const updatePlan = useCallback(
    (planId: string, updates: Partial<Pick<Plan, "title">>) => {
      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === planId
            ? { ...plan, ...updates, updatedAt: getTimestamp() }
            : plan
        )
      );
    },
    []
  );

  const deletePlan = useCallback((planId: string) => {
    setPlans((prev) => prev.filter((plan) => plan.id !== planId));
  }, []);

  const getPlan = useCallback(
    (planId: string): Plan | undefined => {
      return plans.find((plan) => plan.id === planId);
    },
    [plans]
  );

  // Section operations
  const addSection = useCallback(
    (planId: string, title: string): Section | undefined => {
      let newSection: Section | undefined;
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;

          const lastSection = plan.sections[plan.sections.length - 1];
          const lastOrder = lastSection?.order ?? null;

          newSection = {
            id: generateId(),
            title,
            order: generateKeyBetween(lastOrder, null),
            lessons: [],
          };

          return {
            ...plan,
            sections: [...plan.sections, newSection],
            updatedAt: getTimestamp(),
          };
        })
      );
      return newSection;
    },
    []
  );

  const updateSection = useCallback(
    (
      planId: string,
      sectionId: string,
      updates: Partial<Pick<Section, "title">>
    ) => {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;
          return {
            ...plan,
            sections: plan.sections.map((section) =>
              section.id === sectionId ? { ...section, ...updates } : section
            ),
            updatedAt: getTimestamp(),
          };
        })
      );
    },
    []
  );

  const deleteSection = useCallback((planId: string, sectionId: string) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) return plan;
        return {
          ...plan,
          sections: plan.sections.filter((section) => section.id !== sectionId),
          updatedAt: getTimestamp(),
        };
      })
    );
  }, []);

  const reorderSection = useCallback(
    (planId: string, sectionId: string, newIndex: number) => {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;

          const sortedSections = [...plan.sections].sort((a, b) =>
            a.order.localeCompare(b.order)
          );
          const currentIndex = sortedSections.findIndex(
            (s) => s.id === sectionId
          );
          if (currentIndex === -1 || currentIndex === newIndex) return plan;

          // Calculate new order key
          const beforeOrder =
            newIndex > 0 ? sortedSections[newIndex - 1]?.order : null;
          const afterOrder =
            newIndex < sortedSections.length - 1
              ? sortedSections[newIndex + (newIndex > currentIndex ? 1 : 0)]
                  ?.order
              : null;

          // Adjust for the case where we're moving down
          const adjustedBeforeOrder =
            newIndex > currentIndex
              ? sortedSections[newIndex]?.order
              : beforeOrder;
          const adjustedAfterOrder =
            newIndex > currentIndex
              ? (sortedSections[newIndex + 1]?.order ?? null)
              : afterOrder;

          const newOrder = generateKeyBetween(
            adjustedBeforeOrder ?? null,
            adjustedAfterOrder ?? null
          );

          return {
            ...plan,
            sections: plan.sections.map((section) =>
              section.id === sectionId
                ? { ...section, order: newOrder }
                : section
            ),
            updatedAt: getTimestamp(),
          };
        })
      );
    },
    []
  );

  // Lesson operations
  const addLesson = useCallback(
    (planId: string, sectionId: string, title: string): Lesson | undefined => {
      let newLesson: Lesson | undefined;
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;
          return {
            ...plan,
            sections: plan.sections.map((section) => {
              if (section.id !== sectionId) return section;

              const lastLesson = section.lessons[section.lessons.length - 1];
              const lastOrder = lastLesson?.order ?? null;

              newLesson = {
                id: generateId(),
                title,
                order: generateKeyBetween(lastOrder, null),
                notes: "",
              };

              return {
                ...section,
                lessons: [...section.lessons, newLesson],
              };
            }),
            updatedAt: getTimestamp(),
          };
        })
      );
      return newLesson;
    },
    []
  );

  const updateLesson = useCallback(
    (
      planId: string,
      sectionId: string,
      lessonId: string,
      updates: Partial<Pick<Lesson, "title" | "notes">>
    ) => {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;
          return {
            ...plan,
            sections: plan.sections.map((section) => {
              if (section.id !== sectionId) return section;
              return {
                ...section,
                lessons: section.lessons.map((lesson) =>
                  lesson.id === lessonId ? { ...lesson, ...updates } : lesson
                ),
              };
            }),
            updatedAt: getTimestamp(),
          };
        })
      );
    },
    []
  );

  const deleteLesson = useCallback(
    (planId: string, sectionId: string, lessonId: string) => {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;
          return {
            ...plan,
            sections: plan.sections.map((section) => {
              if (section.id !== sectionId) return section;
              return {
                ...section,
                lessons: section.lessons.filter(
                  (lesson) => lesson.id !== lessonId
                ),
              };
            }),
            updatedAt: getTimestamp(),
          };
        })
      );
    },
    []
  );

  const reorderLesson = useCallback(
    (
      planId: string,
      fromSectionId: string,
      toSectionId: string,
      lessonId: string,
      newIndex: number
    ) => {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.id !== planId) return plan;

          // Find the lesson
          const fromSection = plan.sections.find((s) => s.id === fromSectionId);
          const lesson = fromSection?.lessons.find((l) => l.id === lessonId);
          if (!lesson) return plan;

          // Calculate new order
          const toSection = plan.sections.find((s) => s.id === toSectionId);
          if (!toSection) return plan;

          const sortedLessons = [...toSection.lessons]
            .filter((l) => l.id !== lessonId) // Exclude the moving lesson
            .sort((a, b) => a.order.localeCompare(b.order));

          const beforeOrder =
            newIndex > 0 ? sortedLessons[newIndex - 1]?.order : null;
          const afterOrder =
            newIndex < sortedLessons.length
              ? sortedLessons[newIndex]?.order
              : null;
          const newOrder = generateKeyBetween(
            beforeOrder ?? null,
            afterOrder ?? null
          );

          const updatedLesson = { ...lesson, order: newOrder };

          return {
            ...plan,
            sections: plan.sections.map((section) => {
              if (
                section.id === fromSectionId &&
                fromSectionId !== toSectionId
              ) {
                // Remove from source section
                return {
                  ...section,
                  lessons: section.lessons.filter((l) => l.id !== lessonId),
                };
              }
              if (section.id === toSectionId) {
                if (fromSectionId === toSectionId) {
                  // Reorder within same section
                  return {
                    ...section,
                    lessons: section.lessons.map((l) =>
                      l.id === lessonId ? updatedLesson : l
                    ),
                  };
                } else {
                  // Add to target section
                  return {
                    ...section,
                    lessons: [...section.lessons, updatedLesson],
                  };
                }
              }
              return section;
            }),
            updatedAt: getTimestamp(),
          };
        })
      );
    },
    []
  );

  return {
    plans,
    createPlan,
    updatePlan,
    deletePlan,
    getPlan,
    addSection,
    updateSection,
    deleteSection,
    reorderSection,
    addLesson,
    updateLesson,
    deleteLesson,
    reorderLesson,
  };
}
