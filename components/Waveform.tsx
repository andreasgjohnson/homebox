import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/lib/theme';

const bars = [18, 28, 13, 34, 42, 26, 48, 32, 20, 38, 55, 30, 44, 24, 16, 36, 46, 23, 31, 18];

type WaveformProps = {
  color?: string;
  height?: number;
};

export function Waveform({ color = colors.blueLine, height = 64 }: WaveformProps) {
  return (
    <View style={[styles.waveform, { height }]}>
      {bars.map((barHeight, index) => (
        <View
          key={`${barHeight}-${index}`}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: Math.min(height, barHeight),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
  },
  bar: {
    borderRadius: radii.pill,
    width: 3,
  },
});
