import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Haptics } from '@/settings';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PressableScale, Text, TextInput } from '@/ui';
import Animated, { FadeIn, FadeOut, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AttachMenu, type PickedFile } from '@/attach';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';
import { api, attachmentUrl, type Attachment, type Comment, type HistoryItem, type Priority, type Status, type TicketDetail, type User } from '@/api';
import { isManager, useUser } from '@/auth';
import { Card, enter, ErrorBanner, layout, Loading, StageTracker, StatusDot, styles } from '@/components';
import { colors, finalStatuses, formatDate, priorityMeta, relative, shadow, statusMeta, transitions, typeMeta } from '@/theme';
import { useData } from '@/useData';

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const manager = isManager(user);
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [assignees, setAssignees] = useState<User[]>([]);
  const { data: t, error, refreshing, refresh, reload, setData } = useData(() => api.ticket(id), [id], `ticket.${id}`);

  useEffect(() => {
    api.assignees().then(setAssignees).catch(() => undefined);
  }, []);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setData(await api.ticket(id));
      return true;
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Не удалось сохранить', e instanceof Error ? e.message : '');
      return false;
    }
  }

  function changeStatus(status: Status) {
    if (!t) return;
    const needsResult = (status === 'IMPLEMENTED' || status === 'REJECTED' || status === 'CLOSED') && !(t.resolution ?? '').trim();
    if (needsResult) {
      Alert.prompt(
        status === 'REJECTED' ? 'Причина отказа' : 'Результат рассмотрения',
        status === 'REJECTED' ? 'Автор увидит мотивированный ответ.' : 'Что сделано или решено — автор увидит этот текст.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Сохранить',
            onPress: (text?: string) => {
              if (!text?.trim()) return Alert.alert('Результат обязателен');
              mutate(() => api.patch(t.id, { resolution: text.trim(), status }));
            },
          },
        ],
        'plain-text',
      );
    } else mutate(() => api.patch(t.id, { status }));
  }

  function editResolution() {
    if (!t) return;
    Alert.prompt(
      'Результат рассмотрения',
      undefined,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Сохранить', onPress: (text?: string) => text?.trim() && mutate(() => api.patch(t.id, { resolution: text.trim() })) },
      ],
      'plain-text',
      t.resolution ?? '',
    );
  }

  const open = !!t && !finalStatuses.includes(t.status);
  const canManage = manager && !!t && t.status !== 'CLOSED';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: t?.number ?? '' }} />
      {canManage && t ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="arrow.triangle.2.circlepath" title="Статус">
            {transitions[t.status].map((s) => (
              <Stack.Toolbar.MenuAction key={s} icon={statusMeta[s].icon} destructive={s === 'REJECTED'} onPress={() => changeStatus(s)}>
                {statusMeta[s].label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu icon="ellipsis" title="Действия">
            <Stack.Toolbar.Menu title="Приоритет" icon="flag">
              {(['HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => (
                <Stack.Toolbar.MenuAction key={p} isOn={t.priority === p} onPress={() => mutate(() => api.patch(t.id, { priority: p }))}>
                  {priorityMeta[p].label}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.Menu title="Ответственный" icon="person.crop.circle.badge.checkmark">
              {assignees.map((a) => (
                <Stack.Toolbar.MenuAction
                  key={a.id}
                  subtitle={a.department}
                  isOn={t.assignee_id === a.id}
                  onPress={() => mutate(() => api.patch(t.id, { assignee_id: a.id }))}
                >
                  {a.full_name}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
            <Stack.Toolbar.MenuAction icon="text.badge.checkmark" onPress={editResolution}>
              {t.resolution ? 'Изменить результат' : 'Записать результат'}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: open ? 110 : 40 }]}
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
          {!t && !error ? <Loading /> : null}
          {t ? <Body t={t} user={user} assignees={assignees} /> : null}
        </ScrollView>
        {t && open ? (
          <Composer
            ticket={t}
            manager={manager && t.author_id !== user.id}
            bottom={insets.bottom}
            onAttach={(files) =>
              mutate(async () => {
                for (const f of files) await api.upload(t.id, f);
              })
            }
            onSend={(body, clarify) =>
              mutate(async () => {
                await api.comment(t.id, body, clarify);
                setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 300);
              })
            }
          />
        ) : null}
      </View>
    </View>
  );
}

function Body({ t, user, assignees }: { t: TicketDetail; user: User; assignees: User[] }) {
  const [details, setDetails] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [history, setHistory] = useState(false);
  const waitingForMe = t.status === 'AWAITING_CLARIFICATION' && t.author_id === user.id;
  const rejected = t.status === 'REJECTED';
  return (
    <>
      <Animated.View entering={enter(0)} style={b.head}>
        <Text style={b.kicker}>
          {typeMeta[t.type].label}
          {t.priority === 'HIGH' ? <Text style={{ color: colors.accent }}> · срочно</Text> : null}
        </Text>
        <Text style={b.title}>{t.title}</Text>
      </Animated.View>

      <Card index={1} style={b.statusCard}>
        <View style={b.statusTop}>
          <StatusDot status={t.status} size={15} />
          <Text style={b.updated}>{relative(t.updated_at)}</Text>
        </View>
        <StageTracker status={t.status} />
        <Text style={b.owner}>
          {t.assignee_name ? (
            <>
              Отвечает <Text style={b.ownerName}>{t.assignee_name}</Text>
            </>
          ) : (
            'Ответственный ещё не назначен'
          )}
          {t.overdue ? <Text style={{ color: colors.accent }}> · срок ответа прошёл</Text> : null}
        </Text>
      </Card>

      {waitingForMe ? (
        <Animated.View entering={enter(2)} style={b.note}>
          <View style={[b.noteBar, { backgroundColor: statusMeta.AWAITING_CLARIFICATION.color }]} />
          <Text style={b.noteText}>Вам задали уточняющий вопрос — ответьте ниже.</Text>
        </Animated.View>
      ) : null}

      {t.resolution ? (
        <Animated.View entering={enter(2)} style={b.note}>
          <View style={[b.noteBar, { backgroundColor: rejected ? statusMeta.REJECTED.color : statusMeta.IMPLEMENTED.color }]} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={b.noteTitle}>{rejected ? 'Почему отклонено' : 'Решение'}</Text>
            <Text style={b.noteText}>{t.resolution}</Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(3)} style={b.block}>
        <Text style={b.text}>{t.description}</Text>
        {t.proposed_solution ? (
          <>
            <Text style={b.label}>Предлагаемое решение</Text>
            <Text style={b.text}>{t.proposed_solution}</Text>
          </>
        ) : null}
      </Animated.View>

      <Toggle open={details} onPress={() => setDetails((v) => !v)} label="Подробности" />
      {details ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} layout={layout} style={b.details}>
          <Detail label="Категория" value={t.category_name} />
          <Detail label="Автор" value={`${t.author_name}, ${t.department}`} />
          <Detail label="Подано" value={formatDate(t.created_at, true)} />
          <Detail label="Первый ответ" value={t.first_response_at ? formatDate(t.first_response_at, true) : `ожидается до ${formatDate(t.due_at, true)}`} />
          <Detail label="Приоритет" value={priorityMeta[t.priority].label} />
        </Animated.View>
      ) : null}

      <Animated.View layout={layout}>
        <Text style={b.section}>Обсуждение</Text>
        {t.comments.length || t.attachments.length ? (
          <View style={{ gap: 10 }}>
            {[
              ...t.comments.map((c) => ({ at: c.created_at, key: `c${c.id}`, node: (i: number) => <Bubble c={c} mine={c.author_id === user.id} index={i} /> })),
              ...t.attachments.map((a) => ({
                at: a.created_at,
                key: `a${a.id}`,
                node: (i: number) => <AttachmentBubble a={a} mine={a.uploaded_by_id === user.id} index={i} onOpen={setViewer} />,
              })),
            ]
              .sort((x, y) => x.at.localeCompare(y.at))
              .map((item, i) => (
                <View key={item.key}>{item.node(i)}</View>
              ))}
          </View>
        ) : (
          <Text style={b.muted}>Пока тихо. Напишите, если есть вопрос.</Text>
        )}
      </Animated.View>

      {t.history.length ? (
        <Animated.View layout={layout}>
          <Toggle open={history} onPress={() => setHistory((v) => !v)} label={`История · ${t.history.length}`} />
          {history ? (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} style={{ gap: 14, paddingTop: 6 }}>
              {t.history.map((h) => (
                <HistoryRow key={h.id} h={h} assignees={assignees} />
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : null}
      <PhotoViewer a={viewer} onClose={() => setViewer(null)} />
    </>
  );
}

const isImage = (a: Attachment) => a.content_type.startsWith('image/');

function AttachmentBubble({ a, mine, index, onOpen }: { a: Attachment; mine: boolean; index: number; onOpen: (a: Attachment) => void }) {
  return (
    <Animated.View entering={enter(index + 3)} style={[b.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
      {isImage(a) ? (
        <PressableScale scaleTo={0.97} onPress={() => onOpen(a)} style={b.photo}>
          <Image source={{ uri: attachmentUrl(a.id) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </PressableScale>
      ) : (
        <View style={[b.bubble, b.fileBubble, mine ? { backgroundColor: colors.label } : { backgroundColor: colors.card }]}>
          <SymbolView name="doc.fill" size={20} tintColor={mine ? '#fff' : colors.secondary} />
          <View style={{ flexShrink: 1 }}>
            <Text style={[b.bubbleText, mine && { color: '#fff' }]} numberOfLines={1}>
              {a.filename}
            </Text>
            <Text style={[b.fileSize, mine && { color: '#ffffffaa' }]}>{Math.max(1, Math.round(a.size_bytes / 1024))} КБ</Text>
          </View>
        </View>
      )}
      <Text style={b.bubbleMeta}>
        {mine ? 'Вы' : 'Вложение'} · {formatDate(a.created_at, true)}
      </Text>
    </Animated.View>
  );
}

/** Фото на весь экран; закрывается тапом или кнопкой. */
function PhotoViewer({ a, onClose }: { a: Attachment | null; onClose: () => void }) {
  return (
    <Modal visible={!!a} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={b.viewer} onPress={onClose}>
        {a ? <Image source={{ uri: attachmentUrl(a.id) }} style={b.viewerImage} resizeMode="contain" /> : null}
        <View style={b.viewerClose}>
          <SymbolView name="xmark" size={16} weight="semibold" tintColor="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

function Toggle({ open, onPress, label }: { open: boolean; onPress: () => void; label: string }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withTiming(open ? 1 : 0, { duration: 260 });
  }, [open, r]);
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 90}deg` }] }));
  return (
    <Animated.View layout={layout}>
      <PressableScale
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        style={b.toggle}
      >
        <Text style={b.toggleText}>{label}</Text>
        <Animated.View style={rot}>
          <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.tertiary} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={b.detail}>
      <Text style={b.detailLabel}>{label}</Text>
      <Text style={b.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Bubble({ c, mine, index }: { c: Comment; mine: boolean; index: number }) {
  return (
    <Animated.View entering={enter(index + 3)} style={[b.bubbleWrap, mine && { alignItems: 'flex-end' }]}>
      <View
        style={[
          b.bubble,
          mine ? { backgroundColor: colors.label, borderBottomRightRadius: 8 } : { backgroundColor: colors.card, borderBottomLeftRadius: 8 },
        ]}
      >
        {c.is_clarification_request ? <Text style={[b.clarify, mine && { color: '#FFD9A8' }]}>Уточняющий вопрос</Text> : null}
        <Text style={[b.bubbleText, mine && { color: '#fff' }]}>{c.body}</Text>
      </View>
      <Text style={b.bubbleMeta}>
        {mine ? 'Вы' : c.author_name.split(' ')[0]} · {formatDate(c.created_at, true)}
      </Text>
    </Animated.View>
  );
}

function HistoryRow({ h, assignees }: { h: HistoryItem; assignees: User[] }) {
  const name = (v: string | null) => assignees.find((a) => String(a.id) === v)?.full_name ?? (v ? `#${v}` : 'не назначен');
  let text: string;
  let icon: SFSymbol = 'circle.fill';
  let color = colors.secondary as string;
  if (h.field === 'status') {
    const s = h.new_value as Status;
    text = `Статус: ${statusMeta[s]?.label ?? h.new_value}`;
    icon = statusMeta[s]?.icon ?? icon;
    color = statusMeta[s]?.color ?? color;
  } else if (h.field === 'priority') {
    text = `Приоритет: ${priorityMeta[h.new_value as Priority]?.label ?? h.new_value}`;
    icon = 'flag';
  } else if (h.field === 'assignee_id') {
    text = `Ответственный: ${name(h.new_value)}`;
    icon = 'person.crop.circle.badge.checkmark';
  } else if (h.field === 'created') {
    text = h.new_value || 'Обращение создано';
    icon = 'plus.circle';
  } else if (h.field === 'is_shared') {
    text = h.new_value === 'True' || h.new_value === 'true' ? 'Отмечено как общая проблема' : 'Снята отметка общей проблемы';
    icon = 'person.3';
  } else if (h.field === 'resolution') {
    text = 'Обновлён результат рассмотрения';
    icon = 'text.badge.checkmark';
  } else {
    text = h.new_value ? `${h.field}: ${h.new_value}` : 'Изменение';
    icon = 'text.badge.checkmark';
  }
  return (
    <View style={b.histRow}>
      <View style={[b.histIcon, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={b.histText}>{text}</Text>
        <Text style={b.histMeta}>
          {h.actor_name} · {formatDate(h.created_at, true)}
        </Text>
      </View>
    </View>
  );
}

function Composer({
  ticket,
  manager,
  bottom,
  onSend,
  onAttach,
}: {
  ticket: TicketDetail;
  manager: boolean;
  bottom: number;
  onSend: (body: string, clarify: boolean) => Promise<boolean>;
  onAttach: (files: PickedFile[]) => Promise<boolean>;
}) {
  // Строка ввода едет вверх вместе с клавиатурой.
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => {
    const h = keyboard.height.value;
    return { transform: [{ translateY: -Math.max(0, h - bottom + 8) }] };
  });
  const [text, setText] = useState('');
  const [clarify, setClarify] = useState(false);
  const [sending, setSending] = useState(false);
  const glass = isLiquidGlassAvailable();
  const Container = glass ? GlassView : View;

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text.trim(), clarify);
    setSending(false);
    if (ok) {
      setText('');
      setClarify(false);
    }
  }

  const placeholder = clarify
    ? 'Что нужно уточнить у автора?'
    : ticket.status === 'AWAITING_CLARIFICATION' && !manager
      ? 'Ответить на вопрос…'
      : 'Комментарий…';

  return (
    <Animated.View style={[b.composerWrap, { paddingBottom: Math.max(bottom, 10) }, lift]} pointerEvents="box-none">
      {manager ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setClarify((v) => !v);
          }}
        >
          <Container
            {...(glass ? { glassEffectStyle: 'regular' as const, isInteractive: true, tintColor: clarify ? '#FF375F' : undefined } : {})}
            style={[b.round, !glass && b.fallback, !glass && clarify && { backgroundColor: '#FF375F' }]}
          >
            <SymbolView name="questionmark" size={18} weight="semibold" tintColor={clarify ? '#fff' : (colors.label as string)} />
          </Container>
        </Pressable>
      ) : null}
      <Container {...(glass ? { glassEffectStyle: 'regular' as const } : {})} style={[b.inputGlass, !glass && b.fallback]}>
        <View style={b.attach}>
          <AttachMenu compact onPick={(files) => onAttach(files)} />
        </View>
        <TextInput style={b.input} placeholder={placeholder} placeholderTextColor={colors.secondary} value={text} onChangeText={setText} multiline />
        <Pressable onPress={send} disabled={!text.trim() || sending} style={[b.send, { backgroundColor: text.trim() ? colors.accent : (colors.fill as string) }]}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <SymbolView name="arrow.up" size={16} weight="bold" tintColor="#fff" />}
        </Pressable>
      </Container>
    </Animated.View>
  );
}

const b = StyleSheet.create({
  head: { paddingHorizontal: 4, paddingTop: 4, gap: 8 },
  kicker: { fontSize: 13, color: colors.secondary, fontWeight: '500' },
  title: { fontSize: 27, fontWeight: '700', color: colors.label, lineHeight: 33, letterSpacing: -0.7 },
  statusCard: { padding: 18, gap: 18, marginTop: 6 },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  updated: { fontSize: 13, color: colors.tertiary },
  owner: { fontSize: 14, color: colors.secondary },
  ownerName: { color: colors.label, fontWeight: '600' },
  note: { flexDirection: 'row', gap: 14, paddingVertical: 4, paddingHorizontal: 4 },
  noteBar: { width: 3, borderRadius: 2 },
  noteTitle: { fontSize: 13, fontWeight: '600', color: colors.secondary },
  noteText: { flex: 1, fontSize: 15, color: colors.label, lineHeight: 22 },
  block: { paddingHorizontal: 4, paddingTop: 8, gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.secondary, marginTop: 8 },
  text: { fontSize: 16, color: colors.label, lineHeight: 25, fontWeight: '400' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  toggleText: { fontSize: 15, color: colors.secondary, fontWeight: '500' },
  details: { paddingHorizontal: 4, gap: 12, paddingBottom: 6 },
  detail: { flexDirection: 'row', gap: 16 },
  detailLabel: { width: 110, fontSize: 14, color: colors.tertiary },
  detailValue: { flex: 1, fontSize: 14, color: colors.label },
  section: { fontSize: 17, fontWeight: '700', color: colors.label, marginTop: 14, marginBottom: 12, paddingHorizontal: 4 },
  muted: { fontSize: 15, color: colors.tertiary, paddingHorizontal: 4 },
  bubbleWrap: { alignItems: 'flex-start', gap: 4 },
  bubble: { maxWidth: '84%', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 22, borderCurve: 'continuous', ...shadow },
  bubbleText: { fontSize: 15, color: colors.label, lineHeight: 21, fontWeight: '400' },
  photo: { width: 220, height: 280, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.fill },
  fileBubble: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileSize: { fontSize: 12, color: colors.tertiary, marginTop: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 60, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bubbleMeta: { fontSize: 11, color: colors.tertiary, paddingHorizontal: 8 },
  clarify: { fontSize: 11, fontWeight: '600', color: '#A6742F', marginBottom: 3, letterSpacing: 0.3 },
  histRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 4 },
  histIcon: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  histText: { fontSize: 14, color: colors.label },
  histMeta: { fontSize: 12, color: colors.tertiary, marginTop: 2 },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  attach: { height: 36, justifyContent: 'center', marginRight: 6 },
  inputGlass: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingLeft: 10, paddingRight: 6, paddingVertical: 6, minHeight: 48 },
  fallback: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  input: { flex: 1, fontSize: 16, color: colors.label, maxHeight: 120, paddingTop: 8, paddingBottom: 8, fontWeight: '400' },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
});
