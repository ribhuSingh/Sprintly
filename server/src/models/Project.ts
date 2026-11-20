import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const labelSchema = new Schema({
  name: { type: String, required: true, trim: true },
  color: { type: String, required: true },
});

const projectSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#475569' },
    labels: { type: [labelSchema], default: [] },
    startDate: { type: Date, default: null },
    targetDate: { type: Date, default: null },
    /** Monotonic counter used to allocate issue numbers atomically ($inc). */
    issueCounter: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

projectSchema.index({ team: 1, key: 1 }, { unique: true });

export type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDoc = HydratedDocument<Project>;
export const ProjectModel = model('Project', projectSchema);
