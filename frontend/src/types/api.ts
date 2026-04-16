/**
 * TypeScript types aligned with the LearnLab AI backend responses.
 * These mirror exactly what the FastAPI endpoints return.
 */

// ── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterStudentRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  formation: string;
  filiere: string;
  year_of_study: number;
  invitation_code: string;
}

export interface RegisterTeacherRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: "student" | "teacher";
  first_name: string;
  last_name: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserResponse;
}

// ── Student Profile ──────────────────────────────────────────────────────────

export interface StudentProfileResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  formation: string | null;
  filiere: string | null;
  year_of_study: number | null;
  niveau: number;
  concepts_maitrises: string[];
  points_faibles: string[];
  score_moyen: number | null;
  tps_completes: number;
  derniere_activite: string | null;
}

// ── Topics ───────────────────────────────────────────────────────────────────

export interface TopicListItem {
  id: string;
  title: string;
  description: string | null;
  domaine: string | null;
  niveau_min: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  teacher_id: string;
}

export interface CreateTopicRequest {
  title: string;
  description?: string;
  domaine?: string;
  niveau_min: number;
  tags?: string[];
  is_active: boolean;
}

export interface TopicResponse {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  domaine: string | null;
  niveau_min: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
}

// ── TPs ──────────────────────────────────────────────────────────────────────

export interface GeneratedTPResponse {
  tp_id: string;
  enonce: string;
  starter_code: string;
  tests_count: number;
}

export interface TPDetailResponse {
  tp_id: string;
  enonce: string;
  starter_code: string;
  tests_count: number;
  topic_id: string | null;
  topic_title: string | null;
  created_at: string;
}

// ── Submission ────────────────────────────────────────────────────────────────

export interface SubmitRequest {
  code: string;
}

export interface TestResultApi {
  description: string;
  passed: boolean;
  actual: string | null;
  expected: string | null;
}

export interface ErrorItemApi {
  type: "SyntaxError" | "LogicError" | "AlgoError" | "ConceptError" | string;
  description: string;
  line: number | null;
}

export interface SubmitResponse {
  submission_id: string;
  score: number;
  tests_results: TestResultApi[];
  errors_categorized: ErrorItemApi[];
  feedback: string;
  hint?: string | null;
  hint_level?: number | null;
}

// ── Hint ─────────────────────────────────────────────────────────────────────

export interface HintResponse {
  hint: string;
  hint_level: number;
}

// ── RAG Documents ─────────────────────────────────────────────────────────────

export interface RagDocument {
  id: string;
  filename: string;
  file_type: string;
  topic_id: string | null;
  chunks_count: number;
  status: "pending" | "indexed" | "error";
  uploaded_at: string;
}

// ── Teacher ───────────────────────────────────────────────────────────────────

export interface StudentSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  niveau: number;
  score_moyen: number | null;
  submissions_count: number;
  derniere_activite: string | null;
}

export interface SubmissionSummary {
  id: string;
  tp_id: string;
  score: number | null;
  errors_json: Record<string, unknown> | null;
  created_at: string;
}

export interface SubmissionHistoryItem {
  id: string;
  tp_id: string | null;
  topic_title: string | null;
  score: number | null;
  created_at: string;
  tests_passed: number;
  tests_total: number;
}

export interface TopErrorItem {
  type: string;
  count: number;
  percentage: number;
}

export interface StudentAtRisk {
  student_id: string;
  name: string;
  avg_score: number;
  last_activity: string | null;
}

export interface AnalyticsResponse {
  total_students: number;
  avg_score_class: number | null;
  completion_rate: number;
  top_errors: TopErrorItem[];
  students_at_risk: StudentAtRisk[];
}

export interface InvitationCode {
  code: string;
  teacher_id: string;
  expires_at: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  enrolled_count: number;
}

export interface ReportResponse {
  id: string;
  student_id: string;
  period_start: string;
  period_end: string;
  content: string;
  metrics_json: Record<string, unknown> | null;
  created_at: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: "tuteur" | "explicateur";
  isStreaming?: boolean;
}
