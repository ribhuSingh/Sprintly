import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { loginSchema, type LoginInput } from '@sprintly/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { AuthShell } from './AuthShell';
import { useLogin } from './hooks';

export default function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => {
        const next = params.get('next');
        // Only follow same-origin relative paths (open-redirect guard).
        navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
      },
      onError: (err) => form.setError('root', { message: err.message }),
    }),
  );

  const fillDemo = () => {
    form.setValue('email', 'demo@sprintly.dev');
    form.setValue('password', 'password123');
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your Sprintly workspace"
      footer={
        <>
          New here?{' '}
          <Link className="font-medium text-primary hover:underline" to="/register">
            Create an account
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
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" autoFocus {...form.register('email')} />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" className="w-full" loading={login.isPending}>
          Log in
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={fillDemo}>
          Use demo account
        </Button>
      </form>
    </AuthShell>
  );
}
