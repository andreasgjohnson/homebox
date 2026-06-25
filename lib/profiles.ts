import { supabase } from '@/lib/supabase';

export type Profile = {
  avatar_url: string | null;
  id: string;
  created_at: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

const profileColumns = 'id,created_at,display_name,first_name,last_name,avatar_url';
const legacyProfileColumns = 'id,created_at,display_name,first_name,last_name';

export async function getProfile(userId: string) {
  const result = await supabase.from('profiles').select(profileColumns).eq('id', userId).single();

  if (!isMissingAvatarColumnError(result.error)) {
    return result;
  }

  const fallback = await supabase.from('profiles').select(legacyProfileColumns).eq('id', userId).single();

  if (fallback.data) {
    return {
      ...fallback,
      data: {
        ...fallback.data,
        avatar_url: null,
      },
    };
  }

  return {
    ...fallback,
    data: null,
  };
}

export async function updateProfileName(
  userId: string,
  firstName: string,
  lastName: string,
  avatarUrl?: string | null,
) {
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();
  const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ') || null;
  const profileUpdate: {
    avatar_url?: string | null;
    display_name: string | null;
    first_name: string | null;
    id: string;
    last_name: string | null;
  } = {
    id: userId,
    display_name: displayName,
    first_name: cleanFirstName || null,
    last_name: cleanLastName || null,
  };

  if (avatarUrl !== undefined) {
    profileUpdate.avatar_url = avatarUrl;
  }

  const result = await supabase
    .from('profiles')
    .upsert(profileUpdate, { onConflict: 'id' })
    .select(profileColumns)
    .single();

  if (!isMissingAvatarColumnError(result.error) || avatarUrl !== undefined) {
    return result;
  }

  const fallback = await supabase
    .from('profiles')
    .upsert(profileUpdate, { onConflict: 'id' })
    .select(legacyProfileColumns)
    .single();

  if (fallback.data) {
    return {
      ...fallback,
      data: {
        ...fallback.data,
        avatar_url: null,
      },
    };
  }

  return {
    ...fallback,
    data: null,
  };
}

export function getProfileDisplayName(profile: Pick<Profile, 'display_name' | 'first_name' | 'last_name'> | null) {
  if (!profile) {
    return null;
  }

  const firstName = profile.first_name?.trim();

  if (firstName) {
    return firstName.split(' ')[0] || firstName;
  }

  const displayName = profile.display_name?.trim();

  if (displayName) {
    return displayName.split(' ')[0] || displayName;
  }

  return profile.last_name?.trim() || null;
}

function isMissingAvatarColumnError(error: { message?: string } | null) {
  return Boolean(error?.message?.toLowerCase().includes('avatar_url'));
}
