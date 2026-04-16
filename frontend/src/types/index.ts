export type UserRole = "student" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  formation?: string;
  year?: number;
  level?: number;
  avgScore?: number;
  skills?: string[];
  weakPoints?: string[];
  streak?: number;
  completedTPs?: number;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  domain: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  tags: string[];
  duration: string;
  icon: string;
  aiRecommended?: boolean;
  matchPercentage?: number;
  generatedCount?: number;
  avgScore?: number;
  active?: boolean;
}

export interface Submission {
  id: string;
  studentId: string;
  topicId: string;
  topicTitle: string;
  score: number;
  duration: string;
  date: string;
  status: "completed" | "in-progress" | "failed";
  tests: TestResult[];
  aiAnalysis?: AIAnalysis;
}

export interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface AIAnalysis {
  accuracy: number;
  performance: number;
  readability: number;
  bestPractices: number;
  errors: { type: string; count: number }[];
  recommendations: string[];
}

export interface ChatMessage {
  id: string;
  sender: "agent" | "student";
  agentType?: "tuteur" | "explicateur" | "analyste";
  content: string;
  timestamp: string;
}

export interface RAGDocument {
  id: string;
  filename: string;
  type: "pdf" | "md" | "txt";
  size: string;
  topic: string;
  status: "indexed" | "processing";
  dateAdded: string;
  chunks?: number;
}

export interface WeeklyReport {
  studentId: string;
  week: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}
