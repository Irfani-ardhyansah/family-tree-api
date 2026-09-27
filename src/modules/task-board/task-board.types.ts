export type TaskType = 'Bugfixing' | 'Feature' | 'Refactor';

export type TaskStatus = 'To-Do' | 'In Progress' | 'Merged' | 'Done';

export type LinkType = 'discord' | 'notion' | 'mr';

export interface TaskLink {
  id?: number;
  type: LinkType;
  url: string;
}

export interface TaskImage {
  id?: number;
  url: string;
}

export interface Task {
  id: number;
  person_id: number;
  type: TaskType;
  title: string;
  branch_name: string;
  status: TaskStatus;
  description: string | null;
  deploy_notes: string | null;
  links: TaskLink[];
  images: TaskImage[];
  created_at: string;
  updated_at: string;
}

export interface TaskCreateInput {
  type: TaskType;
  title: string;
  branch_name: string;
  status: TaskStatus;
  links?: TaskLink[];
  description?: string;
  deploy_notes?: string;
}

export interface TaskUpdateInput {
  type?: TaskType;
  title?: string;
  branch_name?: string;
  status?: TaskStatus;
  links?: TaskLink[];
  description?: string;
  deploy_notes?: string;
}

export interface TaskListQuery {
  type?: TaskType;
  status?: TaskStatus;
  search?: string;
}
