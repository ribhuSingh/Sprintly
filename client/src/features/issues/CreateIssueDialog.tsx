import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Tag, UserRound } from 'lucide-react';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  createIssueSchema,
} from '@sprintly/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { AvatarStack, EmptyState } from '@/components/ui/misc';
import type { CreateIssueOptions } from '@/components/layout/uiContext';
import { useUI } from '@/components/layout/uiContext';
import { useProjectMembers, useProjects } from '@/features/projects/hooks';
import { FolderKanban } from 'lucide-react';
import { useCreateIssue } from './hooks';
import { AssigneePicker, LabelPicker, PriorityIcon, PriorityPicker, StatusIcon, StatusPicker, propertyButton } from './IssueBits';

// Reuse the API's rules for shared fields so client and server validation can't drift.
const formSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  title: createIssueSchema.shape.title,
  description: z.string().max(10_000),
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(ISSUE_PRIORITIES),
  assignees: z.array(z.string()),
  labels: z.array(z.string()),
  dueDate: z.string(),
});
export type IssueFormValues = z.infer<typeof formSchema>;

export default function CreateIssueDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults: CreateIssueOptions;
}) {
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const ui = useUI();

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: defaults.projectId ?? projects?.[0]?.id ?? '',
      title: '',
      description: '',
      status: defaults.status ?? 'todo',
      priority: 'none',
      assignees: [],
      labels: [],
      dueDate: '',
    },
  });
  const { errors } = form.formState;
  const projectId = form.watch('projectId');
  const project = projects?.find((p) => p.id === projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const create = useCreateIssue(projectId);

  // Projects may still be loading when the dialog opens via shortcut.
  useEffect(() => {
    if (!form.getValues('projectId') && projects?.[0]) form.setValue('projectId', projects[0].id);
  }, [projects, form]);

  // Labels/assignees belong to a project: clear them when the project changes.
  useEffect(() => {
    form.setValue('labels', []);
    form.setValue('assignees', []);
  }, [projectId, form]);

  const onSubmit = (createAnother: boolean) =>
    form.handleSubmit(({ projectId: _p, dueDate, ...values }) =>
      create.mutate(
        { ...values, dueDate: dueDate ? new Date(`${dueDate}T12:00:00`) : null },
        {
          onSuccess: (issue) => {
            toast.success(`Created ${issue.identifier}`, {
              action: { label: 'View', onClick: () => navigate(`/projects/${issue.project}/board?issue=${issue.id}`) },
            });
            if (createAnother) form.reset({ ...form.getValues(), title: '', description: '' });
            else onOpenChange(false);
          },
          onError: (err) => form.setError('root', { message: err.message }),
        },
      ),
    );

  if (projects && projects.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle className="sr-only">Create issue</DialogTitle>
          <EmptyState
            icon={FolderKanban}
            title="Create a project first"
            description="Issues live inside projects."
            action={<Button onClick={() => { onOpenChange(false); ui.openCreateProject(); }}>New project</Button>}
          />
        </DialogContent>
      </Dialog>
    );
  }

  const memberUsers = members.map((m) => m.user);
  const assigneeIds = form.watch('assignees');
  const labelIds = form.watch('labels');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            <kbd className="font-mono">Ctrl/⌘ + Enter</kbd> to create
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={onSubmit(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void onSubmit(false)();
          }}
          className="space-y-4"
        >
          {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
          <Field label="Project" error={errors.projectId?.message}>
            {(p) => (
              <NativeSelect {...p} {...form.register('projectId')}>
                {projects?.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({pr.key})
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Title" error={errors.title?.message}>
            {(p) => <Input {...p} placeholder="Issue title" autoFocus {...form.register('title')} />}
          </Field>
          <Field label="Description" error={errors.description?.message}>
            {(p) => <Textarea {...p} rows={4} placeholder="Add more detail (Markdown supported)…" {...form.register('description')} />}
          </Field>

          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Properties</legend>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <StatusPicker value={field.value} onChange={field.onChange}>
                  <button type="button" className={`${propertyButton} border-border`} aria-label={`Status: ${STATUS_LABELS[field.value]}`}>
                    <StatusIcon status={field.value} /> {STATUS_LABELS[field.value]}
                  </button>
                </StatusPicker>
              )}
            />
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <PriorityPicker value={field.value} onChange={field.onChange}>
                  <button type="button" className={`${propertyButton} border-border`} aria-label={`Priority: ${PRIORITY_LABELS[field.value]}`}>
                    <PriorityIcon priority={field.value} /> {PRIORITY_LABELS[field.value]}
                  </button>
                </PriorityPicker>
              )}
            />
            <Controller
              control={form.control}
              name="assignees"
              render={({ field }) => (
                <AssigneePicker value={field.value} members={memberUsers} onChange={field.onChange}>
                  <button type="button" className={`${propertyButton} border-border`} aria-label="Assignees">
                    {assigneeIds.length ? (
                      <AvatarStack users={memberUsers.filter((m) => assigneeIds.includes(m.id))} size="xs" />
                    ) : (
                      <UserRound className="size-4 text-muted-foreground" />
                    )}
                    {assigneeIds.length ? `${assigneeIds.length} assignee${assigneeIds.length > 1 ? 's' : ''}` : 'Assignee'}
                  </button>
                </AssigneePicker>
              )}
            />
            <Controller
              control={form.control}
              name="labels"
              render={({ field }) => (
                <LabelPicker value={field.value} labels={project?.labels ?? []} onChange={field.onChange}>
                  <button type="button" className={`${propertyButton} border-border`} aria-label="Labels">
                    <Tag className="size-4 text-muted-foreground" />
                    {labelIds.length ? `${labelIds.length} label${labelIds.length > 1 ? 's' : ''}` : 'Labels'}
                  </button>
                </LabelPicker>
              )}
            />
            <label className="sr-only" htmlFor="new-issue-due">Due date</label>
            <Input id="new-issue-due" type="date" className="h-8 w-auto" {...form.register('dueDate')} />
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void onSubmit(true)()} disabled={create.isPending}>
              Create &amp; add another
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
