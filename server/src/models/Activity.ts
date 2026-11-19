import { Schema, model, type InferSchemaType } from 'mongoose';

const activitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verb: { type: String, required: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team' },
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    issue: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
    /** Snapshot so the feed still reads well after an issue is renamed or deleted. */
    issueSnapshot: { identifier: String, title: String },
    changes: {
      type: [{ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed, _id: false }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ project: 1, createdAt: -1, _id: -1 });
activitySchema.index({ issue: 1, createdAt: -1 });
activitySchema.index({ team: 1, createdAt: -1, _id: -1 });

export type Activity = InferSchemaType<typeof activitySchema>;
export const ActivityModel = model('Activity', activitySchema);
