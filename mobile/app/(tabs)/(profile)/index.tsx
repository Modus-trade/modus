import Constants from 'expo-constants';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { api } from '@/api';
import { isManager, useAuth, useUser } from '@/auth';
import { Card, enter, SectionTitle, Stats, styles } from '@/components';
import { Logo } from '@/logo';
import { Haptics, setSetting, useSettings } from '@/settings';
import { colors, roleLabel } from '@/theme';
import { PressableScale, Text } from '@/ui';
import { useData } from '@/useData';

export default function Profile() {
  const user = useUser();
  const { logout } = useAuth();
  const settings = useSettings();
  const manager = isManager(user);
  const initials = user.full_name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  const { data } = useData(async () => {
    if (manager) {
      const s = await api.summary();
      const resolved = (s.by_status.IMPLEMENTED ?? 0) + (s.by_status.REJECTED ?? 0) + (s.by_status.CLOSED ?? 0);
      return [
        { value: s.total, label: 'Обращений' },
        { value: resolved, label: 'Рассмотрено' },
        { value: s.average_first_response_hours, decimals: 1, suffix: 'ч', label: 'До ответа' },
      ];
    }
    const { items } = await api.tickets({ author_id: user.id });
    return [
      { value: items.length, label: 'Подано' },
      { value: items.filter((t) => t.status === 'IMPLEMENTED' || t.status === 'CLOSED').length, label: 'Решено' },
      { value: items.filter((t) => t.status === 'AWAITING_CLARIFICATION').length, label: 'Ждут ответа', accent: true },
    ];
  }, [manager, user.id]);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Animated.View entering={enter(0)} style={s.head}>
        <View style={s.avatar}>
          <Text style={s.initials}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.name}>{user.full_name}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {user.position || roleLabel[user.role]} · {user.department}
          </Text>
          <Text style={s.mail} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </Animated.View>

      <SectionTitle>Активность</SectionTitle>
      {data ? <Stats index={1} items={data} /> : <Card style={{ height: 82 }}>{null}</Card>}

      <SectionTitle>Настройки</SectionTitle>
      <Card index={2}>
        <Toggle
          title="Уведомления об ответах"
          hint="Проверяем изменения при открытии приложения"
          value={settings.updates}
          onChange={(v) => setSetting('updates', v)}
        />
        <View style={s.sep} />
        <Toggle title="Вибрация" value={settings.haptics} onChange={(v) => setSetting('haptics', v)} />
      </Card>

      <Animated.View entering={enter(3)}>
        <PressableScale
          style={[styles.card, s.logout]}
          onPress={() =>
            Alert.alert('Выйти из аккаунта?', undefined, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Выйти', style: 'destructive', onPress: logout },
            ])
          }
        >
          <Text style={s.logoutText}>Выйти</Text>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enter(4)} style={s.footer}>
        <View style={{ opacity: 0.55 }}>
          <Logo width={96} />
        </View>
        <Text style={s.version}>Версия {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Animated.View>
    </ScrollView>
  );
}

function Toggle({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {hint ? <Text style={s.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        trackColor={{ true: colors.accent }}
        onValueChange={(v) => {
          onChange(v);
          if (v) Haptics.selectionAsync();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4, paddingVertical: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.label, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontSize: 22, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: colors.label, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: colors.secondary },
  mail: { fontSize: 13, color: colors.tertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: colors.label },
  rowHint: { fontSize: 12, color: colors.tertiary },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 18 },
  logout: { padding: 15, alignItems: 'center', marginTop: 18 },
  logoutText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', gap: 8, marginTop: 28 },
  version: { fontSize: 12, color: colors.tertiary },
});
