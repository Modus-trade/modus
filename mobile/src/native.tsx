import { Button, HStack, Host, Image, Menu, Picker, Text } from '@expo/ui/swift-ui';
import { foregroundStyle, frame, lineLimit, pickerStyle, tag, truncationMode } from '@expo/ui/swift-ui/modifiers';
import { Haptics } from '@/settings';
import type { StyleProp, ViewStyle } from 'react-native';

/** Нативный SwiftUI-переключатель: на iOS 26 рисуется в стиле Liquid Glass. */
export function Segmented({ options, index, onChange, style }: { options: string[]; index: number; onChange: (i: number) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Host matchContents={{ vertical: true }} style={[{ width: '100%' }, style]}>
      <Picker
        selection={index}
        onSelectionChange={(i: number) => {
          Haptics.selectionAsync();
          onChange(i);
        }}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((o, i) => (
          <Text key={o} modifiers={[tag(i)]}>
            {o}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

/** Нативное выпадающее меню выбора (как <select>/option в iOS). Длинное значение сокращается «…» в одну строку. */
export function MenuPicker<T extends string | number>({
  value,
  options,
  placeholder,
  onChange,
  color,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  placeholder: string;
  onChange: (v: T) => void;
  color?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? placeholder;
  return (
    <Host matchContents={{ vertical: true }} alignment="trailing" style={{ flex: 1, minWidth: 0 }}>
      <Menu
        label={
          <HStack spacing={5} modifiers={[frame({ maxWidth: 10000, alignment: 'trailing' })]}>
            <Text modifiers={[lineLimit(1), truncationMode('tail'), ...(color ? [foregroundStyle(color)] : [])]}>{current}</Text>
            <Image systemName="chevron.up.chevron.down" size={13} color={color} />
          </HStack>
        }
      >
        {options.map((o) => (
          <Button
            key={String(o.value)}
            label={o.label}
            systemImage={o.value === value ? 'checkmark' : undefined}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.value);
            }}
          />
        ))}
      </Menu>
    </Host>
  );
}
