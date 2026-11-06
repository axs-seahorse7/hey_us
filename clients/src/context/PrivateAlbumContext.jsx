import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../Authentication/Context/AuthContext';
import {
  getPrivateAlbumStatus,
  setupPrivateAlbum,
  unlockPrivateAlbum,
} from '../services/privateAlbum.service';

const PrivateAlbumContext = createContext(null);

export function PrivateAlbumProvider({ children }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // GalleryLayout uses user?.user?._id, so support that shape too.
  const userId = user?.user?._id || user?._id || null;

  const [privateToken, setPrivateToken] = useState(null);
  const [status, setStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const clearSession = useCallback(() => {
    setPrivateToken(null);
  }, []);

  useEffect(() => {
    clearSession();
    setStatus(null);
  }, [userId, isAuthenticated, clearSession]);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setStatus(null);
      return null;
    }

    setIsCheckingStatus(true);

    try {
      const result = await getPrivateAlbumStatus();
      setStatus(result);
      return result;
    } finally {
      setIsCheckingStatus(false);
    }
  }, [isAuthenticated, userId]);

  const setup = useCallback(async (credentialType, credential) => {
    await setupPrivateAlbum({ credentialType, credential });
    return refreshStatus();
  }, [refreshStatus]);

  const unlock = useCallback(async (credential) => {
    const result = await unlockPrivateAlbum({ credential });

    if (!result?.privateToken) {
        throw new Error('The server did not return a Private Album token.');
    }

    setPrivateToken(result.privateToken);
    return result;
    }, []);

  const lock = useCallback(() => {
    setPrivateToken(null);
  }, []);

  const value = useMemo(() => ({
    privateToken,
    isUnlocked: Boolean(privateToken),
    status,
    isCheckingStatus,
    refreshStatus,
    setup,
    unlock,
    lock,
  }), [
    privateToken,
    status,
    isCheckingStatus,
    refreshStatus,
    setup,
    unlock,
    lock,
  ]);

  if (authLoading) return null;

  return (
    <PrivateAlbumContext.Provider value={value}>
      {children}
    </PrivateAlbumContext.Provider>
  );
}

export function usePrivateAlbum() {
  const context = useContext(PrivateAlbumContext);

  if (!context) {
    throw new Error(
      'usePrivateAlbum must be used inside PrivateAlbumProvider',
    );
  }

  return context;
}