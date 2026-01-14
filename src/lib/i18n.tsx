import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "pl" | "uk" | "en";

interface Translations {
  [key: string]: any;
}

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Завантаження перекладів
const loadTranslations = async (lang: Language): Promise<Translations> => {
  try {
    const translations = await import(`../locales/${lang}.json`);
    return translations.default;
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    // Fallback to English
    const fallback = await import(`../locales/en.json`);
    return fallback.default;
  }
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Зчитуємо збережену мову з localStorage або використовуємо польську за замовчуванням
    const saved = localStorage.getItem("app_language") as Language;
    return saved && ["pl", "uk", "en"].includes(saved) ? saved : "pl";
  });
  
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    loadTranslations(language).then(setTranslations);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
    loadTranslations(lang).then(setTranslations);
  };

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations;
    
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Повертаємо ключ, якщо переклад не знайдено
      }
    }
    
    return typeof value === "string" ? value : key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

