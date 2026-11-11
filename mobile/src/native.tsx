import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
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

/** Нативное выпадающее меню выбора (как <select>/option в iOS). */
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
  return (
    <Host matchContents>
      <Picker
        selection={(value ?? '__none') as T}
        onSelectionChange={(v: T) => {
          if (v === ('__none' as T)) return;
          Haptics.selectionAsync();
          onChange(v);
        }}
        modifiers={[pickerStyle('menu'), ...(color ? [tint(color)] : [])]}
      >
        {value === null ? <Text modifiers={[tag('__none')]}>{placeholder}</Text> : null}
        {options.map((o) => (
          <Text key={String(o.value)} modifiers={[tag(o.value)]}>
            {o.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
