import { describe, expect, it, vi } from "vitest";
import { planStateReducer, createInitialPlanState } from "./plan-state-reducer";
import type {
  EffectObject,
  EffectReducer,
  EffectReducerExec,
  EventObject,
} from "use-effect-reducer";
import type { Plan } from "./types";

const createMockExec = () => {
  const fn = vi.fn() as any;
  fn.stop = vi.fn();
  fn.replace = vi.fn();
  return fn;
};

class ReducerTester<
  TState,
  TAction extends EventObject,
  TEffect extends EffectObject<TState, TAction>,
> {
  private reducer: EffectReducer<TState, TAction, TEffect>;
  private state: TState;
  private exec: EffectReducerExec<TState, TAction, TEffect>;

  constructor(
    reducer: EffectReducer<TState, TAction, TEffect>,
    initialState: TState
  ) {
    this.reducer = reducer;
    this.state = initialState;
    this.exec = createMockExec();
  }

  public send(action: TAction) {
    this.state = this.reducer(this.state, action, this.exec);
    return this;
  }

  public getState() {
    return this.state;
  }

  public getExec() {
    return this.exec;
  }

  public resetExec() {
    this.exec = createMockExec();
    return this;
  }
}

const createTestPlan = (overrides: Partial<Plan> = {}): Plan => ({
  id: "plan-1",
  title: "Test Plan",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  sections: [],
  ...overrides,
});

const createInitialState = (
  plan: Plan = createTestPlan()
): planStateReducer.State => createInitialPlanState(plan);

describe("planStateReducer", () => {
  describe("Plan Title (1-4)", () => {
    it("1. plan-title-clicked: enter edit mode with current title", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester.send({ type: "plan-title-clicked" }).getState();

      expect(state.editingTitle).toEqual({ active: true, value: "My Course" });
    });

    it("2. plan-title-changed: update edited value", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-clicked" })
        .send({ type: "plan-title-changed", value: "New Title" })
        .getState();

      expect(state.editingTitle).toEqual({ active: true, value: "New Title" });
    });

    it("2b. plan-title-changed: does nothing if not editing", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-changed", value: "New Title" })
        .getState();

      expect(state.editingTitle).toEqual({ active: false });
      expect(state.plan.title).toBe("My Course");
    });

    it("3. plan-title-save-requested: if valid, update plan + emit plan-changed", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-clicked" })
        .resetExec()
        .send({ type: "plan-title-changed", value: "New Title" })
        .send({ type: "plan-title-save-requested" })
        .getState();

      expect(state.editingTitle).toEqual({ active: false });
      expect(state.plan.title).toBe("New Title");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "plan-changed",
        })
      );
    });

    it("3b. plan-title-save-requested: does nothing if empty", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-clicked" })
        .resetExec()
        .send({ type: "plan-title-changed", value: "   " })
        .send({ type: "plan-title-save-requested" })
        .getState();

      // Still in edit mode, title unchanged
      expect(state.editingTitle).toEqual({ active: true, value: "   " });
      expect(state.plan.title).toBe("My Course");
      expect(tester.getExec()).not.toHaveBeenCalled();
    });

    it("3c. plan-title-save-requested: does nothing if not editing", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-save-requested" })
        .getState();

      expect(state.plan.title).toBe("My Course");
      expect(tester.getExec()).not.toHaveBeenCalled();
    });

    it("4. plan-title-cancel-requested: exit edit mode", () => {
      const plan = createTestPlan({ title: "My Course" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "plan-title-clicked" })
        .send({ type: "plan-title-changed", value: "New Title" })
        .send({ type: "plan-title-cancel-requested" })
        .getState();

      expect(state.editingTitle).toEqual({ active: false });
      expect(state.plan.title).toBe("My Course"); // unchanged
    });
  });

  describe("Add Section (5-8)", () => {
    it("5. add-section-clicked: enter add section mode", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester.send({ type: "add-section-clicked" }).getState();

      expect(state.addingSection).toEqual({ active: true, value: "" });
    });

    it("6. new-section-title-changed: update value", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "add-section-clicked" })
        .send({ type: "new-section-title-changed", value: "New Section" })
        .getState();

      expect(state.addingSection).toEqual({
        active: true,
        value: "New Section",
      });
    });

    it("7. new-section-save-requested: add section + emit plan-changed + emit focus", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "add-section-clicked" })
        .resetExec()
        .send({ type: "new-section-title-changed", value: "New Section" })
        .send({ type: "new-section-save-requested" })
        .getState();

      expect(state.addingSection).toEqual({ active: false });
      expect(state.plan.sections).toHaveLength(1);
      expect(state.plan.sections[0]?.title).toBe("New Section");
      expect(state.plan.sections[0]?.order).toBe(1);
      expect(state.plan.sections[0]?.lessons).toEqual([]);

      const sectionId = state.plan.sections[0]!.id;
      expect(state.focusRequest).toEqual({
        type: "add-lesson-button",
        sectionId,
      });

      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
      expect(tester.getExec()).toHaveBeenCalledWith({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId },
      });
    });

    it("7b. new-section-save-requested: calculates order correctly with existing sections", () => {
      const plan = createTestPlan({
        sections: [
          { id: "s1", title: "Section 1", order: 0, lessons: [] },
          { id: "s2", title: "Section 2", order: 2, lessons: [] },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "add-section-clicked" })
        .send({ type: "new-section-title-changed", value: "Section 3" })
        .send({ type: "new-section-save-requested" })
        .getState();

      expect(state.plan.sections).toHaveLength(3);
      expect(state.plan.sections[2]?.order).toBe(3); // max(0, 2) + 1
    });

    it("8. new-section-cancel-requested: exit add mode", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "add-section-clicked" })
        .send({ type: "new-section-title-changed", value: "New Section" })
        .send({ type: "new-section-cancel-requested" })
        .getState();

      expect(state.addingSection).toEqual({ active: false });
      expect(state.plan.sections).toHaveLength(0);
    });
  });

  describe("Edit Section (9-11)", () => {
    const planWithSection = createTestPlan({
      sections: [
        { id: "s1", title: "Existing Section", order: 0, lessons: [] },
      ],
    });

    it("9. section-title-clicked: enter edit mode with current title", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "section-title-clicked", sectionId: "s1" })
        .getState();

      expect(state.editingSection).toEqual({
        sectionId: "s1",
        value: "Existing Section",
      });
    });

    it("10. section-save-requested: update section + emit plan-changed", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "section-title-clicked", sectionId: "s1" })
        .resetExec()
        .send({ type: "section-title-changed", value: "Updated Section" })
        .send({ type: "section-save-requested" })
        .getState();

      expect(state.editingSection).toBeNull();
      expect(state.plan.sections[0]?.title).toBe("Updated Section");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("11. section-cancel-requested: exit edit mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "section-title-clicked", sectionId: "s1" })
        .send({ type: "section-title-changed", value: "Changed" })
        .send({ type: "section-cancel-requested" })
        .getState();

      expect(state.editingSection).toBeNull();
      expect(state.plan.sections[0]?.title).toBe("Existing Section");
    });
  });

  describe("Delete Section (12)", () => {
    it("12. section-delete-requested: remove section + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          { id: "s1", title: "Section 1", order: 0, lessons: [] },
          { id: "s2", title: "Section 2", order: 1, lessons: [] },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "section-delete-requested", sectionId: "s1" })
        .getState();

      expect(state.plan.sections).toHaveLength(1);
      expect(state.plan.sections[0]?.id).toBe("s2");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Add Lesson (13-16)", () => {
    const planWithSection = createTestPlan({
      sections: [{ id: "s1", title: "Section 1", order: 0, lessons: [] }],
    });

    it("13. add-lesson-clicked: enter add lesson mode for section", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "add-lesson-clicked", sectionId: "s1" })
        .getState();

      expect(state.addingLesson).toEqual({ sectionId: "s1", value: "" });
    });

    it("14. new-lesson-title-changed: update value", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "add-lesson-clicked", sectionId: "s1" })
        .send({ type: "new-lesson-title-changed", value: "New Lesson" })
        .getState();

      expect(state.addingLesson).toEqual({
        sectionId: "s1",
        value: "New Lesson",
      });
    });

    it("15. new-lesson-save-requested: add lesson + emit plan-changed + emit focus", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "add-lesson-clicked", sectionId: "s1" })
        .resetExec()
        .send({ type: "new-lesson-title-changed", value: "New Lesson" })
        .send({ type: "new-lesson-save-requested" })
        .getState();

      expect(state.addingLesson).toBeNull();
      expect(state.plan.sections[0]?.lessons).toHaveLength(1);
      expect(state.plan.sections[0]?.lessons[0]?.title).toBe("New Lesson");
      expect(state.plan.sections[0]?.lessons[0]?.order).toBe(1);
      expect(state.plan.sections[0]?.lessons[0]?.description).toBe("");

      expect(state.focusRequest).toEqual({
        type: "add-lesson-button",
        sectionId: "s1",
      });

      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
      expect(tester.getExec()).toHaveBeenCalledWith({
        type: "focus-element",
        target: { type: "add-lesson-button", sectionId: "s1" },
      });
    });

    it("16. new-lesson-cancel-requested: exit add mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithSection)
      );

      const state = tester
        .send({ type: "add-lesson-clicked", sectionId: "s1" })
        .send({ type: "new-lesson-title-changed", value: "New Lesson" })
        .send({ type: "new-lesson-cancel-requested" })
        .getState();

      expect(state.addingLesson).toBeNull();
      expect(state.plan.sections[0]?.lessons).toHaveLength(0);
    });
  });

  describe("Edit Lesson (17-20)", () => {
    const planWithLesson = createTestPlan({
      sections: [
        {
          id: "s1",
          title: "Section 1",
          order: 0,
          lessons: [{ id: "l1", title: "Existing Lesson", order: 0 }],
        },
      ],
    });

    it("17. lesson-title-clicked: enter edit mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({ type: "lesson-title-clicked", lessonId: "l1", sectionId: "s1" })
        .getState();

      expect(state.editingLesson).toEqual({
        lessonId: "l1",
        value: "Existing Lesson",
      });
    });

    it("18. lesson-title-changed: update value", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({ type: "lesson-title-clicked", lessonId: "l1", sectionId: "s1" })
        .send({ type: "lesson-title-changed", value: "Updated Lesson" })
        .getState();

      expect(state.editingLesson).toEqual({
        lessonId: "l1",
        value: "Updated Lesson",
      });
    });

    it("19. lesson-save-requested: update lesson + emit plan-changed", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({ type: "lesson-title-clicked", lessonId: "l1", sectionId: "s1" })
        .resetExec()
        .send({ type: "lesson-title-changed", value: "Updated Lesson" })
        .send({ type: "lesson-save-requested" })
        .getState();

      expect(state.editingLesson).toBeNull();
      expect(state.plan.sections[0]?.lessons[0]?.title).toBe("Updated Lesson");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("20. lesson-cancel-requested: exit edit mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({ type: "lesson-title-clicked", lessonId: "l1", sectionId: "s1" })
        .send({ type: "lesson-title-changed", value: "Changed" })
        .send({ type: "lesson-cancel-requested" })
        .getState();

      expect(state.editingLesson).toBeNull();
      expect(state.plan.sections[0]?.lessons[0]?.title).toBe("Existing Lesson");
    });
  });

  describe("Delete Lesson (21)", () => {
    it("21. lesson-delete-requested: remove lesson + remove from dependencies + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1, dependencies: ["l1"] },
              {
                id: "l3",
                title: "Lesson 3",
                order: 2,
                dependencies: ["l1", "l2"],
              },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-delete-requested",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons).toHaveLength(2);
      expect(state.plan.sections[0]?.lessons[0]?.id).toBe("l2");
      expect(state.plan.sections[0]?.lessons[0]?.dependencies).toEqual([]);
      expect(state.plan.sections[0]?.lessons[1]?.id).toBe("l3");
      expect(state.plan.sections[0]?.lessons[1]?.dependencies).toEqual(["l2"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Lesson Description (22-25)", () => {
    const planWithLesson = createTestPlan({
      sections: [
        {
          id: "s1",
          title: "Section 1",
          order: 0,
          lessons: [
            {
              id: "l1",
              title: "Lesson 1",
              order: 0,
              description: "Initial description",
            },
          ],
        },
      ],
    });

    it("22. lesson-description-clicked: enter description edit mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({
          type: "lesson-description-clicked",
          lessonId: "l1",
          sectionId: "s1",
        })
        .getState();

      expect(state.editingDescription).toEqual({
        lessonId: "l1",
        value: "Initial description",
      });
    });

    it("23. lesson-description-changed: update value", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({
          type: "lesson-description-clicked",
          lessonId: "l1",
          sectionId: "s1",
        })
        .send({ type: "lesson-description-changed", value: "New description" })
        .getState();

      expect(state.editingDescription).toEqual({
        lessonId: "l1",
        value: "New description",
      });
    });

    it("24. lesson-description-save-requested: update + emit plan-changed", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({
          type: "lesson-description-clicked",
          lessonId: "l1",
          sectionId: "s1",
        })
        .resetExec()
        .send({ type: "lesson-description-changed", value: "New description" })
        .send({ type: "lesson-description-save-requested" })
        .getState();

      expect(state.editingDescription).toBeNull();
      expect(state.plan.sections[0]?.lessons[0]?.description).toBe(
        "New description"
      );
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("25. lesson-description-cancel-requested: exit edit mode", () => {
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(planWithLesson)
      );

      const state = tester
        .send({
          type: "lesson-description-clicked",
          lessonId: "l1",
          sectionId: "s1",
        })
        .send({ type: "lesson-description-changed", value: "Changed" })
        .send({ type: "lesson-description-cancel-requested" })
        .getState();

      expect(state.editingDescription).toBeNull();
      expect(state.plan.sections[0]?.lessons[0]?.description).toBe(
        "Initial description"
      );
    });
  });

  describe("Lesson Icon (26)", () => {
    it("26. lesson-icon-changed: update icon + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-icon-changed",
          sectionId: "s1",
          lessonId: "l1",
          icon: "code",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.icon).toBe("code");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Lesson Status", () => {
    it("lesson-status-toggled: toggle from todo to done + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, status: "todo" },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("done");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-status-toggled: toggle from done to todo + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0, status: "done" },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("todo");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("lesson-status-toggled: default undefined status treated as todo", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [{ id: "l1", title: "Lesson 1", order: 0 }], // no status field
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-status-toggled",
          sectionId: "s1",
          lessonId: "l1",
        })
        .getState();

      // undefined should toggle to "done"
      expect(state.plan.sections[0]?.lessons[0]?.status).toBe("done");
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Lesson Dependencies (27)", () => {
    it("27. lesson-dependencies-changed: update dependencies + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1 },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({
          type: "lesson-dependencies-changed",
          sectionId: "s1",
          lessonId: "l2",
          dependencies: ["l1"],
        })
        .getState();

      expect(state.plan.sections[0]?.lessons[1]?.dependencies).toEqual(["l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Reordering (28-30)", () => {
    it("28. section-reordered: update section orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          { id: "s1", title: "Section 1", order: 0, lessons: [] },
          { id: "s2", title: "Section 2", order: 1, lessons: [] },
          { id: "s3", title: "Section 3", order: 2, lessons: [] },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move s1 from index 0 to index 2
      const state = tester
        .send({ type: "section-reordered", sectionId: "s1", newIndex: 2 })
        .getState();

      const sortedSections = [...state.plan.sections].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedSections.map((s) => s.id)).toEqual(["s2", "s3", "s1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("29. lesson-reordered (same section): update orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1 },
              { id: "l3", title: "Lesson 3", order: 2 },
            ],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move l1 from index 0 to index 2
      const state = tester
        .send({
          type: "lesson-reordered",
          fromSectionId: "s1",
          toSectionId: "s1",
          lessonId: "l1",
          newIndex: 2,
        })
        .getState();

      const sortedLessons = [...state.plan.sections[0]!.lessons].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedLessons.map((l) => l.id)).toEqual(["l2", "l3", "l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });

    it("30. lesson-reordered (cross section): move + update orders + emit plan-changed", () => {
      const plan = createTestPlan({
        sections: [
          {
            id: "s1",
            title: "Section 1",
            order: 0,
            lessons: [
              { id: "l1", title: "Lesson 1", order: 0 },
              { id: "l2", title: "Lesson 2", order: 1 },
            ],
          },
          {
            id: "s2",
            title: "Section 2",
            order: 1,
            lessons: [{ id: "l3", title: "Lesson 3", order: 0 }],
          },
        ],
      });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      // Move l1 from s1 to s2 at index 1
      const state = tester
        .send({
          type: "lesson-reordered",
          fromSectionId: "s1",
          toSectionId: "s2",
          lessonId: "l1",
          newIndex: 1,
        })
        .getState();

      expect(state.plan.sections[0]?.lessons.map((l) => l.id)).toEqual(["l2"]);
      const sortedS2Lessons = [...state.plan.sections[1]!.lessons].sort(
        (a, b) => a.order - b.order
      );
      expect(sortedS2Lessons.map((l) => l.id)).toEqual(["l3", "l1"]);
      expect(tester.getExec()).toHaveBeenCalledWith(
        expect.objectContaining({ type: "plan-changed" })
      );
    });
  });

  describe("Sync (31-32)", () => {
    it("31. sync-failed: store error", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      const state = tester
        .send({ type: "sync-failed", error: "Network error" })
        .getState();

      expect(state.syncError).toBe("Network error");
    });

    it("32. sync-retry-requested: emit plan-changed", () => {
      const plan = createTestPlan({ title: "Test Plan" });
      const tester = new ReducerTester(
        planStateReducer,
        createInitialState(plan)
      );

      const state = tester
        .send({ type: "sync-failed", error: "Network error" })
        .resetExec()
        .send({ type: "sync-retry-requested" })
        .getState();

      expect(tester.getExec()).toHaveBeenCalledWith({
        type: "plan-changed",
      });
      // Note: syncError remains until sync succeeds
      expect(state.syncError).toBe("Network error");
    });
  });

  describe("Focus (33)", () => {
    it("33. focus-handled: clear focusRequest", () => {
      const tester = new ReducerTester(planStateReducer, createInitialState());

      // First create a section to get a focus request
      const stateWithFocus = tester
        .send({ type: "add-section-clicked" })
        .send({ type: "new-section-title-changed", value: "New Section" })
        .send({ type: "new-section-save-requested" })
        .getState();

      expect(stateWithFocus.focusRequest).not.toBeNull();

      const state = tester.send({ type: "focus-handled" }).getState();

      expect(state.focusRequest).toBeNull();
    });
  });
});
