import { create } from "zustand";
import { vi } from "./vi";
import { en } from "./en";

export type Language = "vi" | "en";

type LanguageState = {
  language: Language;
  t: typeof vi;
  setLanguage: (lang: Language) => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "vi",
  t: vi,
  setLanguage: (language) => set({ language, t: language === "en" ? en : vi })
}));

export const getTranslation = () => useLanguageStore.getState().t;
