import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  GeneratedTPResponse,
  TPDetailResponse,
  SubmitResponse,
  HintResponse,
} from "@/types/api";

export interface RunCodeResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  runtime_available: boolean;
}

export function useGenerateTP() {
  const [tp, setTP] = useState<GeneratedTPResponse | null>(null);

  const mutation = useMutation({
    mutationFn: (topicId: string) =>
      api.post<GeneratedTPResponse>(`/student/topics/${topicId}/generate`),
    onSuccess: (data) => setTP(data),
  });

  return {
    generateTP: mutation.mutateAsync,
    tp,
    isGenerating: mutation.isPending,
    error: mutation.error,
  };
}

export function useTPDetail(tpId: string | null) {
  return useQuery<TPDetailResponse>({
    queryKey: ["tp-detail", tpId],
    queryFn: () => api.get<TPDetailResponse>(`/student/tp/${tpId}/detail`),
    enabled: !!tpId,
    staleTime: Infinity,
  });
}

export function useSubmitTP() {
  const [result, setResult] = useState<SubmitResponse | null>(null);

  const mutation = useMutation({
    mutationFn: ({ tpId, code }: { tpId: string; code: string }) =>
      api.post<SubmitResponse>(`/student/tp/${tpId}/submit`, { code }),
    onSuccess: (data) => setResult(data),
  });

  return {
    submit: mutation.mutateAsync,
    result,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  };
}

export function useRunCode() {
  const mutation = useMutation({
    mutationFn: ({ tpId, code, language }: { tpId: string; code: string; language: string }) =>
      api.post<RunCodeResponse>(`/student/tp/${tpId}/run`, { code, language }),
  });

  return {
    runCode: mutation.mutateAsync,
    isRunning: mutation.isPending,
    error: mutation.error,
  };
}

export function useHint(tpId: string | null) {
  const [hint, setHint] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);

  const mutation = useMutation({
    mutationFn: () => api.get<HintResponse>(`/student/tp/${tpId}/hint`),
    onSuccess: (data) => {
      setHint(data.hint);
      setHintLevel(data.hint_level);
    },
  });

  return {
    requestHint: mutation.mutate,
    hint,
    hintLevel,
    isLoading: mutation.isPending,
  };
}
