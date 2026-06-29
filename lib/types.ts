export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  default_model: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model_id: string | null;
  created_at: string;
}
