import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { PressableScale, Text } from '@/ui';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';
import { api, type Status, type TicketType } from '@/api';
import { isManager, useUser } from '@/auth';
import { Card, Empty, ErrorBanner, Loading, TicketList, styles } from '@/components';
import { Segmented } from '@/native';
import { colors, statusMeta, typeMeta } from '@/theme';
import { useData } from '@/useData';

const GROUPS: { label: string; statuses: Status[] | null }[] = [
  { label: 'Активные', statuses: ['NEW', 'IN_REVIEW', 'IN_PROGRESS'] },
  { label: 'Уточнение', statuses: ['AWAITING_CLARIFICATION'] },
  { label: 'Итог', statuses: ['IMPLEMENTED', 'REJECTED', 'CLOSED'] },
  { label: 'Все', statuses: null },
];

type Sort = 'updated_at' | 'created_at' | 'priority' | 'due_at';
const SORTS: { key: Sort; label: string; icon: 'clock' | 'calendar' | 'flag' | 'timer' }[] = [
  { key: 'updated_at', label: 'По обновлению', icon: 'clock' },
  { key: 'created_at', label: 'По дате подачи', icon: 'calendar' },
  { key: 'priority', label: 'По приоритету', icon: 'flag' },
  { key: 'due_at', label: 'По сроку ответа', icon: 'timer' },
];

export default function Tickets() {
  const user = useUser();
  const router = useRouter();
  const [group, setGroup] = useState(0);
  const [type, setType] = useState<TicketType | null>(null);
  const [sort, setSort] = useState<Sort>('updated_at');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data, error, refreshing, refresh, reload } = useData(
    () => api.tickets({ type: type ?? undefined, sort, order: sort === 'due_at' ? 'asc' : 'desc', overdue: overdueOnly || undefined }),
    [type, sort, overdueOnly],
    `tickets.${type ?? 'all'}.${sort}.${overdueOnly}`,
  );

  const joined = useData(() => api.joinedProblems(), [], 'joined');

  const items = useMemo(() => {
    const statuses = GROUPS[group].statuses;
    return (data?.items ?? []).filter((t) => !statuses || statuses.includes(t.status));
  }, [data, group]);

  const filtered = !!type || overdueOnly;

  return (
    <>
      <Stack.Screen options={{ title: isManager(user) ? 'Входящие' : 'Мои обращения' }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={filtered ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle'} title="Фильтры">
          <Stack.Toolbar.Menu inline title="Тип">
            <Stack.Toolbar.MenuAction icon="tray" isOn={!type} onPress={() => setType(null)}>
              Все типы
            </Stack.Toolbar.MenuAction>
            {(Object.keys(typeMeta) as TicketType[]).map((t) => (
              <Stack.Toolbar.MenuAction key={t} icon={typeMeta[t].icon} isOn={type === t} onPress={() => setType(t)}>
                {typeMeta[t].label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="Сортировка">
            {SORTS.map((s) => (
              <Stack.Toolbar.MenuAction key={s.key} icon={s.icon} isOn={sort === s.key} onPress={() => setSort(s.key)}>
                {s.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.MenuAction icon="clock.badge.exclamationmark" isOn={overdueOnly} onPress={() => setOverdueOnly((v) => !v)}>
            Только просроченные
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="Новое обращение" onPress={() => router.push('/new')} />
      </Stack.Toolbar>
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); joined.refresh(); }} tintColor={colors.tertiary} />}
      >
        <Segmented options={GROUPS.map((g) => g.label)} index={group} onChange={(i) => setGroup(i)} />
        {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
        {!data && !error ? <Loading /> : null}
        {data && items.length ? <TicketList key={group} tickets={items} index={1} /> : null}
        {data && !items.length ? (
          <Empty icon="tray" title="Пусто" />
        ) : null}
        {joined.data?.items.length ? (
          <Card style={local.joined}>
            <View style={local.joinedHead}>
              <SymbolView name="person.2.fill" size={15} tintColor={colors.secondary} />
              <Text style={local.joinedTitle}>Я тоже столкнулся</Text>
            </View>
            {joined.data.items.map((p) => (
              <PressableScale key={p.id} onPress={() => router.push(`/ticket/${p.id}`)} style={local.joinedItem}>
                <View style={[local.dot, { backgroundColor: statusMeta[p.status].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={local.joinedItemTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={local.filterNote}>{p.number} · {statusMeta[p.status].label} · столкнулись {p.affected_count}</Text>
                </View>
                <SymbolView name="chevron.right" size={13} tintColor={colors.tertiary as string} />
              </PressableScale>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

const local = StyleSheet.create({
  segment: { height: 34 },
  filterNote: { fontSize: 13, color: colors.secondary },
  joined: { padding: 16, gap: 10 },
  joinedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  joinedTitle: { fontSize: 15, fontWeight: '600', color: colors.label },
  joinedItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  joinedItemTitle: { fontSize: 15, fontWeight: '500', color: colors.label },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
