import { createDailyPost } from './fold';

export const createPost = async () => {
  const r = await createDailyPost();
  return { id: r.id };
};
