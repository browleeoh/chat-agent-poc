import { useCallback, useRef } from "react";
import { useEffectReducer } from "use-effect-reducer";
import type { Plan } from "@/features/course-planner/types";
import {
  planStateReducer,
  createInitialPlanState,
} from "@/features/course-planner/plan-state-reducer";

export interface UsePlanReducerOptions {
  initialPlan: Plan;
}

export function usePlanReducer(options: UsePlanReducerOptions) {
  const { initialPlan } = options;

  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const syncPlan = useCallback(
    async (
      planToSync: Plan,
      dispatch: (action: planStateReducer.Action) => void
    ) => {
      try {
        const response = await fetch("/api/plans/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planToSync }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `Sync failed with status ${response.status}`
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to sync plan";
        dispatch({ type: "sync-failed", error: message });
      }
    },
    []
  );

  const [state, dispatch] = useEffectReducer<
    planStateReducer.State,
    planStateReducer.Action,
    planStateReducer.Effect
  >(planStateReducer, createInitialPlanState(initialPlan), {
    "plan-changed": (state, _effect, dispatch) => {
      // Skip sync on initial mount
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }

      // Debounce sync (750ms)
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        syncPlan(state.plan, dispatch);
      }, 750);
    },
    "focus-element": (_state, effect, dispatch) => {
      // Defer to next tick to allow DOM to update
      requestAnimationFrame(() => {
        if (effect.target.type === "add-lesson-button") {
          const button = document.querySelector(
            `[data-add-lesson-button="${effect.target.sectionId}"]`
          );
          if (button instanceof HTMLElement) {
            button.focus();
          }
        }
        dispatch({ type: "focus-handled" });
      });
    },
  });

  // Duplicate plan is async and involves navigation, so it stays separate
  const duplicatePlan = useCallback(async (): Promise<Plan> => {
    const now = new Date().toISOString();
    const newPlan: Plan = {
      id: crypto.randomUUID(),
      title: `${state.plan.title} (Copy)`,
      createdAt: now,
      updatedAt: now,
      sections: state.plan.sections.map((section) => ({
        ...section,
        id: crypto.randomUUID(),
        lessons: section.lessons.map((lesson) => ({
          ...lesson,
          id: crypto.randomUUID(),
        })),
      })),
    };

    // Sync immediately before returning
    const response = await fetch("/api/plans/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ||
          `Sync failed with status ${response.status}`
      );
    }

    return newPlan;
  }, [state.plan]);

  return {
    state,
    dispatch,
    duplicatePlan,
  };
}
