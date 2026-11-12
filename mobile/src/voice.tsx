import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { api, type VoiceResult } from './api';
import { Haptics } from './settings';
import { colors } from './theme';
import { PressableScale, Text } from './ui';

/** Моно, 16 кГц, 32 кбит/с: речь распознаётся так же, а минута весит ~240 КБ — загрузка почти мгновенная. */
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
};
const MAX_SECONDS = 120;
const BARS = 24;

type Phase = 'idle' | 'recording' | 'processing';

/** Кнопка «Рассказать голосом»: запись → ИИ пишет тему, описание, тип и категорию. */
export function VoiceInput({ onResult, compact }: { onResult: (r: VoiceResult) => void; compact?: boolean }) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 80);
  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const cancelled = useRef(false);
  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);

  // Живая «волна» из уровня громкости микрофона.
  useEffect(() => {
    if (phase !== 'recording') return;
    const db = state.metering ?? -60;
    const level = Math.max(0.08, Math.min(1, (db + 55) / 50));
    setLevels((l) => [...l.slice(1), level]);
  }, [state.metering, state.durationMillis, phase]);

  useEffect(() => {
    if (phase === 'recording' && seconds >= MAX_SECONDS) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase]);

  async function start() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нужен доступ к микрофону', 'Разрешите микрофон в настройках, чтобы надиктовать обращение.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Настройки', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      cancelled.current = false;
      setLevels(Array(BARS).fill(0.08));
      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      Alert.alert('Не удалось включить микрофон', e instanceof Error ? e.message : '');
    }
  }

  async function stopRecorder() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    return recorder.uri;
  }

  async function cancel() {
    cancelled.current = true;
    Haptics.selectionAsync();
    await stopRecorder().catch(() => undefined);
    setPhase('idle');
  }

  async function finish() {
    if (phase !== 'recording') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tooShort = (state.durationMillis ?? 0) < 1200;
    setPhase('processing');
    try {
      const uri = await stopRecorder();
      if (tooShort || !uri) {
        setPhase('idle');
        return Alert.alert('Слишком коротко', 'Нажмите и расскажите, что случилось, хотя бы пару предложений.');
      }
      const audio = await new File(uri).base64();
      const result = await api.voice({ audio_base64: audio, format: 'm4a' });
      if (cancelled.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onResult(result);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Голосовой ввод не сработал', e instanceof Error ? e.message : '');
    } finally {
      setPhase('idle');
    }
  }

  if (phase === 'recording') {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={s.recording}>
        <PressableScale onPress={cancel} hitSlop={10} accessibilityLabel="Отменить запись" style={s.cancel}>
          <SymbolView name="xmark" size={15} tintColor={colors.secondary} />
        </PressableScale>
        <View style={s.wave}>
          {levels.map((l, i) => (
            <View key={i} style={[s.bar, { height: 4 + l * 30, opacity: 0.35 + l * 0.65 }]} />
          ))}
        </View>
        <Text style={s.timer}>{formatTime(seconds)}</Text>
        <PressableScale onPress={finish} accessibilityLabel="Готово" style={s.stop}>
          <Pulse />
          <SymbolView name="stop.fill" size={16} tintColor="#fff" />
        </PressableScale>
      </Animated.View>
    );
  }

  if (phase === 'processing') {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={s.idle}>
        <ActivityIndicator color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.idleTitle}>ИИ разбирает запись…</Text>
          <Text style={s.idleText}>Распознаёт речь, пишет тему и описание, подбирает категорию</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <PressableScale onPress={start} style={[s.idle, compact && s.compact]} accessibilityLabel="Рассказать голосом">
      <View style={s.mic}>
        <SymbolView name="mic.fill" size={18} tintColor="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.idleTitle}>Рассказать голосом</Text>
        {!compact ? <Text style={s.idleText}>Опишите проблему своими словами — ИИ сам заполнит форму, вы только проверите</Text> : null}
      </View>
    </PressableScale>
  );
}

function Pulse() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 2 - scale.value * 1.2 }));
  return <Animated.View style={[StyleSheet.absoluteFill, s.pulse, style]} />;
}

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const RED = '#e5484d';
const s = StyleSheet.create({
  idle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  compact: { paddingVertical: 10 },
  mic: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  idleTitle: { fontSize: 16, fontWeight: '600', color: colors.label },
  idleText: { fontSize: 13, color: colors.secondary, lineHeight: 18, marginTop: 1 },
  recording: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: RED + '55',
  },
  cancel: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  wave: { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 2, backgroundColor: RED },
  timer: { fontSize: 15, fontVariant: ['tabular-nums'], color: colors.secondary, minWidth: 38, textAlign: 'right' },
  stop: { width: 44, height: 44, borderRadius: 22, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  pulse: { borderRadius: 22, backgroundColor: RED + '55' },
});
