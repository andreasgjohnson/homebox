import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

type AudioPlaybackProps = {
  disabled?: boolean;
  emptyText?: string;
  title?: string;
  uri: string | null;
};

export function AudioPlayback({
  disabled = false,
  emptyText = 'Record audio to enable playback.',
  title = 'Playback',
  uri,
}: AudioPlaybackProps) {
  const player = useAudioPlayer(uri ?? null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const canPlay = Boolean(uri) && !disabled;

  async function togglePlayback() {
    if (!canPlay) {
      return;
    }

    if (status.playing) {
      player.pause();
      return;
    }

    if (status.didJustFinish || hasReachedEnd(status.currentTime, status.duration)) {
      await player.seekTo(0);
    }

    player.play();
  }

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {canPlay
            ? `${formatAudioTime(status.currentTime)} / ${formatAudioTime(status.duration)}`
            : emptyText}
        </Text>
      </View>
      <Pressable
        disabled={!canPlay}
        onPress={() => void togglePlayback()}
        style={({ pressed }) => [
          styles.button,
          !canPlay && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>{status.playing ? 'Pause' : 'Play'}</Text>
      </Pressable>
    </View>
  );
}

function hasReachedEnd(currentTime: number, duration: number) {
  return duration > 0 && currentTime >= duration - 0.2;
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    padding: 16,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radii.control,
    minWidth: 84,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
