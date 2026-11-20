/**
 * Seeds a demo workspace: a small Bengaluru product team ("Kirana Labs") with 7 people, 3 projects,
 * ~100 issues spread over the last 10 weeks, plus comments, activity and notifications.
 * Re-running replaces only the demo data (users @sprintly.dev and their team), never anything else.
 *
 *   npm run seed
 *   login: demo@sprintly.dev / password123
 */
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ORDER_STEP, PRIORITY_RANK, type IssueStatus } from '@sprintly/shared';
import { env } from './config/env';
import { connectDb, disconnectDb } from './db';
import {
  ActivityModel,
  CommentModel,
  IssueModel,
  NotificationModel,
  ProjectModel,
  TeamModel,
  UserModel,
} from './models';

const DAY = 864e5;
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // deterministic
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const shuffle = <T,>(arr: readonly T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const TEAM_NAME = 'Kirana Labs';
/** Team names used by earlier versions of this script, so re-seeding cleans them up too. */
const LEGACY_TEAM_NAMES = ['Sprintly Demo'];

const PEOPLE = [
  { name: 'Ananya Iyer', email: 'demo@sprintly.dev', title: 'Engineering Lead', avatarColor: '#c2410c' },
  { name: 'Kabir Mehta', email: 'kabir@sprintly.dev', title: 'Frontend Engineer', avatarColor: '#1d4ed8' },
  { name: 'Sneha Reddy', email: 'sneha@sprintly.dev', title: 'Backend Engineer', avatarColor: '#0f766e' },
  { name: 'Arjun Nair', email: 'arjun@sprintly.dev', title: 'Mobile Engineer', avatarColor: '#a16207' },
  { name: 'Priya Sharma', email: 'priya@sprintly.dev', title: 'Product Designer', avatarColor: '#be123c' },
  { name: 'Rohan Verma', email: 'rohan@sprintly.dev', title: 'QA Engineer', avatarColor: '#4d7c0f' },
  { name: 'Meera Joshi', email: 'meera@sprintly.dev', title: 'Product Manager', avatarColor: '#475569' },
];
const ROLES = ['owner', 'admin', 'member', 'member', 'member', 'member', 'viewer'] as const;

/** Hand-written titles so the board reads like a real team's backlog, not a word generator. */
const PROJECTS = [
  {
    name: 'Storefront Web',
    key: 'WEB',
    color: '#1d4ed8',
    description: 'Customer-facing ordering site: catalogue, cart and checkout.',
    titles: [
      'Pincode lookup should autofill city and state',
      'Tamil and Kannada strings overflow on checkout summary',
      'Cart badge count lags behind after removing an item',
      'Show delivery slot picker before payment step',
      'Product images load full-size on 3G, add responsive srcset',
      'Search ignores Hindi transliteration ("doodh" should match milk)',
      'Add "Save for later" to cart line items',
      'Address form rejects flat numbers with slashes (e.g. 4/12B)',
      'Dark mode: strike-through price invisible on discount cards',
      'Coupon field accepts expired DIWALI25 code',
      'Lighthouse performance dropped to 61 on category pages',
      'Breadcrumbs break when category name has an ampersand',
      'Order history pagination resets on back navigation',
      'Single-page checkout for returning customers',
      'Locale switcher loses cart on full page reload',
      'Show prices with Indian digit grouping (₹1,25,000)',
      'Recently viewed strip shows out-of-stock items',
      'Empty state for wishlist',
      'Skip-to-content link hidden behind sticky header',
      'Keyboard focus lost after closing quick-view modal',
      'Hydration mismatch warning on product detail page',
      'Store selector should default to nearest dark store',
      'Replace hand-rolled date picker with an accessible one',
      'Footer links point to old /help URLs',
      'Add Marathi to supported languages',
      'Reorder button on past orders',
      'Mobile nav drawer does not trap focus',
      'Cache category tree for 10 minutes',
      'Price filter slider jumps when typing exact values',
      'Track add-to-cart events with variant id',
      'Out-of-stock toast appears twice on slow networks',
      'Unify button styles across checkout and account pages',
      'Delivery ETA shows UTC instead of IST',
      'Remove unused moment.js from the bundle',
      'Failed payment page needs a retry action',
      'Upgrade React Router and drop legacy history shim',
      'GSTIN field for business customers at checkout',
      'Festive banner carousel autoplays without a pause control',
      'OTP login: resend timer resets on tab switch',
      'Product compare table not scrollable on small screens',
      'Flaky Playwright test: checkout happy path',
      'Runbook for rolling back a bad frontend deploy',
    ],
  },
  {
    name: 'Payments',
    key: 'PAY',
    color: '#c2410c',
    description: 'UPI, cards and wallet integrations, refunds and settlements.',
    titles: [
      'UPI collect request times out on some Jio networks',
      'GST invoice PDF missing HSN code column',
      'Retry settlement webhook with exponential backoff',
      'Support UPI Autopay mandates for subscriptions',
      'Refund status stuck at "initiated" for wallet payments',
      'Reconcile daily settlement report with ledger',
      'Idempotency key not enforced on /payments/capture',
      'Move card storage to network tokens per RBI guidelines',
      'Payment method breakdown on finance dashboard',
      'Duplicate charge when user double-taps Pay on Android',
      'Log PSP response codes for failed UPI intents',
      'Rotate gateway API keys and move them to the vault',
      'Make COD order limit per pincode configurable by ops',
      'Partial refunds should split across original tenders',
      'Alert when success rate drops below 92% for 10 minutes',
      'Ledger entries rounding paise incorrectly',
      'Webhook signature check fails after key rotation',
      'Generate credit notes for cancelled B2B orders',
      'Partition the payment_events table by month',
      'Expire UPI intent after 5 minutes and release inventory',
      'UPI QR code on desktop checkout',
      'Document refund SLA for the support team',
      'Load test checkout at 3x Diwali peak',
      'TDS deduction line for marketplace sellers',
      'EMI options not shown for some debit cards',
      'Remove deprecated v1 payments endpoints',
      'Audit log for manual refund approvals',
      'Mask VPA in support dashboard',
      'Nightly job to expire stale payment links',
      'Settlement CSV export breaks on seller names with commas',
      'Store PSP fees per transaction for margin reporting',
      'Show bank downtime banner from PSP status API',
    ],
  },
  {
    name: 'Partner App',
    key: 'MOB',
    color: '#0f766e',
    description: 'Android app for store partners and delivery riders. v1 launch.',
    titles: [
      'Rider app drains battery with background location',
      'Offline mode: queue order status updates and sync later',
      'New-order push not received on some Xiaomi devices',
      'Hindi and Telugu translations for rider screens',
      'Barcode scanner fails under low light in stores',
      'Daily earnings summary on rider home',
      'Crash on Android 9 when opening order photo',
      'Large-text accessibility setting breaks order card layout',
      'Store partner can mark items unavailable mid-order',
      'Hand-off to Maps loses the drop pin',
      'APK above 40 MB, split by ABI',
      'Rider KYC upload: compress ID and licence photos',
      'Shift check-in should require being within 200 m of store',
      'Play Store listing screenshots and copy',
      'Crashlytics: NPE in OrderAdapter.bind',
      'Show customer instructions ("ring bell twice") prominently',
      'Slow cold start on 2 GB RAM devices',
      'Sign-out should clear cached order data',
      'In-app support chat entry point',
      'Retry failed photo uploads on reconnect',
      'Beta rollout to 3 Bengaluru stores',
      'Rider rating breakdown screen',
      'Decide min SDK version for launch',
      'Order timer keeps running after delivery is confirmed',
      'Release checklist for v1.0',
    ],
  },
];

const LABELS = [
  { name: 'Bug', color: '#dc2626' },
  { name: 'Feature', color: '#1d4ed8' },
  { name: 'Improvement', color: '#0f766e' },
  { name: 'Design', color: '#be123c' },
  { name: 'Tech debt', color: '#475569' },
];

const DESCRIPTIONS = [
  'Reported by support, three tickets this week.\n\n**Steps**\n1. Open the page on a mid-range Android phone\n2. Repeat the action twice quickly\n\n**Expected:** single result\n**Actual:** inconsistent state until refresh',
  'Context in the Thursday planning notes.\n\n- [ ] Agree on approach with design\n- [ ] Implement behind a flag\n- [ ] QA on staging\n- [ ] Roll out to 10%, then 100%',
  'Small change, and ops has been asking for it since the last festive sale.\n\nDone when it works for new and returning users and an e2e test covers it.',
  'Seen in Sentry, roughly 40 events a day. Not blocking users but noisy.\n\nFix the root cause rather than catching the error.',
  'Follow-up from the incident review. Keep the change small and well tested; this path handles money.',
];

const COMMENTS = [
  'I can pick this up once I close out my current sprint work.',
  'Reproduced on staging with a Redmi Note 10. Happens roughly 1 in 5 tries.',
  'Should we split this into a frontend and a backend task?',
  'Draft PR is up. Would appreciate an early look before I write tests.',
  'Updated designs are in Figma, linked in the description.',
  'Ops says this is affecting a few stores in Whitefield, bumping priority.',
  'LGTM, merging once CI is green.',
  'Can we add a test for the empty-cart case?',
  'Verified on staging, closing.',
  'Checked with finance, they are fine with this going out next week.',
  'This overlaps with something started last sprint, let’s sync tomorrow.',
  'Can’t reproduce after yesterday’s deploy. Keeping it open for a day.',
  'Added logs, will check the numbers after tonight’s peak.',
  'Moving to next cycle, we ran out of time on this one.',
];

async function main() {
  await connectDb(env.MONGODB_URI);

  // ---- Remove previous demo data only ----
  const oldUsers = await UserModel.find({ email: /@sprintly\.dev$/ }, { _id: 1 }).lean();
  const oldTeams = await TeamModel.find({ name: { $in: [TEAM_NAME, ...LEGACY_TEAM_NAMES] } }, { _id: 1 }).lean();
  const oldProjects = await ProjectModel.find({ team: { $in: oldTeams.map((t) => t._id) } }, { _id: 1 }).lean();
  const pIds = oldProjects.map((p) => p._id);
  await Promise.all([
    IssueModel.deleteMany({ project: { $in: pIds } }),
    CommentModel.deleteMany({ project: { $in: pIds } }),
    ActivityModel.deleteMany({ project: { $in: pIds } }),
    NotificationModel.deleteMany({ user: { $in: oldUsers.map((u) => u._id) } }),
    ProjectModel.deleteMany({ _id: { $in: pIds } }),
    TeamModel.deleteMany({ _id: { $in: oldTeams.map((t) => t._id) } }),
    UserModel.deleteMany({ _id: { $in: oldUsers.map((u) => u._id) } }),
  ]);

  // ---- Users & team ----
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = await UserModel.insertMany(PEOPLE.map((p) => ({ ...p, passwordHash })));
  const team = await TeamModel.create({
    name: TEAM_NAME,
    description: 'Quick commerce for neighbourhood stores, Bengaluru',
    members: users.map((u, i) => ({ user: u._id, role: ROLES[i], joinedAt: new Date(Date.now() - (80 - i * 6) * DAY) })),
  });
  const contributors = users.slice(0, 6); // everyone except the viewer

  const now = Date.now();
  const activityDocs: Record<string, unknown>[] = [];
  const commentDocs: Record<string, unknown>[] = [];
  const openIssues: { identifier: string; link: string }[] = [];

  for (const def of PROJECTS) {
    const n = def.titles.length;
    const titles = shuffle(def.titles);
    const labels = LABELS.map((l) => ({ _id: new Types.ObjectId(), ...l }));
    const project = await ProjectModel.create({
      team: team._id,
      name: def.name,
      key: def.key,
      color: def.color,
      description: def.description,
      labels,
      startDate: new Date(now - 70 * DAY),
      targetDate: new Date(now + (20 + Math.floor(rand() * 40)) * DAY),
      issueCounter: n,
      createdBy: users[0]!._id,
    });

    const orderByStatus: Record<IssueStatus, number> = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, done: 0 };
    const issues = titles.map((title, idx) => {
      const number = idx + 1;
      const createdAt = new Date(now - Math.floor(rand() * 70) * DAY - Math.floor(rand() * DAY));
      const age = (now - createdAt.getTime()) / DAY;
      // Older issues are more likely to be done, so the throughput chart looks realistic.
      const status: IssueStatus = chance(Math.min(0.85, age / 60)) ? 'done' : pick(ISSUE_STATUSES.slice(0, 4));
      const priority = pick(ISSUE_PRIORITIES);
      orderByStatus[status] += ORDER_STEP;
      const completedAt = status === 'done' ? new Date(createdAt.getTime() + rand() * Math.max(1, age - 1) * DAY) : null;
      const assignees = chance(0.85) ? [pick(contributors)._id] : [];
      if (chance(0.15)) assignees.push(pick(contributors)._id);
      const uniqueAssignees = [...new Map(assignees.map((a) => [a.toString(), a])).values()];
      const dueDate = chance(0.6) ? new Date(now + (Math.floor(rand() * 50) - 15) * DAY) : null;
      return {
        _id: new Types.ObjectId(),
        project: project._id,
        number,
        identifier: `${def.key}-${number}`,
        title,
        description: chance(0.6) ? pick(DESCRIPTIONS) : '',
        status,
        priority,
        priorityRank: PRIORITY_RANK[priority],
        statusRank: ISSUE_STATUSES.indexOf(status),
        order: orderByStatus[status],
        labels: chance(0.8) ? [pick(labels)._id] : [],
        assignees: uniqueAssignees,
        reporter: pick(users)._id,
        dueDate,
        estimate: chance(0.5) ? pick([1, 2, 3, 5, 8]) : null,
        completedAt,
        commentCount: 0,
        createdAt,
        updatedAt: completedAt ?? createdAt,
      };
    });

    for (const issue of issues) {
      const count = chance(0.35) ? 1 + Math.floor(rand() * 3) : 0;
      issue.commentCount = count;
      for (let c = 0; c < count; c++) {
        const createdAt = new Date(issue.createdAt.getTime() + (c + 1) * rand() * 2 * DAY);
        commentDocs.push({ issue: issue._id, project: project._id, author: pick(users)._id, body: pick(COMMENTS), createdAt, updatedAt: createdAt });
      }
      const snap = { identifier: issue.identifier, title: issue.title };
      activityDocs.push({ actor: issue.reporter, verb: 'issue.created', team: team._id, project: project._id, issue: issue._id, issueSnapshot: snap, changes: [], createdAt: issue.createdAt });
      if (issue.completedAt) {
        activityDocs.push({
          actor: issue.assignees[0] ?? issue.reporter,
          verb: 'issue.moved',
          team: team._id,
          project: project._id,
          issue: issue._id,
          issueSnapshot: snap,
          changes: [{ field: 'status', from: 'in_review', to: 'done' }],
          createdAt: issue.completedAt,
        });
      }
    }
    // Raw driver insert so our historical createdAt values aren't overwritten by Mongoose timestamps.
    await IssueModel.collection.insertMany(issues);
    for (const i of issues.filter((x) => x.status !== 'done').slice(0, 2)) {
      openIssues.push({ identifier: i.identifier, link: `/projects/${project._id}/issues/${i._id}` });
    }
    console.log(`[seed] ${def.name}: ${issues.length} issues`);
  }

  await CommentModel.collection.insertMany(commentDocs);
  await ActivityModel.collection.insertMany(activityDocs);

  // A few notifications for the demo user that point at real issues.
  const [a, b, c, d] = openIssues;
  const notes = [
    { actor: users[1]!, kind: 'commented', message: `commented on ${a!.identifier}: “Draft PR is up. Would appreciate an early look before I write tests.”`, link: a!.link },
    { actor: users[6]!, kind: 'assigned', message: `assigned you to ${c!.identifier}`, link: c!.link },
    { actor: users[5]!, kind: 'status_changed', message: `moved ${b!.identifier} to In review`, link: b!.link },
    { actor: users[2]!, kind: 'commented', message: `commented on ${d!.identifier}: “Added logs, will check the numbers after tonight’s peak.”`, link: d!.link },
  ];
  await NotificationModel.collection.insertMany(
    notes.map((n, i) => ({
      user: users[0]!._id,
      actor: n.actor._id,
      kind: n.kind,
      message: n.message,
      link: n.link,
      read: i > 1,
      createdAt: new Date(now - (i + 1) * 47 * 60 * 1000),
    })),
  );

  console.log(`[seed] ${commentDocs.length} comments, ${activityDocs.length} activity entries`);
  console.log('[seed] done. Log in with demo@sprintly.dev / password123');
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb();
  process.exit(1);
});
