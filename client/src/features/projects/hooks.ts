import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberInput,
  CreateProjectInput,
  CreateTeamInput,
  ProjectDTO,
  TeamDTO,
  TeamRole,
  UserDTO,
} from '@sprintly/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryKeys';

// ---------- Teams ----------
export function useTeams() {
  return useQuery({
    queryKey: qk.teams,
    queryFn: ({ signal }) => api.get<{ teams: TeamDTO[] }>('/teams', undefined, signal).then((r) => r.teams),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTeamInput) => api.post<{ team: TeamDTO }>('/teams', body).then((r) => r.team),
    onSuccess: (team) => qc.setQueryData<TeamDTO[]>(qk.teams, (old) => [...(old ?? []), team]),
    meta: { silent: true },
  });
}

export function useUpdateTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateTeamInput>) => api.patch<{ team: TeamDTO }>(`/teams/${teamId}`, body).then((r) => r.team),
    onSuccess: (team) => qc.setQueryData<TeamDTO[]>(qk.teams, (old) => old?.map((t) => (t.id === team.id ? team : t))),
    meta: { silent: true },
  });
}

function replaceTeam(qc: ReturnType<typeof useQueryClient>, team: TeamDTO) {
  qc.setQueryData<TeamDTO[]>(qk.teams, (old) => old?.map((t) => (t.id === team.id ? team : t)));
  // Assignee pickers read members per project.
  void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'projects' && q.queryKey[2] === 'members' });
}

export function useAddMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddMemberInput) => api.post<{ team: TeamDTO }>(`/teams/${teamId}/members`, body).then((r) => r.team),
    onSuccess: (team) => replaceTeam(qc, team),
    meta: { silent: true },
  });
}

export function useUpdateMemberRole(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<TeamRole, 'owner'> }) =>
      api.patch<{ team: TeamDTO }>(`/teams/${teamId}/members/${userId}`, { role }).then((r) => r.team),
    // Optimistic: the select already shows the new value, so make the cache agree.
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: qk.teams });
      const prev = qc.getQueryData<TeamDTO[]>(qk.teams);
      qc.setQueryData<TeamDTO[]>(qk.teams, (old) =>
        old?.map((t) =>
          t.id === teamId ? { ...t, members: t.members.map((m) => (m.user.id === userId ? { ...m, role } : m)) } : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(qk.teams, ctx?.prev),
    onSuccess: (team) => replaceTeam(qc, team),
  });
}

export function useRemoveMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.teams });
      void qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

// ---------- Projects ----------
export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: ({ signal }) => api.get<{ projects: ProjectDTO[] }>('/projects', undefined, signal).then((r) => r.projects),
  });
}

type ProjectDetail = { project: ProjectDTO; myRole: TeamRole };

export function useProject(id: string) {
  const qc = useQueryClient();
  return useQuery<ProjectDetail>({
    queryKey: qk.project(id),
    queryFn: ({ signal }) => api.get<ProjectDetail>(`/projects/${id}`, undefined, signal),
    // Render instantly from the sidebar's project list while the detail loads.
    // Role defaults to the least-privileged until the real response arrives.
    placeholderData: (): ProjectDetail | undefined => {
      const p = qc.getQueryData<ProjectDTO[]>(qk.projects)?.find((x) => x.id === id);
      return p ? { project: p, myRole: 'viewer' } : undefined;
    },
  });
}

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: qk.members(id),
    queryFn: ({ signal }) =>
      api.get<{ members: { user: UserDTO; role: TeamRole }[] }>(`/projects/${id}/members`, undefined, signal).then((r) => r.members),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectInput) => api.post<{ project: ProjectDTO }>('/projects', body).then((r) => r.project),
    onSuccess: (project) => qc.setQueryData<ProjectDTO[]>(qk.projects, (old) => [...(old ?? []), project]),
    meta: { silent: true },
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<CreateProjectInput, 'teamId' | 'key'>>) =>
      api.patch<{ project: ProjectDTO }>(`/projects/${id}`, body).then((r) => r.project),
    onSuccess: (project) => {
      qc.setQueryData<ProjectDTO[]>(qk.projects, (old) => old?.map((p) => (p.id === id ? project : p)));
      void qc.invalidateQueries({ queryKey: qk.project(id), exact: true });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: (_d, id) => {
      qc.setQueryData<ProjectDTO[]>(qk.projects, (old) => old?.filter((p) => p.id !== id));
      qc.removeQueries({ queryKey: qk.project(id) });
    },
  });
}

export function useCreateLabel(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      api.post<{ project: ProjectDTO }>(`/projects/${projectId}/labels`, body).then((r) => r.project),
    onSuccess: (project) => {
      qc.setQueryData<{ project: ProjectDTO; myRole: TeamRole }>(qk.project(projectId), (old) =>
        old ? { ...old, project: { ...old.project, labels: project.labels } } : old,
      );
      qc.setQueryData<ProjectDTO[]>(qk.projects, (old) =>
        old?.map((p) => (p.id === projectId ? { ...p, labels: project.labels } : p)),
      );
    },
  });
}
