import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, UpdateProfileInput, UserDTO } from '@sprintly/shared';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { disconnectSocket } from '@/lib/socket';

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return (await api.get<{ user: UserDTO }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });
}

/** For components rendered inside <RequireAuth>, where the user is guaranteed. */
export function useCurrentUser() {
  const { data } = useMe();
  if (!data) throw new Error('useCurrentUser used outside an authenticated route');
  return data;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginInput) => api.post<{ user: UserDTO }>('/auth/login', body),
    onSuccess: ({ user }) => qc.setQueryData(qk.me, user),
    meta: { silent: true },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterInput) => api.post<{ user: UserDTO }>('/auth/register', body),
    onSuccess: ({ user }) => qc.setQueryData(qk.me, user),
    meta: { silent: true },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      disconnectSocket();
      qc.clear();
      qc.setQueryData(qk.me, null);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => api.patch<{ user: UserDTO }>('/auth/me', body),
    onSuccess: ({ user }) => {
      qc.setQueryData(qk.me, user);
      // Name/colour appear on issues, comments and team lists.
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
    meta: { silent: true },
  });
}
