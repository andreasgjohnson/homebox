import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  created_at: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

const profileColumns = 'id,created_at,display_name,first_name,last_name';

export async function getProfile(userId: string) {
  return supabase.from('profiles').select(profileColumns).eq('id', userId).single();
}

export async function updateProfileName(userId: string, firstName: string, lastName: string) {
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();
  const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ') || null;

  return supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        display_name: displayName,
        first_name: cleanFirstName || null,
        last_name: cleanLastName || null,
      },
      { onConflict: 'id' },
    )
    .select(profileColumns)
    .single();
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
