import DateTimePicker from '@react-native-community/datetimepicker';
import { Haptics } from '@/settings';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState, type ComponentRef } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reminderLabel, useNotes } from '@/notes';
import { colors, shadow } from '@/theme';
import { fonts, PressableScale, Text } from '@/ui';

function inAnHour() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

const QUICK: { label: string; make: () => Date }[] = [
  { label: 'Через час', make: inAnHour },
  {
    label: 'Вечером',
    make: () => {
      const d = new Date();
      d.setHours(d.getHours() >= 18 ? d.getHours() + 1 : 18, 0, 0, 0);
      return d;
    },
  },
  {
    label: 'Завтра',
    make: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

export default function NoteEditor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const input = useRef<ComponentRef<typeof RNTextInput>>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { notes, save, remove } = useNotes();
  const existing = notes.find((n) => n.id === id);
  const [text, setText] = useState(existing?.text ?? '');
  const [remind, setRemind] = useState(!!existing?.remindAt);
  const [date, setDate] = useState<Date>(existing?.remindAt ? new Date(existing.remindAt) : inAnHour());

  async function done() {
    if (!text.trim()) {
      if (existing) await remove(existing.id);
      return router.back();
    }
    if (remind && date.getTime() <= Date.now()) return Alert.alert('Время уже прошло', 'Выберите время в будущем.');
    const saved = await save({ id: existing?.id, text: text.trim(), remindAt: remind ? date.toISOString() : null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (remind && !saved.notificationId) Alert.alert('Уведомления выключены', 'Заметка сохранена, но напоминание не придёт. Разрешите уведомления в настройках.');
    router.back();
  }

  function del() {
    Alert.alert('Удалить заметку?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (existing) await remove(existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: existing ? 'Заметка' : 'Новая заметка' }} />
      <Stack.Toolbar placement="left">
        {existing ? (
          <Stack.Toolbar.Button icon="trash" accessibilityLabel="Удалить" onPress={del} />
        ) : (
          <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Отмена" onPress={() => router.back()} />
        )}
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="checkmark" variant="prominent" tintColor={colors.accent} accessibilityLabel="Готово" onPress={done} />
      </Stack.Toolbar>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 44}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <RNTextInput
            ref={input}
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Что нужно не забыть?"
            placeholderTextColor={colors.tertiary}
            multiline
            autoFocus={!existing}
            scrollEnabled={false}
            textAlignVertical="top"
          />
        </ScrollView>

        <Animated.View layout={LinearTransition.duration(280)} style={[s.panel, { marginBottom: Math.max(insets.bottom, 12) }]}>
          <PressableScale
            onPress={() => {
              Haptics.selectionAsync();
              setRemind((v) => !v);
            }}
            style={s.toggle}
          >
            <View style={[s.bell, remind && { backgroundColor: colors.accent }]}>
              <SymbolView name={remind ? 'bell.fill' : 'bell'} size={15} tintColor={remind ? '#fff' : colors.secondary} />
            </View>
            <Text style={s.toggleText}>{remind ? reminderLabel(date.toISOString()) : 'Добавить напоминание'}</Text>
            {remind ? (
              <SymbolView name="xmark.circle.fill" size={18} tintColor={colors.tertiary} />
            ) : (
              <SymbolView name="plus" size={14} weight="semibold" tintColor={colors.tertiary} />
            )}
          </PressableScale>

          {remind ? (
            <Animated.View entering={FadeInDown.duration(280)} exiting={FadeOut.duration(150)} style={s.options}>
              <View style={s.quick}>
                {QUICK.map((q) => (
                  <PressableScale
                    key={q.label}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDate(q.make());
                    }}
                    style={s.chip}
                  >
                    <Text style={s.chipText}>{q.label}</Text>
                  </PressableScale>
                ))}
              </View>
              <Animated.View entering={FadeIn.delay(100)} style={s.pickers}>
                <DateTimePicker value={date} mode="date" display="compact" minimumDate={new Date()} accentColor={colors.accent} locale="ru-RU" onValueChange={(_, d) => setDate(d)} />
                <DateTimePicker value={date} mode="time" display="compact" accentColor={colors.accent} locale="ru-RU" minuteInterval={5} onValueChange={(_, d) => setDate(d)} />
              </Animated.View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 12 },
  input: { flexGrow: 1, minHeight: 200, fontSize: 19, lineHeight: 27, color: colors.label, fontFamily: fonts[500] },
  panel: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', ...shadow },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  bell: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  toggleText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.label },
  options: { paddingHorizontal: 14, paddingBottom: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingTop: 12 },
  quick: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, backgroundColor: colors.soft },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.label },
  pickers: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 },
});
