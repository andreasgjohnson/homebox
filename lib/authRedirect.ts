import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const STOREYBOX_SCHEME = 'storeybox';
export const AUTH_CALLBACK_PATH = 'auth/callback';
export const NATIVE_AUTH_REDIRECT_URL = `${STOREYBOX_SCHEME}://${AUTH_CALLBACK_PATH}`;

type AuthRedirectErrorHandler = (error: unknown) => void;

export function getAuthRedirectUrl() {
  return Linking.createURL(AUTH_CALLBACK_PATH, { scheme: STOREYBOX_SCHEME });
}

export async function completeInitialAuthRedirect() {
  if (Platform.OS === 'web') {
    return false;
  }

  const initialUrl = await Linking.getInitialURL();

  if (!initialUrl) {
    return false;
  }

  return completeAuthSessionFromUrl(initialUrl);
}

export function subscribeToAuthRedirects(onError: AuthRedirectErrorHandler) {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const subscription = Linking.addEventListener('url', ({ url }) => {
    void completeAuthSessionFromUrl(url).catch(onError);
  });

  return () => subscription.remove();
}

async function completeAuthSessionFromUrl(url: string) {
  if (!isAuthCallbackUrl(url)) {
    return false;
  }

  const params = getAuthParams(url);

  if (!hasSupabaseAuthParams(params)) {
    return false;
  }

  const callbackError = params.get('error_description') ?? params.get('error');

  if (callbackError) {
    throw new Error(callbackError);
  }

  const code = params.get('code');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return true;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return false;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return true;
}

function hasSupabaseAuthParams(params: URLSearchParams) {
  return (
    params.has('code') ||
    (params.has('access_token') && params.has('refresh_token')) ||
    params.has('error') ||
    params.has('error_description')
  );
}

function getAuthParams(url: string) {
  const params = new URLSearchParams();
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');

  if (queryStart >= 0) {
    appendParams(params, url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined));
  }

  if (hashStart >= 0) {
    appendParams(params, url.slice(hashStart + 1));
  }

  return params;
}

function appendParams(params: URLSearchParams, rawParams: string) {
  new URLSearchParams(rawParams).forEach((value, key) => {
    params.set(key, value);
  });
}

function isAuthCallbackUrl(url: string) {
  const path = getUrlPath(url);

  return path === AUTH_CALLBACK_PATH;
}

function getUrlPath(url: string) {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(/:$/, '');
    const path = stripSlashes(parsed.pathname);

    if (protocol === STOREYBOX_SCHEME) {
      return [parsed.hostname, path].filter(Boolean).join('/');
    }

    return path.replace(/^--\//, '');
  } catch {
    return stripSlashes(url.split(/[?#]/)[0] ?? '');
  }
}

function stripSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}
