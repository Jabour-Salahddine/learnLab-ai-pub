import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  StudentSummary,
  SubmissionSummary,
  AnalyticsResponse,
  InvitationCode,
  RagDocument,
} from "@/types/api";

export function useStudents() {
  const { data, isLoading, error } = useQuery<StudentSummary[]>({
    queryKey: ["teacher-students"],
    queryFn: () => api.get<StudentSummary[]>("/teacher/students"),
    staleTime: 30_000,
  });
  return { students: data ?? [], isLoading, error };
}

export function useStudentSubmissions(studentId: string | null) {
  return useQuery<SubmissionSummary[]>({
    queryKey: ["student-submissions", studentId],
    queryFn: () => api.get<SubmissionSummary[]>(`/teacher/students/${studentId}/submissions`),
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export function useAnalytics() {
  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ["teacher-analytics"],
    queryFn: () => api.get<AnalyticsResponse>("/teacher/analytics"),
    staleTime: 60_000,
  });
  return { analytics: data ?? null, isLoading, error };
}

export function useInvitationCodes() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InvitationCode[]>({
    queryKey: ["invitation-codes"],
    queryFn: () => api.get<InvitationCode[]>("/teacher/invitation-codes"),
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: (maxUses = 100) =>
      api.post<InvitationCode>("/teacher/invitation-codes", { max_uses: maxUses }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["invitation-codes"] }),
  });

  return {
    codes: data ?? [],
    isLoading,
    generateCode: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
  };
}

export function useRAGDocuments() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<RagDocument[]>({
    queryKey: ["rag-documents"],
    queryFn: () => api.get<RagDocument[]>("/rag/documents"),
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, topicId }: { file: File; topicId?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (topicId) formData.append("topic_id", topicId);
      return api.upload<RagDocument>("/rag/documents/upload", formData);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rag-documents"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/rag/documents/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rag-documents"] }),
  });

  return {
    documents: data ?? [],
    isLoading,
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

/** Hook for a teacher to fetch details about a specific student (report, etc.). */
export function useStudentDetail(studentId: string | null) {
  const [report, setReport] = useState<{ content: string; metrics: Record<string, unknown> } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchReport = async () => {
    if (!studentId) return;
    setReportLoading(true);
    try {
      const data = await api.get<{
        content: string;
        metrics: Record<string, unknown>;
      }>(`/teacher/students/${studentId}/report`);
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  return { report, reportLoading, fetchReport };
}

