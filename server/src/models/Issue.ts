import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, PRIORITY_RANK } from '@sprintly/shared';

const issueSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    number: { type: Number, required: true },
    identifier: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ISSUE_STATUSES, default: 'todo', required: true },
    priority: { type: String, enum: ISSUE_PRIORITIES, default: 'none', required: true },
    /** Denormalised numeric ranks so the list view can sort server-side. */
    priorityRank: { type: Number, default: 0 },
    statusRank: { type: Number, default: 0 },
    /** Fractional position within its status column (see shared/ordering.ts). */
    order: { type: Number, required: true },
    labels: { type: [Schema.Types.ObjectId], default: [] },
    assignees: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    estimate: { type: Number, default: null },
    completedAt: { type: Date, default: null },
    commentCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

issueSchema.index({ project: 1, status: 1, order: 1 });
issueSchema.index({ project: 1, number: 1 }, { unique: true });
issueSchema.index({ assignees: 1, status: 1 });
issueSchema.index({ dueDate: 1 });

issueSchema.pre('validate', function () {
  this.priorityRank = PRIORITY_RANK[this.priority];
  this.statusRank = ISSUE_STATUSES.indexOf(this.status);
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? (this.completedAt ?? new Date()) : null;
  }
});

export type Issue = InferSchemaType<typeof issueSchema>;
export type IssueDoc = HydratedDocument<Issue>;
export const IssueModel = model('Issue', issueSchema);
