import * as SecureStore from "expo-secure-store";

const memoryStorage = new Map<string, string>();

export const tokenStorage = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  async deleteItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryStorage.delete(key);
    }
  }
};

