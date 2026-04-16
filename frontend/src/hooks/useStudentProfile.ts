import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StudentProfileResponse } from "@/types/api";

/** Hook for a student to fetch THEIR OWN profile. */
export function useMyProfile() {
  return useQuery<StudentProfileResponse>({
    queryKey: ["student-profile"],
    queryFn: () => api.get<StudentProfileResponse>("/student/profile"),
    staleTime: 60_000,
  });
}

/** @deprecated Use useMyProfile() instead */
export const useStudentProfile = useMyProfile;
