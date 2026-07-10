import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { completeInitialAuthRedirect, subscribeToAuthRedirects } from '@/lib/authRedirect';
import { supabase, supabaseConfigError } from '@/lib/supabase';

const REDIRECT_ERROR_MESSAGE = 'That sign-in link did not work. Send yourself a fresh one.';

type AuthContextValue = {
  clearRedirectError: () => void;
  configError: string | null;
  isLoading: boolean;
  redirectError: string | null;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const clearRedirectError = useCallback(() => {
    setRedirectError(null);
  }, []);

  useEffect(() => {
    if (supabaseConfigError) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const unsubscribeFromAuthRedirects = subscribeToAuthRedirects((error) => {
      console.warn('Could not complete auth redirect.', error);
      if (isMounted) {
        setRedirectError(REDIRECT_ERROR_MESSAGE);
      }
    });

    void completeInitialAuthRedirect()
      .catch((error) => {
        console.warn('Could not complete initial auth redirect.', error);
        if (isMounted) {
          setRedirectError(REDIRECT_ERROR_MESSAGE);
        }
      })
      .finally(() => {
        void supabase.auth.getSession().then(({ data }) => {
          if (isMounted) {
            setSession(data.session);
            setIsLoading(false);
          }
        });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setIsLoading(false);
        if (nextSession) {
          setRedirectError(null);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFromAuthRedirects();
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      clearRedirectError,
      configError: supabaseConfigError,
      isLoading,
      redirectError,
      session,
    }),
    [clearRedirectError, isLoading, redirectError, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return value;
}
