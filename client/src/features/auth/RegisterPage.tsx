import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { registerSchema, type RegisterInput } from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';
import { useRegister } from './hooks';

export default function RegisterPage() {
  const register = useRegister();
  const navigate = useNavigate();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    register.mutate(values, {
      onSuccess: () => navigate('/settings/teams?welcome=1', { replace: true }),
      onError: (err) => {
        // Map server-side field errors back onto the form.
        if (err instanceof ApiError && err.status === 409) form.setError('email', { message: err.message });
        else form.setError('root', { message: err.message });
      },
    }),
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start organising your team’s work in minutes"
      footer={
        <>
          Already have an account?{' '}
          <Link className="font-medium text-primary hover:underline" to="/login">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errors.root && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <Field label="Full name" error={errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" autoFocus {...form.register('name')} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 8 characters">
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" className="w-full" loading={register.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
