import { Haptics } from '@/settings';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { Status, Ticket } from './api';
import { colors, relative, shadow, statusMeta } from './theme';
import { PressableScale, Text } from './ui';

const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Появление: мягко поднимается и проявляется. */
export const enter = (i = 0) => FadeInDown.delay(Math.min(i, 8) * 50).duration(520).easing(ease).withInitialValues({ transform: [{ translateY: 12 }] });
export const exit = FadeOut.duration(180);
export const layout = LinearTransition.duration(320).easing(ease);

export function Card({ children, style, index }: { children: ReactNode; style?: StyleProp<ViewStyle>; index?: number }) {
  return (
    <Animated.View entering={index !== undefined ? enter(index) : undefined} exiting={exit} layout={layout} style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

export function SectionTitle({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {action ? (
        <PressableScale onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Тихий статус: цветная точка + текст. Без плашек. */
export function StatusDot({ status, size = 13 }: { status: Status; size?: number }) {
  const m = statusMeta[status];
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: m.color }]} />
      <Text style={[styles.dotText, { color: m.color, fontSize: size }]}>{m.label}</Text>
    </View>
  );
}

// Совместимость: в карточке оставлен аккуратный бейдж.
export function Pill({ label, color, bg }: { label: string; color: string; bg?: string; icon?: SFSymbol }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg ?? color + '12' }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}
export const StatusPill = StatusDot;

export function TicketRow({ ticket, last, index = 0 }: { ticket: Ticket; last?: boolean; index?: number }) {
  const router = useRouter();
  const m = statusMeta[ticket.status];
  return (
    <Animated.View entering={enter(index)} exiting={exit} layout={layout}>
      <PressableScale scaleTo={0.985} onPress={() => router.push(`/ticket/${ticket.id}`)} style={styles.row}>
        <View style={[styles.rowDot, { backgroundColor: ticket.overdue ? colors.accent : m.color }]} />
        <View style={[styles.rowBody, !last && styles.rowDivider]}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {ticket.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {ticket.overdue ? <Text style={{ color: colors.accent }}>Нет ответа · </Text> : null}
            {m.label} · {relative(ticket.updated_at)}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

export function TicketList({ tickets, index = 0 }: { tickets: Ticket[]; index?: number }) {
  return (
    <Card index={index} style={{ paddingVertical: 4 }}>
      {tickets.map((t, i) => (
        <TicketRow key={t.id} ticket={t} index={index + i} last={i === tickets.length - 1} />
      ))}
    </Card>
  );
}

export function Empty({ icon, title, text }: { icon: SFSymbol; title: string; text?: string }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} exiting={exit} style={styles.empty}>
      <SymbolView name={icon} size={30} tintColor={colors.tertiary} weight="light" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </Animated.View>
  );
}

/** Скелетон: мягко «дышит», пока грузятся данные. */
export function Loading({ rows = 4 }: { rows?: number }) {
  const o = useSharedValue(0.45);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(0.9, { duration: 800 }), withTiming(0.45, { duration: 800 })), -1);
  }, [o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)}>
    <Animated.View style={[styles.card, { paddingVertical: 8 }, pulse]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' }}>
          <View style={[styles.skel, { width: 8, height: 8, borderRadius: 4 }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[styles.skel, { width: `${70 - i * 8}%`, height: 12 }]} />
            <View style={[styles.skel, { width: '38%' }]} />
          </View>
        </View>
      ))}
    </Animated.View>
    </Animated.View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Animated.View entering={enter(0)} exiting={exit} style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <PressableScale onPress={onRetry} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Повторить</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const STAGES: { label: string; statuses: Status[] }[] = [
  { label: 'Подано', statuses: ['NEW'] },
  { label: 'Рассмотрение', statuses: ['IN_REVIEW', 'AWAITING_CLARIFICATION'] },
  { label: 'Реализация', statuses: ['IN_PROGRESS'] },
  { label: 'Решение', statuses: ['IMPLEMENTED', 'REJECTED', 'CLOSED'] },
];

/** Тонкая линия прогресса с четырьмя точками; подписана только текущая стадия. */
export function StageTracker({ status }: { status: Status }) {
  const current = STAGES.findIndex((s) => s.statuses.includes(status));
  const color = statusMeta[status].color;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(250, withTiming(current / (STAGES.length - 1), { duration: 1000, easing: ease }));
  }, [current, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <Animated.View style={[styles.trackFill, { backgroundColor: color }, fill]} />
        </View>
        {STAGES.map((_, i) => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(300 + i * 160).duration(400)}
            style={[
              styles.stageDot,
              { left: `${(i / (STAGES.length - 1)) * 100}%` },
              i <= current && { backgroundColor: color, borderColor: color },
              i === current && { transform: [{ scale: 1.25 }], boxShadow: `0 0 0 4px ${color}26` },
            ]}
          />
        ))}
      </View>
      <View style={styles.stageLabels}>
        {STAGES.map((s, i) => (
          <Text key={s.label} style={[styles.stageLabel, i === current && { color: colors.label, fontWeight: '600' }]}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function CountUp({ value, decimals = 0, style }: { value: number; decimals?: number; style?: StyleProp<TextStyle> }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setN(value * (1 - Math.pow(1 - t, 4)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text style={style}>{n.toFixed(decimals).replace('.', ',')}</Text>;
}

/** Ряд крупных цифр без иконок и рамок. */
export function Stats({ items, index = 0 }: { items: { value: number | null; label: string; suffix?: string; decimals?: number; accent?: boolean }[]; index?: number }) {
  return (
    <Card index={index} style={styles.stats}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.stat, i > 0 && styles.statDivider]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            {it.value === null ? (
              <Text style={styles.statValue}>—</Text>
            ) : (
              <CountUp value={it.value} decimals={it.decimals} style={[styles.statValue, it.accent && it.value > 0 && { color: colors.accent }]} />
            )}
            {it.suffix && it.value !== null ? <Text style={styles.statSuffix}>{it.suffix}</Text> : null}
          </View>
          <Text style={styles.statLabel} numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </Card>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 14, paddingBottom: 60 },
  seg: { flexDirection: 'row', height: 38, borderRadius: 12, backgroundColor: '#E9EDF1', padding: 0 },
  segPill: { position: 'absolute', top: 2, bottom: 2, borderRadius: 10, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(22,41,58,0.10)' },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 14, fontWeight: '500', color: colors.secondary },
  segTextActive: { color: colors.label, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: 22, borderCurve: 'continuous', ...shadow },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, paddingHorizontal: 4 },
  section: { fontSize: 17, fontWeight: '700', color: colors.label, letterSpacing: -0.2 },
  sectionAction: { fontSize: 15, color: colors.secondary, fontWeight: '500' },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotText: { fontWeight: '600' },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  pillText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18 },
  rowDot: { width: 8, height: 8, borderRadius: 4 },
  rowBody: { flex: 1, marginLeft: 14, paddingVertical: 14, paddingRight: 18, gap: 3 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.label, letterSpacing: -0.2 },
  rowMeta: { fontSize: 13, color: colors.secondary, fontWeight: '400' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.label, textAlign: 'center', marginTop: 4 },
  emptyText: { fontSize: 14, color: colors.secondary, textAlign: 'center', lineHeight: 20 },
  skel: { height: 9, borderRadius: 5, backgroundColor: '#E6EAEE' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
  errorText: { flex: 1, color: colors.secondary, fontSize: 14 },
  trackWrap: { height: 12, justifyContent: 'center', marginHorizontal: 6 },
  track: { height: 2, borderRadius: 1, backgroundColor: '#E6EAEE', overflow: 'hidden' },
  trackFill: { height: 2 },
  stageDot: { position: 'absolute', width: 10, height: 10, marginLeft: -5, borderRadius: 5, backgroundColor: '#fff', borderWidth: 2, borderColor: '#DCE2E8' },
  stageLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stageLabel: { fontSize: 11, color: colors.tertiary },
  stats: { flexDirection: 'row', paddingVertical: 18 },
  stat: { flex: 1, paddingHorizontal: 16, gap: 2 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.separator },
  statValue: { fontSize: 26, fontWeight: '700', color: colors.label, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  statSuffix: { fontSize: 14, fontWeight: '600', color: colors.tertiary, marginLeft: 2 },
  statLabel: { fontSize: 12, color: colors.secondary },
});
