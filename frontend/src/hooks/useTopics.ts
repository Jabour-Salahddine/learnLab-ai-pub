import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TopicListItem, TopicResponse, CreateTopicRequest } from "@/types/api";

export function useStudentTopics() {
  const { data, isLoading, error } = useQuery<TopicListItem[]>({
    queryKey: ["student-topics"],
    queryFn: () => api.get<TopicListItem[]>("/student/topics"),
    staleTime: 60_000,
  });
  return { topics: data ?? [], isLoading, error };
}

export function useTeacherTopics() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<TopicResponse[]>({
    queryKey: ["teacher-topics"],
    queryFn: () => api.get<TopicResponse[]>("/teacher/topics"),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateTopicRequest) =>
      api.post<TopicResponse>("/teacher/topics", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-topics"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<CreateTopicRequest> & { id: string }) =>
      api.put<TopicResponse>(`/teacher/topics/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher-topics"] }),
  });

  return {
    topics: data ?? [],
    isLoading,
    error,
    createTopic: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTopic: updateMutation.mutateAsync,
  };
}
