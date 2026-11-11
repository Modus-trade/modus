import { Haptics } from '@/settings';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Card, Empty, enter, exit, layout, SectionTitle, styles } from '@/components';
import { reminderLabel, useNotes, type Note } from '@/notes';
import { colors } from '@/theme';
import { PressableScale, Text } from '@/ui';

export default function Notes() {
  const router = useRouter();
  const { notes, ready, toggleDone } = useNotes();

  const { reminders, plain, done } = useMemo(() => {
    const active = notes.filter((n) => !n.done);
    return {
      reminders: active.filter((n) => n.remindAt).sort((a, b) => a.remindAt!.localeCompare(b.remindAt!)),
      plain: active.filter((n) => !n.remindAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      done: notes.filter((n) => n.done).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };
  }, [notes]);

  const open = (id?: string) => {
    Haptics.selectionAsync();
    router.push(id ? { pathname: '/note', params: { id } } : '/note');
  };

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="square.and.pencil" accessibilityLabel="Новая заметка" onPress={() => open()} />
      </Stack.Toolbar>
      <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        {ready && !notes.length ? (
          <Empty icon="note.text" title="Пока пусто" text="Запишите мысль или поставьте напоминание — нажмите на карандаш сверху." />
        ) : null}

        {reminders.length ? (
          <>
            <SectionTitle>Напоминания</SectionTitle>
            <Group notes={reminders} onOpen={open} onToggle={toggleDone} index={0} />
          </>
        ) : null}
        {plain.length ? (
          <>
            <SectionTitle>Заметки</SectionTitle>
            <Group notes={plain} onOpen={open} onToggle={toggleDone} index={2} />
          </>
        ) : null}
        {done.length ? (
          <>
            <SectionTitle>Выполнено</SectionTitle>
            <Group notes={done} onOpen={open} onToggle={toggleDone} index={4} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Group({ notes, onOpen, onToggle, index }: { notes: Note[]; onOpen: (id: string) => void; onToggle: (id: string) => void; index: number }) {
  return (
    <Card index={index} style={{ paddingVertical: 4 }}>
      {notes.map((n, i) => (
        <Row key={n.id} note={n} last={i === notes.length - 1} index={index + i} onOpen={onOpen} onToggle={onToggle} />
      ))}
    </Card>
  );
}

function Row({ note, last, index, onOpen, onToggle }: { note: Note; last: boolean; index: number; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  const [title, ...rest] = note.text.trim().split('\n');
  const preview = rest.join(' ').trim();
  const when = reminderLabel(note.remindAt);
  const overdue = !!note.remindAt && !note.done && new Date(note.remindAt).getTime() < Date.now();

  const check = useAnimatedStyle(() => ({
    backgroundColor: withTiming(note.done ? colors.accent : 'transparent', { duration: 220 }),
    borderColor: withTiming(note.done ? colors.accent : '#C9D1D9', { duration: 220 }),
    transform: [{ scale: withSpring(note.done ? 1 : 0.96, { damping: 12 }) }],
  }));

  return (
    <Animated.View entering={enter(index)} exiting={exit} layout={layout}>
      <PressableScale scaleTo={0.985} onPress={() => onOpen(note.id)} style={local.row}>
        <PressableScale
          hitSlop={12}
          scaleTo={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(note.id);
          }}
        >
          <Animated.View style={[local.check, check]}>{note.done ? <SymbolView name="checkmark" size={11} weight="bold" tintColor="#fff" /> : null}</Animated.View>
        </PressableScale>
        <View style={[local.body, !last && local.divider]}>
          <Text style={[local.title, note.done && local.doneText]} numberOfLines={1}>
            {title || 'Без названия'}
          </Text>
          {preview ? (
            <Text style={local.preview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          {when ? (
            <View style={local.when}>
              <SymbolView name="bell" size={11} tintColor={overdue ? colors.accent : colors.secondary} />
              <Text style={[local.whenText, overdue && { color: colors.accent }]}>{when}</Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 18 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  body: { flex: 1, marginLeft: 14, paddingVertical: 14, paddingRight: 18, gap: 3 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  title: { fontSize: 16, fontWeight: '600', color: colors.label },
  doneText: { color: colors.tertiary, textDecorationLine: 'line-through' },
  preview: { fontSize: 14, color: colors.secondary, fontWeight: '400' },
  when: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  whenText: { fontSize: 13, color: colors.secondary },
});
