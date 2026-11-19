# Sprintly

A team collaboration and issue-tracking platform, a lightweight mix of Linear, Jira and Trello. You can manage projects and teams, drag issues across a Kanban board, filter large issue tables, and see your teammates' changes as they happen.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn-style Radix components · TanStack Query / Table / Virtual · React Hook Form + Zod · dnd-kit · Recharts · Socket.IO · Node + Express 5 · MongoDB (Mongoose)

## Quick start

```bash
npm install
cp server/.env.example server/.env   # then fill in MONGODB_URI and JWT_SECRET
npm run seed                         # demo workspace: 6 users, 3 projects, ~220 issues
npm run dev                          # API on :4000, web app on :5173
```

Open http://localhost:5173 and log in with **demo@sprintly.dev / password123**, or click "Use demo account". To try real-time updates, log in as `ava@sprintly.dev` (same password) in a second browser and open the same board.

| Script | What it does |
|---|---|
| `npm run dev` | Starts the API (tsx watch) and Vite together |
| `npm test` | Runs the server API tests (in-memory MongoDB) and the client unit tests |
| `npm run typecheck` | Typechecks all three packages |
| `npm run build` | Builds the server bundle and the client |

## Repository layout

```
shared/   Zod schemas, enums, DTO types, and the ordering algorithm. Used by both client and server.
server/   Express API, Mongoose models, Socket.IO, and the seed script
client/   React SPA, organised by feature (board, issues, dashboard, calendar…)
```

The client and server validate with **the same Zod schemas**, so their validation rules can't drift apart. For example, the client's create-issue form reuses `createIssueSchema.shape.title`.

## Features

| Module | What's there |
|---|---|
| Dashboard | KPI tiles, issues by status and priority, an 8-week created/completed throughput chart, workload per assignee, and upcoming deadlines. You can scope it to one project or show all of them. |
| Projects & teams | Create teams and projects. Each project gets an auto-suggested key (`WEB-12`), a colour, a target date and labels. |
| Kanban board | Drag and drop within and across columns using the mouse, touch or keyboard. Moves are optimistic. You can filter by text, assignee or priority, and see who else is viewing the board. |
| Issues | Data table with server-side sorting, filtering and pagination, column visibility, row selection, and bulk status/priority changes. Table state is kept in the URL. |
| Issue detail | Side sheet with optimistic inline edits (title, description, status, priority, assignees, labels, due date, estimate), comments, and history. |
| Search | Searches across all projects, with status/project filters, sorting and match highlighting. |
| Collaboration | Comments, an activity feed (infinite and virtualised), and a notification bell with live toasts. |
| Calendar | Month view of due dates and project milestones. Drag an issue to another day to reschedule it. |
| Settings | Profile, team details, member invites, role management, and a permission matrix. |
| Command palette | `Ctrl/⌘ K`: navigate, run actions, and search issues live. Press `?` to see every shortcut. |

## Engineering notes

### Server state: TanStack Query
- **Query key factory** (`client/src/lib/queryKeys.ts`). Keys are hierarchical, so invalidating `['projects', id, 'issues']` refreshes every page and filter of that table at once.
- **One cache-sync module** (`client/src/lib/issueCache.ts`). An issue lives in several caches: the board, the detail view and every table page. Optimistic updates, mutation responses and socket events all write to these caches through the same helpers, so the views never disagree.
- **Optimistic updates with rollback.** Moves, inline edits, comments, deletes, bulk edits, role changes and notification read-state all follow the same pattern: snapshot in `onMutate`, restore in `onError`, reconcile in `onSuccess`.
- **No snap-back during rapid drags.** `useMoveIssue` only refetches the board when the *last* in-flight move settles (`isMutating({ mutationKey }) === 1`). Without this, a refetch between quick drags would briefly snap cards back to stale positions.
- **Global error handling.** `MutationCache.onError` shows a toast for failed mutations unless the mutation sets `meta.silent`; forms set it so they can show the error inline instead. Retries skip 4xx errors.
- `keepPreviousData` keeps the table from flashing while you page or sort. `placeholderData` and `initialData` let the project header and issue sheet render instantly from data already in the cache.

### Kanban ordering
Each card stores a fractional `order` (`shared/src/ordering.ts`). A move sends `{ status, beforeId, afterId }`, and the server computes the midpoint of the two neighbours, so **only the moved card is written**. The client runs the same function for its optimistic update, so the card lands exactly where the server will put it. When two neighbours get too close together for floating-point precision, the server rebalances that column. If the client's view of the board is stale and a neighbour is no longer in the target column, the server returns 400 and the client rolls back.

### Real-time
- Socket.IO authenticates the handshake with the **same httpOnly JWT cookie** as the REST API. There is no separate token in JavaScript.
- Each project has a room (`project:<id>`) for issue, comment and activity events, and each user has a room (`user:<id>`) for notifications. Presence is the deduplicated list of users in a project's room.
- Every mutation carries a `clientMutationId`. The tab that made the change ignores its own echo, because its optimistic update already applied it.
- After a reconnect, the client refetches whatever is on screen, since it may have missed events.

### Security
- JWT is stored in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Login has a rate limiter, and the login error doesn't reveal whether an account exists.
- RBAC is enforced in one place (`server/src/services/access.ts`). Roles are `viewer < member < admin < owner`. Non-members get **404, not 403**, so the API doesn't reveal that a project exists. The UI hides actions you can't perform, but the server is the authority.
- Every request body and query string is parsed with Zod. Regex search input is escaped. `helmet` sets security headers. The login redirect only follows relative paths, to prevent open redirects.

### Performance
- **Code splitting:** every route is `lazy()`-loaded, and so are the dialogs (command palette, create issue/project) and Recharts. Vendors are split into cacheable chunks (`react`, `query`, `table`, `dnd`, `charts`).
- **Virtualisation:** the activity feed uses `@tanstack/react-virtual` with measured row heights and keyset-cursor infinite loading.
- `React.memo` on Kanban cards and columns. Columns render from a local drag copy only while a drag is in progress, and switch back to the cache once the optimistic update has landed, so there is no flicker.
- Mongo has compound indexes for the main queries (`{project, status, order}`, `{user, read}`…). The analytics endpoint uses a single `$facet` aggregation.

### UX and accessibility
- Skeleton loaders on every async view. Empty states have a call to action. Error boundaries exist at the router level, the layout level (reset on navigation) and per query, with retry. A failed chunk load after a deploy shows a "new version available" message.
- Dialogs and sheets use Radix, which provides the focus trap, Esc to close and focus restore. The command palette and pickers use cmdk's combobox pattern.
- **Keyboard drag and drop:** focus a card, press `Space` to pick it up, use the arrow keys to move it, and `Space` again to drop it. Screen readers hear custom announcements such as *"WEB-12 is over In Review, position 2 of 5"*.
- The `Field` form component wires each label, hint and error to its input via `id`, `aria-describedby` and `aria-invalid`.
- Also: a skip-to-content link, `aria-sort` on table headers, a visible focus ring, `prefers-reduced-motion` support, and dark mode applied before first paint.
- The charts use a categorical palette that has been checked for colour-blind safety in both light and dark mode. Every chart has a table view, which screen readers always receive.

## Keyboard shortcuts

| Keys | Action | | Keys | Action |
|---|---|---|---|---|
| `Ctrl/⌘ K` | Command palette | | `G D` | Dashboard |
| `C` | New issue | | `G P` | Projects |
| `/` | Search | | `G B` / `G L` | Project board / list |
| `T` | Toggle theme | | `G C` | Calendar |
| `?` | All shortcuts | | `G A` / `G S` | Activity / Settings |

## Tests

- **Server** (`server/test/api.test.ts`, Vitest + supertest + mongodb-memory-server): auth flows, validation errors, sequential issue numbers, fractional moves, rejection of stale moves, filtering/sorting/pagination, activity logging, RBAC, and notifications.
- **Client** (Vitest + Testing Library): the board's drag/drop helpers, optimistic move and rollback in `useMoveIssue`, and accessible form validation on the login page.
