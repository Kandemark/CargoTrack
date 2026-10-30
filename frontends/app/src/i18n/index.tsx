import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { prefs } from '@/storage';
import { en, sw, type StringKey } from './strings';

export type Language = 'en' | 'sw';

const dictionaries: Record<Language, Record<StringKey, string>> = { en, sw };

/** The phone's language if we speak it, otherwise English. */
function deviceLanguage(): Language {
  return getLocales().some((l) => l.languageCode === 'sw') ? 'sw' : 'en';
}

type I18n = {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ initial, children }: { initial: Language | null; children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initial ?? deviceLanguage());

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l);
    void prefs.set('language', l);
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = dictionaries[language];
    return {
      language,
      setLanguage,
      t: (key, vars) =>
        dict[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`)),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
