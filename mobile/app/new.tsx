import { AttachMenu, type PickedFile } from '@/attach';
import { Haptics } from '@/settings';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PressableScale, Text, TextInput } from '@/ui';
import { api, firstImageBase64, type Category, type Suggestion, type TicketType, type User, type VoiceResult } from '@/api';
import { VoiceInput } from '@/voice';
import { Card, layout, styles } from '@/components';
import { MenuPicker, Segmented } from '@/native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, typeMeta } from '@/theme';

const TYPES: TicketType[] = ['PROBLEM', 'PROPOSAL', 'PRAISE'];


export default function NewTicket() {
  const router = useRouter();
  const [type, setType] = useState<TicketType>('PROBLEM');
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignees, setAssignees] = useState<User[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [solution, setSolution] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  // Подсказка типа и категории. То, что сотрудник выбрал сам, она не перезаписывает.
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [hinting, setHinting] = useState(false);
  const manual = useRef({ type: false, category: false });
  const hintSeq = useRef(0);
  // Голосовой ввод: что было до него (чтобы вернуть) и текст, по которому подсказка уже есть.
  const [voice, setVoice] = useState<{ result: VoiceResult; before: { title: string; description: string; type: TicketType; categoryId: number | null } } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const hintedText = useRef('');

  useEffect(() => {
    api.categories().then(setCategories).catch((e) => Alert.alert('Ошибка', e.message));
    api.assignees().then(setAssignees).catch(() => undefined);
  }, []);

  const imageKey = files.map((f) => f.uri).join('|');
  useEffect(() => {
    if (hintedText.current === title + '\n' + description) return;
    const id = ++hintSeq.current;
    if (title.trim().length + description.trim().length < 20) {
      // Текст стёрли — убираем устаревшую подсказку и то, что она подставила.
      setHint(null);
      setHinting(false);
      if (!manual.current.category) setCategoryId(null);
      return;
    }
    const timer = setTimeout(async () => {
      setHinting(true);
      try {
        const s = await api.suggest({ title, description, image_base64: await firstImageBase64(files) });
        if (id !== hintSeq.current) return;
        setHint(s);
        if (!manual.current.type) setType(s.type);
        if (!manual.current.category) setCategoryId(s.category_id);
      } catch {
        // Подсказка необязательна.
      } finally {
        if (id === hintSeq.current) setHinting(false);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, imageKey]);

  function applyVoice(r: VoiceResult) {
    setVoice({ result: r, before: { title, description, type, categoryId } });
    setShowTranscript(false);
    hintSeq.current++;
    hintedText.current = r.title + '\n' + r.description;
    setTitle(r.title);
    setDescription(r.description);
    setHint(r.suggestion);
    setHinting(false);
    if (!manual.current.type) setType(r.suggestion.type);
    if (!manual.current.category && r.suggestion.category_id) setCategoryId(r.suggestion.category_id);
  }

  function undoVoice() {
    if (!voice) return;
    Haptics.selectionAsync();
    const b = voice.before;
    hintedText.current = '';
    setTitle(b.title);
    setDescription(b.description);
    setType(b.type);
    setCategoryId(b.categoryId);
    setHint(null);
    setVoice(null);
  }

  function applyHint() {
    if (!hint) return;
    Haptics.selectionAsync();
    setType(hint.type);
    if (hint.category_id) setCategoryId(hint.category_id);
  }

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const assignee = useMemo(
    () => (category?.default_assignee_id ? assignees.find((a) => a.id === category.default_assignee_id) : undefined),
    [category, assignees],
  );

  const problems = [
    !categoryId && 'категорию',
    title.trim().length < 3 && 'тему (от 3 символов)',
    description.trim().length < 10 && 'описание (от 10 символов)',
  ].filter(Boolean) as string[];


  async function submit() {
    if (problems.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Заполните обращение', `Укажите ${problems.join(', ')}.`);
    }
    setBusy(true);
    try {
      const ticket = await api.create({
        type,
        category_id: categoryId!,
        title: title.trim(),
        description: description.trim(),
        proposed_solution: solution.trim() || null,
      });
      const failed: string[] = [];
      for (const f of files) await api.upload(ticket.id, f).catch(() => failed.push(f.name));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismiss();
      router.push(`/ticket/${ticket.id}`);
      if (failed.length) Alert.alert('Не все файлы загружены', failed.join('\n'));
    } catch (e) {
      Alert.alert('Не удалось отправить', e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Отмена" onPress={() => router.dismiss()} />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {busy ? (
          <Stack.Toolbar.View>
            <ActivityIndicator style={{ width: 36 }} />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button icon="arrow.up" variant="prominent" tintColor={colors.accent} accessibilityLabel="Отправить" onPress={submit} />
        )}
      </Stack.Toolbar>
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <VoiceInput onResult={applyVoice} compact={!!voice || title.length > 0} />

        {voice ? (
          <Animated.View entering={FadeInDown.duration(300)} style={f.voice}>
            <View style={f.voiceHead}>
              <SymbolView name="waveform" size={15} tintColor={colors.accent} />
              <Text style={f.voiceText}>Заполнено по голосу — проверьте и поправьте, если нужно</Text>
            </View>
            <View style={f.voiceActions}>
              <PressableScale onPress={() => setShowTranscript((v) => !v)} style={f.voiceBtn}>
                <Text style={f.voiceBtnText}>{showTranscript ? 'Скрыть запись' : 'Что я сказал'}</Text>
              </PressableScale>
              <PressableScale onPress={undoVoice} style={f.voiceBtn}>
                <Text style={f.voiceBtnText}>Вернуть как было</Text>
              </PressableScale>
            </View>
            {showTranscript ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={f.transcript}>«{voice.result.transcript}»</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        <Card style={voice ? f.filled : undefined}>
          <TextInput style={f.title} placeholder="Тема" placeholderTextColor={colors.tertiary} value={title} onChangeText={setTitle} maxLength={250} />
          <View style={f.sep} />
          <TextInput
            style={f.area}
            placeholder={type === 'PRAISE' ? 'Что понравилось?' : 'Опишите ситуацию'}
            placeholderTextColor={colors.tertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </Card>

        {hint || hinting ? (
          <Animated.View entering={FadeIn.duration(300)} style={f.hint}>
            <SymbolView name="sparkles" size={17} tintColor={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              {hint ? (
                <>
                  <Text style={f.hintTitle}>
                    {(hint.type === 'PRAISE' ? 'Отзыв' : typeMeta[hint.type].label) + (hint.category ? ` · ${hint.category}` : '')}
                  </Text>
                  {hint.reason ? <Text style={f.hintText}>«{hint.reason}»</Text> : null}
                  {!hint.category_id ? <Text style={f.hintText}>Категорию не удалось определить — выберите ниже</Text> : null}
                  <Text style={f.hintSource}>{hint.source === 'ai' ? 'Подобрано ИИ' : 'Подобрано автоматически'} · можно поменять</Text>
                </>
              ) : (
                <Text style={f.hintText}>Подбираем тип и категорию…</Text>
              )}
            </View>
            {hint && (hint.type !== type || (hint.category_id && hint.category_id !== categoryId)) ? (
              <PressableScale onPress={applyHint} style={f.hintApply}>
                <Text style={f.hintApplyText}>Применить</Text>
              </PressableScale>
            ) : null}
          </Animated.View>
        ) : null}

        <Segmented options={TYPES.map((t) => (t === 'PRAISE' ? 'Отзыв' : typeMeta[t].label))} index={TYPES.indexOf(type)} onChange={(i) => { manual.current.type = true; setType(TYPES[i]); }} />

        <Card>
          <View style={f.row}>
            <Text style={[f.rowLabel, { flexShrink: 0 }]}>Категория</Text>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', marginLeft: 12 }}>
              <MenuPicker
                value={categoryId}
                placeholder="Выбрать"
                color={colors.secondary}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => { manual.current.category = true; setCategoryId(v); }}
              />
            </View>
          </View>
        </Card>

        {category ? (
          <View style={f.route}>
                        <Text style={f.routeText}>
              {assignee ? `Получит ${assignee.full_name} · ответ до ${category.sla_first_response_hours} ч` : 'Ответственного назначит администратор'}
            </Text>
          </View>
        ) : null}

        {type !== 'PRAISE' ? (
          <Card>
            <TextInput
              style={f.area}
              placeholder="Как можно решить? (необязательно)"
              placeholderTextColor={colors.tertiary}
              value={solution}
              onChangeText={setSolution}
              multiline
              textAlignVertical="top"
            />
          </Card>
        ) : null}

        <Card>
          {files.map((file, i) => (
            <View key={file.uri + i} style={f.row}>
              <SymbolView name={file.mimeType?.startsWith('image/') ? 'photo' : 'doc'} size={18} tintColor={colors.secondary} />
              <Text style={f.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable hitSlop={10} onPress={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                <SymbolView name="xmark.circle.fill" size={20} tintColor={colors.tertiary as string} />
              </Pressable>
            </View>
          ))}
          <View style={f.row}>
            <AttachMenu label="Прикрепить фото или файл" onPick={(picked) => setFiles((all) => [...all, ...picked])} />
          </View>
        </Card>
      </ScrollView>
    </>
  );
}

const f = StyleSheet.create({
  options: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingVertical: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 10 },
  optionText: { flex: 1, fontSize: 15, color: colors.secondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 50 },
  rowLabel: { fontSize: 17, color: colors.label },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 17, color: colors.secondary },
  route: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, alignItems: 'center' },
  routeText: { flex: 1, fontSize: 13, color: colors.secondary, lineHeight: 18 },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  hintTitle: { fontSize: 15, fontWeight: '600', color: colors.label },
  hintText: { fontSize: 13, color: colors.secondary, lineHeight: 18 },
  hintSource: { fontSize: 12, color: colors.tertiary },
  hintApply: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.accent },
  hintApplyText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  title: { fontSize: 17, fontWeight: '600', color: colors.label, paddingHorizontal: 16, height: 50 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 },
  area: { fontSize: 16, color: colors.label, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, minHeight: 120, lineHeight: 21 },
  voice: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.accent + '10' },
  voiceHead: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  voiceText: { flex: 1, fontSize: 13, color: colors.label, lineHeight: 18 },
  voiceActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  voiceBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card },
  voiceBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  transcript: { fontSize: 13, color: colors.secondary, lineHeight: 18, fontStyle: 'italic' },
  filled: { borderWidth: 1, borderColor: colors.accent + '40' },
  fileName: { flex: 1, fontSize: 15, color: colors.label },
});
