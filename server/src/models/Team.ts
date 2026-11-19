import { Schema, Types, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { TEAM_ROLES } from '@sprintly/shared';

const memberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: TEAM_ROLES, required: true, default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

teamSchema.index({ 'members.user': 1 });

export type Team = InferSchemaType<typeof teamSchema>;
export type TeamDoc = HydratedDocument<Team>;
export const TeamModel = model('Team', teamSchema);

export function roleIn(team: { members: { user: Types.ObjectId | { _id: Types.ObjectId }; role: string }[] }, userId: string) {
  const m = team.members.find((m) => {
    const id = m.user instanceof Types.ObjectId ? m.user : m.user._id;
    return id.toString() === userId;
  });
  return m?.role as (typeof TEAM_ROLES)[number] | undefined;
}
