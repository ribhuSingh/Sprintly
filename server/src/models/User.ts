import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const AVATAR_COLORS = ['#c2410c', '#0f766e', '#1d4ed8', '#a16207', '#be123c', '#4d7c0f', '#475569', '#7e22ce'];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    title: { type: String, default: '' },
    avatarColor: {
      type: String,
      default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

/** Fields safe to expose when populating user refs. */
export const PUBLIC_USER_FIELDS = 'name email avatarColor title';
