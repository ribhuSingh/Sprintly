import { useEffect } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronRight, Crown, Shield, Trash2, Users } from 'lucide-react';
import {
  addMemberSchema,
  createTeamSchema,
  hasRole,
  updateProfileSchema,
  type AddMemberInput,
  type CreateTeamInput,
  type TeamDTO,
  type TeamRole,
  type UpdateProfileInput,
} from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Avatar, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { ErrorFallback } from '@/components/ErrorBoundary';
import { ApiError } from '@/lib/api';
import { cn, shortDate } from '@/lib/utils';
import { useCurrentUser, useUpdateProfile } from '@/features/auth/hooks';
import { useAddMember, useCreateTeam, useRemoveMember, useTeams, useUpdateMemberRole, useUpdateTeam } from '@/features/projects/hooks';
import { PROJECT_COLORS } from '@/features/projects/CreateProjectDialog';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings">
        <nav aria-label="Settings sections" className="-mb-4 flex gap-4">
          {[
            { to: '/settings', label: 'Profile', end: true },
            { to: '/settings/teams', label: 'Teams & members' },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn('border-b-2 px-1 pb-2.5 text-sm', isActive ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </PageHeader>
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Routes>
          <Route index element={<ProfileSettings />} />
          <Route path="teams" element={<TeamsSettings />} />
          <Route path="teams/:teamId" element={<TeamDetail />} />
        </Routes>
      </div>
    </>
  );
}

// ---------------- Profile ----------------
function ProfileSettings() {
  const user = useCurrentUser();
  const update = useUpdateProfile();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name, title: user.title ?? '', avatarColor: user.avatarColor },
  });
  const { errors, isDirty } = form.formState;
  const color = form.watch('avatarColor');
  const name = form.watch('name');

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: ({ user: u }) => {
        toast.success('Profile updated');
        form.reset({ name: u.name, title: u.title ?? '', avatarColor: u.avatarColor });
      },
      onError: (err) => form.setError('root', { message: err.message }),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <p className="text-sm text-muted-foreground">How you appear to teammates.</p>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={onSubmit} className="space-y-5">
          {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
          <div className="flex items-center gap-4">
            <Avatar user={{ name: name || user.name, avatarColor: color }} size="lg" />
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Avatar colour</legend>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Avatar colour">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    onClick={() => form.setValue('avatarColor', c, { shouldDirty: true })}
                    className={cn('size-6 rounded-full ring-offset-2 ring-offset-background cursor-pointer', color === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <Field label="Full name" error={errors.name?.message}>
            {(p) => <Input {...p} autoComplete="name" {...form.register('name')} />}
          </Field>
          <Field label="Job title" error={errors.title?.message} hint="Optional">
            {(p) => <Input {...p} placeholder="e.g. Frontend Engineer" {...form.register('title')} />}
          </Field>
          <Field label="Email" hint="Email changes aren’t supported in this demo">
            {(p) => <Input {...p} value={user.email} readOnly disabled />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty} loading={update.isPending}>Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------- Teams list ----------------
function TeamsSettings() {
  const { data: teams, isPending, error, refetch } = useTeams();
  const [params] = useSearchParams();
  const welcome = params.get('welcome');
  const create = useCreateTeam();
  const navigate = useNavigate();
  const form = useForm<CreateTeamInput>({ resolver: zodResolver(createTeamSchema), defaultValues: { name: '', description: '' } });

  const onSubmit = form.handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (team) => {
        toast.success(`Team ${team.name} created`);
        form.reset();
        navigate(`/settings/teams/${team.id}`);
      },
      onError: (err) => form.setError('name', { message: err.message }),
    }),
  );

  return (
    <div className="space-y-6">
      {welcome && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">Welcome to Sprintly! 👋</p>
          <p className="text-muted-foreground">Start by creating a team. You’ll be its owner and can invite teammates and create projects.</p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Your teams</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorFallback error={error} onReset={() => void refetch()} />
          ) : isPending ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : teams.length === 0 ? (
            <EmptyState icon={Users} title="No teams yet" description="Create a team below to get started." />
          ) : (
            <ul className="divide-y rounded-lg border">
              {teams.map((t) => (
                <li key={t.id}>
                  <Link to={`/settings/teams/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.members.length} members · you are {t.myRole}</p>
                    </div>
                    <RoleBadge role={t.myRole} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a team</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <Field label="Team name" error={form.formState.errors.name?.message}>
              {(p) => <Input {...p} autoFocus={!!welcome} placeholder="e.g. Platform" {...form.register('name')} />}
            </Field>
            <Field label="Description" error={form.formState.errors.description?.message} hint="Optional">
              {(p) => <Textarea {...p} rows={2} {...form.register('description')} />}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={create.isPending}>Create team</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Team detail: members & roles ----------------
const ROLE_HELP: Record<TeamRole, string> = {
  owner: 'Full control, including deleting the team',
  admin: 'Manage members, projects and labels',
  member: 'Create and edit issues and comments',
  viewer: 'Read-only access',
};

function RoleBadge({ role }: { role: TeamRole }) {
  const Icon = role === 'owner' ? Crown : role === 'admin' ? Shield : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground" title={ROLE_HELP[role]}>
      {Icon && <Icon className="size-3" aria-hidden />} {role}
    </span>
  );
}

function TeamDetail() {
  const { teamId = '' } = useParams();
  const { data: teams, isPending } = useTeams();
  const team = teams?.find((t) => t.id === teamId);
  if (isPending) return <Skeleton className="h-64" />;
  if (!team) return <EmptyState icon={Users} title="Team not found" action={<Button asChild variant="outline"><Link to="/settings/teams">Back to teams</Link></Button>} />;
  return <TeamDetailInner team={team} />;
}

function TeamDetailInner({ team }: { team: TeamDTO }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const isAdmin = hasRole(team.myRole, 'admin');
  const isOwner = team.myRole === 'owner';
  const addMember = useAddMember(team.id);
  const updateRole = useUpdateMemberRole(team.id);
  const remove = useRemoveMember(team.id);
  const updateTeam = useUpdateTeam(team.id);

  const teamForm = useForm<CreateTeamInput>({ resolver: zodResolver(createTeamSchema), defaultValues: { name: team.name, description: team.description } });
  useEffect(() => teamForm.reset({ name: team.name, description: team.description }), [team.name, team.description, teamForm]);

  const inviteForm = useForm<AddMemberInput>({ resolver: zodResolver(addMemberSchema), defaultValues: { email: '', role: 'member' } });
  const onInvite = inviteForm.handleSubmit((values) =>
    addMember.mutate(values, {
      onSuccess: () => {
        toast.success(`Added ${values.email}`);
        inviteForm.reset({ email: '', role: values.role });
      },
      onError: (err) => inviteForm.setError('email', { message: err instanceof ApiError ? err.message : 'Could not add member' }),
    }),
  );

  // Who may change whom: owners manage everyone but themselves; admins manage members/viewers.
  const canManage = (role: TeamRole, userId: string) => userId !== me.id && role !== 'owner' && (isOwner || (isAdmin && role !== 'admin'));

  return (
    <div className="space-y-6">
      <Link to="/settings/teams" className="text-sm text-muted-foreground hover:text-foreground">← All teams</Link>

      <Card>
        <CardHeader><CardTitle>Team details</CardTitle></CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={teamForm.handleSubmit((v) => updateTeam.mutate(v, { onSuccess: () => toast.success('Team updated'), onError: (e) => teamForm.setError('root', { message: e.message }) }))}
            className="space-y-4"
          >
            {teamForm.formState.errors.root && <p role="alert" className="text-sm text-destructive">{teamForm.formState.errors.root.message}</p>}
            <Field label="Name" error={teamForm.formState.errors.name?.message}>
              {(p) => <Input {...p} disabled={!isAdmin} {...teamForm.register('name')} />}
            </Field>
            <Field label="Description" error={teamForm.formState.errors.description?.message}>
              {(p) => <Textarea {...p} rows={2} disabled={!isAdmin} {...teamForm.register('description')} />}
            </Field>
            {isAdmin && (
              <div className="flex justify-end">
                <Button type="submit" disabled={!teamForm.formState.isDirty} loading={updateTeam.isPending}>Save</Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members · {team.members.length}</CardTitle>
          <p className="text-sm text-muted-foreground">Roles control what each person can do across this team’s projects.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {team.members.map((m) => (
              <li key={m.user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar user={m.user} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.name} {m.user.id === me.id && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email} · joined {shortDate(m.joinedAt)}</p>
                </div>
                {canManage(m.role, m.user.id) ? (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.user.id}`}>Role for {m.user.name}</label>
                    <NativeSelect
                      id={`role-${m.user.id}`}
                      className="h-8 w-28"
                      value={m.role}
                      onChange={(e) => updateRole.mutate({ userId: m.user.id, role: e.target.value as Exclude<TeamRole, 'owner'> })}
                    >
                      {isOwner && <option value="admin">Admin</option>}
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </NativeSelect>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.user.name}`}
                      onClick={() => confirm(`Remove ${m.user.name} from ${team.name}?`) && remove.mutate(m.user.id, { onSuccess: () => toast.success(`Removed ${m.user.name}`) })}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </>
                ) : (
                  <RoleBadge role={m.role} />
                )}
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <form noValidate onSubmit={onInvite} className="flex flex-wrap items-start gap-2">
              <Field label="Add by email" error={inviteForm.formState.errors.email?.message} className="min-w-56 flex-1" hint="They need a Sprintly account (try ava@sprintly.dev)">
                {(p) => <Input {...p} type="email" placeholder="teammate@company.com" {...inviteForm.register('email')} />}
              </Field>
              <Field label="Role">
                {(p) => (
                  <NativeSelect {...p} className="w-28" {...inviteForm.register('role')}>
                    {isOwner && <option value="admin">Admin</option>}
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </NativeSelect>
                )}
              </Field>
              <Button type="submit" className="mt-6" loading={addMember.isPending}>Add member</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Only admins can add or manage members.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Role permissions</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">Permission</th>
                {(['owner', 'admin', 'member', 'viewer'] as const).map((r) => <th key={r} scope="col" className="py-2 text-center font-medium capitalize">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {([
                ['View projects & issues', 'viewer'],
                ['Create & edit issues, comment', 'member'],
                ['Create projects, manage labels', 'admin'],
                ['Add & manage members', 'admin'],
                ['Delete team', 'owner'],
              ] as const).map(([label, min]) => (
                <tr key={label} className="border-b last:border-0">
                  <td className="py-2">{label}</td>
                  {(['owner', 'admin', 'member', 'viewer'] as const).map((r) => (
                    <td key={r} className="py-2 text-center">
                      {hasRole(r, min) ? <span aria-label="Allowed">✓</span> : <span aria-label="Not allowed" className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {!isOwner && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => confirm(`Leave ${team.name}?`) && remove.mutate(me.id, { onSuccess: () => { toast.success(`You left ${team.name}`); navigate('/settings/teams'); } })}
          >
            Leave team
          </Button>
        </div>
      )}
    </div>
  );
}
