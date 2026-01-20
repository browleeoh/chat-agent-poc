export interface Lesson {
  id: string;
  title: string;
  order: string; // fractional index
  notes: string;
}

export interface Section {
  id: string;
  title: string;
  order: string; // fractional index
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
