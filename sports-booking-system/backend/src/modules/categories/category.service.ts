import { categoryRepository } from "./category.repository.js";

let categoriesCache: any[] | null = null;
let lastFetchTime = 0;

export const categoryService = {
  async list() {
    const now = Date.now();
    if (categoriesCache && now - lastFetchTime < 60000) {
      return categoriesCache;
    }
    const data = await categoryRepository.list(false);
    categoriesCache = data;
    lastFetchTime = now;
    return data;
  },

  clearCache() {
    categoriesCache = null;
  }
};
