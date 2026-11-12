import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api, type SharedProblem } from './api';
import { Haptics } from './settings';
import { colors, statusMeta } from './theme';
import { PressableScale, Text } from './ui';

/**
 * Пока сотрудник пишет проблему — показываем похожие общие проблемы.
 * «У меня тоже» присоединяет его вместо дубля.
 */
export function SharedProblems({
  text,
  categoryId,
  onJoined,
}: {
  text: string;
  categoryId: number | null;
  onJoined: (p: SharedProblem) => void;
}) {
  const [items, setItems] = useState<SharedProblem[]>([]);
  const [joining, setJoining] = useState<number | null>(null);
  const query = text.trim();

  useEffect(() => {
    if (query.length < 8) return setItems([]);
    let alive = true;
    const timer = setTimeout(() => {
      api
        .sharedProblems(query, categoryId)
        .then((r) => alive && setItems(r.items))
        .catch(() => undefined);
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, categoryId]);

  async function join(p: SharedProblem) {
    Haptics.selectionAsync();
    setJoining(p.id);
    try {
      const joined = await api.joinProblem(p.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onJoined(joined);
    } catch (e) {
      Alert.alert('Не удалось присоединиться', e instanceof Error ? e.message : '');
    } finally {
      setJoining(null);
    }
  }

  if (!items.length) return null;
  return (
    <Animated.View entering={FadeIn.duration(250)} style={s.box}>
      <View style={s.head}>
        <SymbolView name="person.2.fill" size={15} tintColor={colors.accent} />
        <Text style={s.title}>Похоже, с этим уже столкнулись</Text>
      </View>
      <Text style={s.hint}>Присоединитесь — так проблему решат быстрее, а итог придёт и вам.</Text>
      {items.map((p) => (
        <View key={p.id} style={s.item}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.itemTitle} numberOfLines={2}>
              {p.title}
            </Text>
            <Text style={s.meta}>
              {p.number} · {statusMeta[p.status].label} · столкнулись {p.affected_count}
            </Text>
          </View>
          {p.joined ? (
            <Text style={s.joined}>Вы уже здесь</Text>
          ) : (
            <PressableScale onPress={() => join(p)} disabled={joining !== null} style={s.join}>
              {joining === p.id ? <ActivityIndicator color="#fff" /> : <Text style={s.joinText}>У меня тоже</Text>}
            </PressableScale>
          )}
        </View>
      ))}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  box: { gap: 8, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent + '33' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.label },
  hint: { fontSize: 13, color: colors.secondary, lineHeight: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  itemTitle: { fontSize: 15, fontWeight: '500', color: colors.label },
  meta: { fontSize: 12, color: colors.secondary },
  join: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent, minWidth: 104, alignItems: 'center' },
  joinText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  joined: { fontSize: 13, color: colors.tertiary },
});
