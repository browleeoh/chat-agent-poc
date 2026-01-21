export type LessonIcon = "watch" | "code" | "discussion";
export type LessonStatus = "todo" | "done";

export interface Lesson {
  id: string;
  title: string;
  order: number;
  description?: string;
  icon?: LessonIcon;
  status?: LessonStatus;
  dependencies?: string[]; // Array of lesson IDs this lesson depends on
}

export interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Plan {
  id: string;
  title: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  sections: Section[];
}

export interface PlansState {
  plans: Plan[];
}
