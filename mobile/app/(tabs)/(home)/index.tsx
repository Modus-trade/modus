import { Haptics } from '@/settings';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { api, type Status, type Summary, type Ticket } from '@/api';
import { isManager, useUser } from '@/auth';
import { Card, Empty, enter, ErrorBanner, Loading, SectionTitle, Stats, TicketList, styles } from '@/components';
import { colors, statusMeta } from '@/theme';
import { Text } from '@/ui';
import { useData } from '@/useData';

const ACTIVE: Status[] = ['NEW', 'IN_REVIEW', 'IN_PROGRESS', 'AWAITING_CLARIFICATION'];

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

export default function Home() {
  const user = useUser();
  const router = useRouter();
  const manager = isManager(user);
  const { data, error, refreshing, refresh, reload } = useData(async () => {
    const [tickets, summary] = await Promise.all([api.tickets({ sort: 'updated_at' }), manager ? api.summary() : null]);
    return { tickets: tickets.items, summary };
  }, [manager], 'home');

  const raw = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="Новое обращение"
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/new');
          }}
        />
      </Stack.Toolbar>
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.tertiary} />}
      >
        <Animated.View entering={enter(0)} style={local.hello}>
          <Text style={local.date}>{today}</Text>
          <Text style={local.title}>
            {greeting()},{'\n'}
            {user.full_name.split(' ')[0]}
          </Text>
        </Animated.View>

        {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
        {!data && !error ? <Loading /> : null}
        {data ? (manager && data.summary ? <ManagerHome summary={data.summary} tickets={data.tickets} /> : <EmployeeHome tickets={data.tickets} />) : null}
      </ScrollView>
    </>
  );
}

function EmployeeHome({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const waiting = tickets.filter((t) => t.status === 'AWAITING_CLARIFICATION');
  const active = tickets.filter((t) => ACTIVE.includes(t.status)).length;
  const done = tickets.filter((t) => t.status === 'IMPLEMENTED' || t.status === 'CLOSED').length;

  if (!tickets.length) {
    return (
      <Card index={1}>
        <Empty icon="lightbulb" title="Здесь появятся ваши обращения" text="Нажмите «+», чтобы предложить идею или сообщить о проблеме." />
      </Card>
    );
  }
  return (
    <>
      <Stats
        index={1}
        items={[
          { value: tickets.length, label: 'Подано' },
          { value: active, label: 'В работе' },
          { value: done, label: 'Решено' },
        ]}
      />
      {waiting.length ? (
        <>
          <SectionTitle>Ждут вашего ответа</SectionTitle>
          <TicketList tickets={waiting} index={2} />
        </>
      ) : null}
      <SectionTitle action="Все" onAction={() => router.navigate('/(tabs)/(tickets)')}>
        Недавние
      </SectionTitle>
      <TicketList tickets={tickets.filter((t) => t.status !== 'AWAITING_CLARIFICATION').slice(0, 4)} index={3} />
    </>
  );
}

function ManagerHome({ summary, tickets }: { summary: Summary; tickets: Ticket[] }) {
  const router = useRouter();
  const attention = [...summary.overdue_tickets, ...tickets.filter((t) => t.status === 'NEW' && !t.overdue)].slice(0, 5);
  return (
    <>
      <Stats
        index={1}
        items={[
          { value: summary.total, label: 'Обращений' },
          { value: summary.average_first_response_hours, decimals: 1, suffix: 'ч', label: 'До ответа' },
          { value: summary.overdue_count, label: 'Просрочено', accent: true },
        ]}
      />
      <SectionTitle action="Все" onAction={() => router.navigate('/(tabs)/(tickets)')}>
        Требуют внимания
      </SectionTitle>
      {attention.length ? (
        <TicketList tickets={attention} index={2} />
      ) : (
        <Card index={2}>
          <Empty icon="checkmark.circle" title="Всё разобрано" />
        </Card>
      )}
      {summary.repeated?.length ? (
        <>
          <SectionTitle>Повторяющиеся проблемы</SectionTitle>
          <TicketList
            tickets={summary.repeated.map((t) => ({ ...t, title: `${t.title} · ${t.affected_count} чел.` }))}
            index={3}
          />
        </>
      ) : null}
      <SectionTitle>Статусы</SectionTitle>
      <StatusBar summary={summary} />
    </>
  );
}

/** Одна полоса со всеми статусами вместо набора графиков. */
function StatusBar({ summary }: { summary: Summary }) {
  const entries = (Object.keys(statusMeta) as Status[]).map((s) => [s, summary.by_status[s] ?? 0] as const).filter(([, n]) => n > 0);
  const total = Math.max(1, summary.total);
  return (
    <Card index={8} style={{ padding: 18, gap: 16 }}>
      <View style={local.bar}>
        {entries.map(([s, n], i) => (
          <Segment key={s} flex={n / total} color={statusMeta[s].color} index={i} />
        ))}
      </View>
      <View style={local.legend}>
        {entries.map(([s, n], i) => (
          <Animated.View key={s} entering={FadeIn.delay(500 + i * 60).duration(400)} style={local.legendItem}>
            <View style={[local.legendDot, { backgroundColor: statusMeta[s].color }]} />
            <Text style={local.legendText}>{statusMeta[s].label}</Text>
            <Text style={local.legendValue}>{n}</Text>
          </Animated.View>
        ))}
      </View>
    </Card>
  );
}

function Segment({ flex, color, index }: { flex: number; color: string; index: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(300 + index * 80, withTiming(flex, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [flex, index, v]);
  const style = useAnimatedStyle(() => ({ flexGrow: v.value }));
  return <Animated.View style={[{ flexBasis: 0, backgroundColor: color, height: 8 }, style]} />;
}

const local = StyleSheet.create({
  hello: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 10, gap: 6 },
  date: { fontSize: 14, color: colors.secondary, fontWeight: '500' },
  title: { fontSize: 32, fontWeight: '700', color: colors.label, letterSpacing: -0.9, lineHeight: 38 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 3 },
  legend: { gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { flex: 1, fontSize: 14, color: colors.secondary },
  legendValue: { fontSize: 14, fontWeight: '600', color: colors.label, fontVariant: ['tabular-nums'] },
});
