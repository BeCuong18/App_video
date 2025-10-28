import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'geminiApiKey';

const readFallbackKey = () => {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY
      ? String(import.meta.env.VITE_GEMINI_API_KEY)
      : undefined;

  const processKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.API_KEY : undefined;

  return envKey || processKey || '';
};

export const useGeminiApiKey = () => {
  const [apiKey, setApiKeyState] = useState('');
  const [isUsingFallbackKey, setIsUsingFallbackKey] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedKey = window.localStorage.getItem(STORAGE_KEY);
    if (storedKey) {
      setApiKeyState(storedKey);
      setIsUsingFallbackKey(false);
      return;
    }

    const fallback = readFallbackKey().trim();
    if (fallback) {
      setApiKeyState(fallback);
      setIsUsingFallbackKey(true);
      window.localStorage.setItem(STORAGE_KEY, fallback);
    }
  }, []);

  const persistKey = useCallback((value: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const trimmed = value.trim();
    if (trimmed) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setApiKey = useCallback(
    (value: string) => {
      setIsUsingFallbackKey(false);
      setApiKeyState(value);
      persistKey(value);
    },
    [persistKey]
  );

  const clearApiKey = useCallback(() => {
    setApiKeyState('');
    setIsUsingFallbackKey(false);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    isUsingFallbackKey,
  } as const;
};

