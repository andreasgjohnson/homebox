import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, Text } from 'react-native';

type IconProps = {
  name: SymbolViewProps['name'];
  /** Rendered on platforms without SF Symbols (Android, web). */
  fallbackGlyph: string;
  color: string;
  size?: number;
  weight?: SymbolViewProps['weight'];
};

export function Icon({ name, fallbackGlyph, color, size = 20, weight = 'regular' }: IconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name} size={size} tintColor={color} weight={weight} />;
  }

  return (
    <Text
      accessible={false}
      allowFontScaling={false}
      style={{ color, fontSize: size, lineHeight: Math.round(size * 1.2) }}
    >
      {fallbackGlyph}
    </Text>
  );
}
