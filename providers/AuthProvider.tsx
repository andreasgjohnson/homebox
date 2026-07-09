import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { completeInitialAuthRedirect, subscribeToAuthRedirects } from '@/lib/authRedirect';
import { supabase, supabaseConfigError } from '@/lib/supabase';

type AuthContextValue = {
  configError: string | null;
  isLoading: boolean;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (supabaseConfigError) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const unsubscribeFromAuthRedirects = subscribeToAuthRedirects((error) => {
      console.warn('Could not complete auth redirect.', error);
    });

    void completeInitialAuthRedirect()
      .catch((error) => {
        console.warn('Could not complete initial auth redirect.', error);
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
      }
    });

    return () => {
      isMounted = false;
      unsubscribeFromAuthRedirects();
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ configError: supabaseConfigError, isLoading, session }),
    [isLoading, session],
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
