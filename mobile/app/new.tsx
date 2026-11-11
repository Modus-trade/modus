import { AttachMenu, type PickedFile } from '@/attach';
import { Haptics } from '@/settings';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PressableScale, Text, TextInput } from '@/ui';
import { api, type Category, type TicketType, type User } from '@/api';
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

  useEffect(() => {
    api.categories().then(setCategories).catch((e) => Alert.alert('Ошибка', e.message));
    api.assignees().then(setAssignees).catch(() => undefined);
  }, []);

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
        <Segmented options={TYPES.map((t) => (t === 'PRAISE' ? 'Отзыв' : typeMeta[t].label))} index={TYPES.indexOf(type)} onChange={(i) => setType(TYPES[i])} />

        <Card>
          <View style={f.row}>
            <Text style={[f.rowLabel, { flexShrink: 0 }]}>Категория</Text>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', marginLeft: 12 }}>
              <MenuPicker
                value={categoryId}
                placeholder="Выбрать"
                color={colors.secondary}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={setCategoryId}
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

        <Card>
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
  hint: { fontSize: 13, color: colors.secondary, paddingHorizontal: 4, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 50 },
  rowLabel: { fontSize: 17, color: colors.label },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 17, color: colors.secondary },
  route: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, alignItems: 'center' },
  routeText: { flex: 1, fontSize: 13, color: colors.secondary, lineHeight: 18 },
  title: { fontSize: 17, fontWeight: '600', color: colors.label, paddingHorizontal: 16, height: 50 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 },
  area: { fontSize: 16, color: colors.label, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13, minHeight: 120, lineHeight: 21 },
  fileName: { flex: 1, fontSize: 15, color: colors.label },
});
