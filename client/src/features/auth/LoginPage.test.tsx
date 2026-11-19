import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('LoginPage', () => {
  it('shows accessible field errors from the shared Zod schema without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    const emailInput = screen.getByLabelText('Email');
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    // Error text is wired to the input for screen readers.
    expect(emailInput.getAttribute('aria-describedby')).toContain(screen.getByText('Enter a valid email').id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces server errors in an alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid email or password', code: 'unauthorized' } }), { status: 401 }),
    );
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'demo@sprintly.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
