export type LessonIcon = "watch" | "code";

export interface Lesson {
  id: string;
  title: string;
  order: number;
  description: string;
  icon?: LessonIcon;
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
