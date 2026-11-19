import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { hasRole, createProjectSchema } from '@sprintly/shared';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCreateProject, useTeams } from './hooks';

export const PROJECT_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9', '#22c55e'];

const formSchema = z.object({
  teamId: z.string().min(1, 'Choose a team'),
  name: createProjectSchema.shape.name,
  key: createProjectSchema.shape.key,
  description: z.string().max(500),
  color: z.string(),
  targetDate: z.string(),
});
type FormValues = z.input<typeof formSchema>;

const suggestKey = (name: string) =>
  (name.match(/\b[a-z]/gi)?.join('') || name).replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase().padEnd(2, 'X');

export default function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: teams } = useTeams();
  const adminTeams = teams?.filter((t) => hasRole(t.myRole, 'admin')) ?? [];
  const create = useCreateProject();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { teamId: adminTeams[0]?.id ?? '', name: '', key: '', description: '', color: PROJECT_COLORS[0], targetDate: '' },
  });
  const { errors, dirtyFields } = form.formState;
  const color = form.watch('color');
  const firstTeam = adminTeams[0]?.id;
  useEffect(() => {
    if (!form.getValues('teamId') && firstTeam) form.setValue('teamId', firstTeam);
  }, [firstTeam, form]);

  const onSubmit = form.handleSubmit(({ targetDate, ...values }) =>
    create.mutate(
      { ...values, targetDate: targetDate ? new Date(`${targetDate}T12:00:00`) : null },
      {
        onSuccess: (project) => {
          toast.success(`Project ${project.name} created`);
          onOpenChange(false);
          navigate(`/projects/${project.id}/board`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) form.setError('key', { message: err.message });
          else form.setError('root', { message: err.message });
        },
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects group issues and have their own board.</DialogDescription>
        </DialogHeader>
        {teams && adminTeams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="You need a team first"
            description="Projects belong to a team. Create one (you’ll be its owner) or ask an admin to make you one."
            action={
              <Button asChild onClick={() => onOpenChange(false)}>
                <Link to="/settings/teams">Create a team</Link>
              </Button>
            }
          />
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}
            <Field label="Team" error={errors.teamId?.message}>
              {(p) => (
                <NativeSelect {...p} {...form.register('teamId')}>
                  {adminTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Name" error={errors.name?.message}>
                {(p) => (
                  <Input
                    {...p}
                    autoFocus
                    placeholder="Web App"
                    {...form.register('name', {
                      onChange: (e) => {
                        // Auto-suggest a key until the user edits it themselves.
                        if (!dirtyFields.key) form.setValue('key', suggestKey(e.target.value));
                      },
                    })}
                  />
                )}
              </Field>
              <Field label="Key" error={errors.key?.message} hint="e.g. WEB-12">
                {(p) => <Input {...p} className="uppercase" maxLength={6} {...form.register('key')} />}
              </Field>
            </div>
            <Field label="Description" error={errors.description?.message}>
              {(p) => <Textarea {...p} rows={2} {...form.register('description')} />}
            </Field>
            <div className="flex flex-wrap items-end gap-6">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Colour</legend>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Project colour">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={c}
                      onClick={() => form.setValue('color', c)}
                      className={cn('size-6 rounded-full ring-offset-2 ring-offset-background cursor-pointer', color === c && 'ring-2 ring-foreground')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </fieldset>
              <Field label="Target date">
                {(p) => <Input {...p} type="date" className="w-auto" {...form.register('targetDate')} />}
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create project</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
