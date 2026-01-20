import { useState, useEffect, useCallback, useRef } from "react";
import type { Plan, Section, Lesson } from "@/features/course-planner/types";

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

export interface UsePlansOptions {
  /**
   * Initial plans loaded from the server (Postgres).
   */
  initialPlans?: Plan[];
  /**
   * The ID of the currently active plan (from URL params).
   * When provided, only this plan will be synced to the server.
   * This avoids syncing all plans on every change.
   */
  activePlanId?: string;
}

/**
 * Hook to manage course plans.
 * Plans are loaded from Postgres via server loaders and passed as initialPlans.
 */
export function usePlans(options: UsePlansOptions = {}) {
  const { initialPlans, activePlanId } = options;

  const [plans, setPlans] = useState<Plan[]>(initialPlans ?? []);

  // Sync error state - when set, indicates sync to Postgres failed
  const [syncError, setSyncError] = useState<string | null>(null);

  // Track if this is the initial mount to skip syncing initial data back
  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  // Function to sync a single plan to Postgres
  const syncPlan = useCallback(async (plan: Plan) => {
    try {
      const response = await fetch("/api/plans/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ||
            `Sync failed with status ${response.status}`
        );
      }

      // Clear any existing error on successful sync
      setSyncError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync plan";
      setSyncError(message);
    }
  }, []);

  // Retry sync manually (for use with error banner)
  const retrySync = useCallback(() => {
    if (activePlanId) {
      const plan = plans.find((p) => p.id === activePlanId);
      if (plan) {
        syncPlan(plan);
      }
    }
  }, [syncPlan, plans, activePlanId]);

  // Debounced sync to Postgres (750ms) whenever the active plan changes
  useEffect(() => {
    // Skip the initial sync when loading from initialPlans (server data)
    // to avoid immediately syncing server data back to the server
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only sync if we have an active plan ID (avoids syncing all plans)
    if (!activePlanId) {
      return;
    }

    const plan = plans.find((p) => p.id === activePlanId);
    if (!plan) {
      return;
    }

    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce sync to Postgres by 750ms
    syncTimeoutRef.current = setTimeout(() => {
      syncPlan(plan);
    }, 750);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [plans, syncPlan, activePlanId]);

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

  const duplicatePlan = useCallback(
    (planId: string): Plan | undefined => {
      const sourcePlan = plans.find((p) => p.id === planId);
      if (!sourcePlan) return undefined;

      const now = getTimestamp();
      const newPlan: Plan = {
        id: generateId(),
        title: `${sourcePlan.title} (Copy)`,
        createdAt: now,
        updatedAt: now,
        sections: sourcePlan.sections.map((section) => ({
          ...section,
          id: generateId(),
          lessons: section.lessons.map((lesson) => ({
            ...lesson,
            id: generateId(),
          })),
        })),
      };
      setPlans((prev) => [...prev, newPlan]);
      return newPlan;
    },
    [plans]
  );

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

          const maxOrder = Math.max(0, ...plan.sections.map((s) => s.order));

          newSection = {
            id: generateId(),
            title,
            order: maxOrder + 1,
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

          const sortedSections = [...plan.sections].sort(
            (a, b) => a.order - b.order
          );
          const currentIndex = sortedSections.findIndex(
            (s) => s.id === sectionId
          );
          if (currentIndex === -1 || currentIndex === newIndex) return plan;

          // Remove section from current position and insert at new position
          const [movedSection] = sortedSections.splice(currentIndex, 1) as [
            Section,
          ];
          sortedSections.splice(newIndex, 0, movedSection);

          // Reassign order values based on new positions
          const reorderedSections = sortedSections.map((section, index) => ({
            ...section,
            order: index,
          }));

          return {
            ...plan,
            sections: reorderedSections,
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

              const maxOrder = Math.max(
                0,
                ...section.lessons.map((l) => l.order)
              );

              newLesson = {
                id: generateId(),
                title,
                order: maxOrder + 1,
                description: "",
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
      updates: Partial<
        Pick<Lesson, "title" | "description" | "icon" | "dependencies">
      >
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
              // Remove the lesson from its section
              const filteredLessons =
                section.id === sectionId
                  ? section.lessons.filter((lesson) => lesson.id !== lessonId)
                  : section.lessons;

              // Also remove the deleted lesson from any other lesson's dependencies
              const updatedLessons = filteredLessons.map((lesson) => {
                if (
                  lesson.dependencies &&
                  lesson.dependencies.includes(lessonId)
                ) {
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

          const toSection = plan.sections.find((s) => s.id === toSectionId);
          if (!toSection) return plan;

          return {
            ...plan,
            sections: plan.sections.map((section) => {
              if (fromSectionId === toSectionId) {
                // Reorder within same section
                if (section.id !== toSectionId) return section;

                const sortedLessons = [...section.lessons].sort(
                  (a, b) => a.order - b.order
                );
                const currentIndex = sortedLessons.findIndex(
                  (l) => l.id === lessonId
                );
                if (currentIndex === -1 || currentIndex === newIndex)
                  return section;

                // Remove and reinsert
                const [movedLesson] = sortedLessons.splice(currentIndex, 1) as [
                  Lesson,
                ];
                sortedLessons.splice(newIndex, 0, movedLesson);

                // Reassign order values
                const reorderedLessons = sortedLessons.map((l, index) => ({
                  ...l,
                  order: index,
                }));

                return {
                  ...section,
                  lessons: reorderedLessons,
                };
              } else {
                // Moving between sections
                if (section.id === fromSectionId) {
                  // Remove from source section and reassign orders
                  const remainingLessons = section.lessons
                    .filter((l) => l.id !== lessonId)
                    .sort((a, b) => a.order - b.order)
                    .map((l, index) => ({ ...l, order: index }));
                  return {
                    ...section,
                    lessons: remainingLessons,
                  };
                }
                if (section.id === toSectionId) {
                  // Add to target section at newIndex
                  const sortedLessons = [...section.lessons].sort(
                    (a, b) => a.order - b.order
                  );
                  sortedLessons.splice(newIndex, 0, lesson);

                  // Reassign order values
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
        })
      );
    },
    []
  );

  return {
    plans,
    syncError,
    retrySync,
    createPlan,
    updatePlan,
    deletePlan,
    duplicatePlan,
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
