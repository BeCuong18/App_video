import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'geminiApiKey';

type StorageStatus = 'unknown' | 'available' | 'unavailable';

export const useGeminiApiKey = () => {
  const [apiKey, setApiKeyState] = useState('');
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('unknown');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const storedKey = window.localStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        setApiKeyState(storedKey);
      }
      setStorageStatus('available');
    } catch (error) {
      console.warn('Unable to access localStorage for the Gemini API key.', error);
      setStorageStatus('unavailable');
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
      setApiKeyState(value);
      persistKey(value);
    },
    [persistKey]
  );

  const clearApiKey = useCallback(() => {
    setApiKeyState('');
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
    storageStatus,
  } as const;
};
