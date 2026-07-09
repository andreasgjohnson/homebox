import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BoxIllustration } from '@/components/BoxHardware';
import { StoreyboxWordmark } from '@/components/DaybookChrome';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

const locations = ['Bedside', 'Desk', 'Kitchen', 'Living room'];

type ClaimResponse = {
  box: {
    id: string;
    name: string;
    location: string | null;
  };
};

export default function PairBoxScreen() {
  const router = useRouter();
  const [pairingCode, setPairingCode] = useState('');
  const [boxName, setBoxName] = useState('');
  const [location, setLocation] = useState('Bedside');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanCode = pairingCode.replace(/\D/g, '');
  const canSubmit = cleanCode.length === 6 && !isSubmitting;

  async function claimBox() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { data, error } = await supabase.functions.invoke<ClaimResponse>('box-api/v1/pairings/claim', {
      body: {
        pairing_code: cleanCode,
        box_name: boxName.trim() || `${location} Box`,
        location,
      },
    });

    if (error || !data?.box) {
      setErrorMessage(await readClaimErrorMessage(error));
      setIsSubmitting(false);
      return;
    }

    router.replace('/your-box' as Href);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/your-box' as Href)} style={styles.backLink}>
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backText}>Your Box</Text>
          </Pressable>
          <StoreyboxWordmark />
          <Text style={styles.privateLabel}>PRIVATE</Text>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.boxStage}>
            <View style={styles.glow} />
            <BoxIllustration size={104} ledColor="#5B7895" />
          </View>

          <Text style={styles.title}>Pair your Box.</Text>
          <Text style={styles.body}>
            Your Box shows a six-digit code when it is ready to pair. Enter it here to bring the
            Box into your archive.
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PAIRING CODE</Text>
            <TextInput
              autoFocus
              editable={!isSubmitting}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setPairingCode}
              placeholder="000000"
              placeholderTextColor={colors.faint}
              style={styles.codeInput}
              value={pairingCode}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NAME YOUR BOX</Text>
            <TextInput
              autoCapitalize="words"
              editable={!isSubmitting}
              onChangeText={setBoxName}
              placeholder={`${location} Box`}
              placeholderTextColor={colors.faint}
              returnKeyType="done"
              style={styles.nameInput}
              value={boxName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>WHERE DOES IT LIVE?</Text>
            <View style={styles.locationWrap}>
              {locations.map((item) => {
                const isSelected = location === item;

                return (
                  <Pressable
                    disabled={isSubmitting}
                    key={item}
                    onPress={() => setLocation(item)}
                    style={[styles.locationChip, isSelected && styles.locationChipSelected]}
                  >
                    <Text style={[styles.locationText, isSelected && styles.locationTextSelected]}>
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={!canSubmit}
            onPress={() => void claimBox()}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Pair this Box</Text>
            )}
          </Pressable>
          <Text style={styles.helper}>Codes expire after a few minutes. Your Box can always show a fresh one.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function readClaimErrorMessage(error: unknown) {
  const context = isRecord(error) ? error.context : null;

  if (typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = await context.clone().json();

      if (isRecord(body) && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Fall back to the client error message below.
    }
  }

  return error instanceof Error ? error.message : 'Pairing did not complete. Try a fresh code.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  backLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minWidth: 86,
  },
  backChevron: {
    color: '#5A6470',
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 16,
  },
  backText: {
    color: '#5A6470',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  privateLabel: {
    color: '#A6A092',
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    minWidth: 86,
    textAlign: 'right',
  },
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 440,
    paddingBottom: 60,
    paddingHorizontal: 28,
    width: '100%',
  },
  boxStage: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
    marginTop: 30,
    position: 'relative',
    width: 168,
  },
  glow: {
    backgroundColor: '#BCD2E6',
    borderRadius: 84,
    height: 168,
    opacity: 0.28,
    position: 'absolute',
    width: 168,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 38,
    marginTop: 18,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center',
  },
  field: {
    alignSelf: 'stretch',
    marginTop: 28,
  },
  fieldLabel: {
    color: '#8A939E',
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1.8,
    lineHeight: 10,
    marginBottom: 12,
  },
  codeInput: {
    borderBottomColor: colors.blueLine,
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.mono,
    fontSize: 30,
    letterSpacing: 10,
    paddingBottom: 10,
    textAlign: 'center',
  },
  nameInput: {
    borderBottomColor: '#CDD9E5',
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.serif,
    fontSize: 19,
    fontWeight: '400',
    paddingBottom: 10,
  },
  locationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    backgroundColor: colors.surfaceWarm,
    borderColor: '#DDE4EA',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  locationChipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  locationText: {
    color: '#4A5568',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  locationTextSelected: {
    color: colors.background,
  },
  notice: {
    alignSelf: 'stretch',
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 14,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 30,
    minHeight: 52,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '600',
  },
  helper: {
    color: '#A6A092',
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.72,
  },
});
