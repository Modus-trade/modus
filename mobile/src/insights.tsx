
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api, type Solution } from './api';
import { Card } from './components';
import { Haptics } from './settings';
import { colors } from './theme';
import { PressableScale, Text } from './ui';

/** Для ответственного: вариант решения от ИИ. */
export function TicketInsights({
  ticketId,
  final,
  onUseReply,
  onUseResult,
}: {
  ticketId: number;
  final: boolean;
  onUseReply: (text: string) => void;
  onUseResult: (text: string) => void;
}) {
  const [solution, setSolution] = useState<Solution | null>(null);
  const [solving, setSolving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function solve() {
    Haptics.selectionAsync();
    setSolving(true);
    setNote(null);
    try {
      setSolution(await api.solve(ticketId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Не удалось получить вариант решения');
    } finally {
      setSolving(false);
    }
  }

  return (
    <Card style={s.card}>
      <View style={s.head}>
        <SymbolView name="sparkles" size={16} tintColor={colors.secondary} />
        <Text style={s.title}>Помощь ИИ</Text>
      </View>
      {!final ? (
        <>
          <PressableScale onPress={solve} disabled={solving} style={s.solve}>
            {solving ? <ActivityIndicator color={colors.accent} /> : <SymbolView name="sparkles" size={16} tintColor={colors.accent} />}
            <Text style={s.solveText}>{solving ? 'ИИ думает…' : solution ? 'Предложить ещё раз' : 'Предложить решение'}</Text>
          </PressableScale>
          {note ? <Text style={s.meta}>{note}</Text> : null}
          {solution ? (
            <Animated.View entering={FadeIn.duration(300)} style={s.answer}>
              <Text style={s.summary}>{solution.summary}</Text>
              {solution.steps.map((step, n) => (
                <Text key={n} style={s.step}>
                  {n + 1}. {step}
                </Text>
              ))}
              <Text style={s.source}>
                Предложено ИИ — проверьте перед отправкой
                {solution.based_on.length ? ` · ${solution.based_on.join(', ')}` : ''}
              </Text>
              <View style={s.actions}>
                {solution.reply_draft ? (
                  <PressableScale style={s.action} onPress={() => onUseReply(solution.reply_draft)}>
                    <Text style={s.actionText}>В ответ автору</Text>
                  </PressableScale>
                ) : null}
                <PressableScale
                  style={s.action}
                  onPress={() => onUseResult([solution.summary, ...solution.steps.map((x, n) => `${n + 1}. ${x}`)].join('\n'))}
                >
                  <Text style={s.actionText}>В результат</Text>
                </PressableScale>
              </View>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.label },
  item: { gap: 2, paddingVertical: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.label },
  meta: { fontSize: 13, color: colors.secondary },
  resolution: { fontSize: 13, color: colors.secondary, lineHeight: 18 },
  solve: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accent + '12',
    marginTop: 4,
  },
  solveText: { fontSize: 15, fontWeight: '600', color: colors.accent },
  answer: { gap: 6 },
  summary: { fontSize: 15, color: colors.label, lineHeight: 21 },
  step: { fontSize: 14, color: colors.label, lineHeight: 20 },
  source: { fontSize: 12, color: colors.tertiary },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  action: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.soft },
  actionText: { fontSize: 13, fontWeight: '600', color: colors.label },
});
