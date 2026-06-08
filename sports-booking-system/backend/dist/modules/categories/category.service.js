import { categoryRepository } from "./category.repository.js";
export const categoryService = {
    list() {
        return categoryRepository.list(false);
    }
};
