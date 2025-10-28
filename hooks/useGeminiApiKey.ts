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

type StorageStatus = 'unknown' | 'available' | 'unavailable';

export const useGeminiApiKey = () => {
  const [apiKey, setApiKeyState] = useState('');
  const [isUsingFallbackKey, setIsUsingFallbackKey] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('unknown');

  useEffect(() => {
    const fallback = readFallbackKey().trim();

    if (typeof window === 'undefined') {
      if (fallback) {
        setApiKeyState(fallback);
        setIsUsingFallbackKey(true);
      }
      return;
    }

    try {
      const storedKey = window.localStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        setApiKeyState(storedKey);
        setIsUsingFallbackKey(false);
        setStorageStatus('available');
        return;
      }

      setStorageStatus('available');
    } catch (error) {
      console.warn('Unable to access localStorage for the Gemini API key.', error);
      setStorageStatus('unavailable');
      if (fallback) {
        setApiKeyState(fallback);
        setIsUsingFallbackKey(true);
      }
      return;
    }

    if (fallback) {
      setApiKeyState(fallback);
      setIsUsingFallbackKey(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, fallback);
      } catch (error) {
        console.warn('Unable to persist the fallback Gemini API key to localStorage.', error);
        setStorageStatus('unavailable');
      }
    }
  }, []);

  const persistKey = useCallback((value: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const trimmed = value.trim();
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setStorageStatus('available');
    } catch (error) {
      console.warn('Unable to persist the Gemini API key to localStorage.', error);
      setStorageStatus('unavailable');
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
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setStorageStatus('available');
    } catch (error) {
      console.warn('Unable to clear the Gemini API key from localStorage.', error);
      setStorageStatus('unavailable');
    }
  }, []);

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    isUsingFallbackKey,
    storageStatus,
  } as const;
};

