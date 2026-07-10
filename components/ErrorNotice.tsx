import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/lib/theme';

type ErrorNoticeProps = {
  message: string;
  onRetry?: () => void;
};

/**
 * A quiet, voice-true failure notice. Raw backend messages never render here;
 * callers log them and pass copy in the daybook's register instead.
 */
export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.notice}
    >
      <Text style={styles.noticeText}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityLabel="Try again"
          accessibilityRole="button"
          hitSlop={6}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 16,
  },
  noticeText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  retry: {
    alignSelf: 'flex-start',
    borderColor: colors.dangerBorder,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: {
    color: colors.danger,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    fontWeight: '600',
  },
});
