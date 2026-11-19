import mongoose from 'mongoose';

export async function connectDb(uri: string, dbName = process.env.MONGODB_DB ?? 'sprintly') {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, dbName });
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
