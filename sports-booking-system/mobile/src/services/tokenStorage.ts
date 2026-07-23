const memoryStorage = new Map<string, string>();

export const tokenStorage = {
  async getItem(key: string) {
    if (typeof localStorage === "undefined") return memoryStorage.get(key) ?? null;
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage === "undefined") {
      memoryStorage.set(key, value);
      return;
    }
    localStorage.setItem(key, value);
  },
  async deleteItem(key: string) {
    if (typeof localStorage === "undefined") {
      memoryStorage.delete(key);
      return;
    }
    localStorage.removeItem(key);
  }
};

