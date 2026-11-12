import {
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { attachmentUrl } from './api';
import { Haptics } from './settings';
import { colors } from './theme';
import { Text } from './ui';
import { OPTIONS } from './voice';

const BARS = 26;
const MAX_SECONDS = 300;

export function formatTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Запись голосового для обсуждения: старт, отмена, готово → файл и длительность. */
export function useVoiceMessage(onDone: (uri: string, seconds: number) => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 80);
  const [recording, setRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.1));
  const seconds = (state.durationMillis ?? 0) / 1000;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!recording) return;
    const level = Math.max(0.1, Math.min(1, ((state.metering ?? -60) + 55) / 50));
    setLevels((l) => [...l.slice(1), level]);
  }, [state.metering, state.durationMillis, recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  async function start() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нужен доступ к микрофону', 'Разрешите микрофон в настройках, чтобы записывать голосовые.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Настройки', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setLevels(Array(BARS).fill(0.1));
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      Alert.alert('Не удалось включить микрофон', e instanceof Error ? e.message : '');
    }
  }

  async function stopRecorder() {
    const duration = (recorder.getStatus().durationMillis ?? 0) / 1000;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    setRecording(false);
    return duration;
  }

  async function finish() {
    if (!recording) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const duration = await stopRecorder();
    if (duration < 1 || !recorder.uri) return;
    doneRef.current(recorder.uri, Math.round(duration));
  }

  async function cancel() {
    Haptics.selectionAsync();
    await stopRecorder().catch(() => setRecording(false));
  }

  return { recording, seconds, levels, start, finish, cancel };
}

/** Волна и таймер во время записи — встаёт на место поля ввода. */
export function RecordingBar({ seconds, levels, onCancel }: { seconds: number; levels: number[]; onCancel: () => void }) {
  return (
    <View style={s.bar}>
      <Pressable onPress={onCancel} hitSlop={10} style={s.cancel} accessibilityLabel="Отменить запись">
        <SymbolView name="trash" size={16} tintColor={colors.secondary} />
      </Pressable>
      <View style={s.dot} />
      <View style={s.wave}>
        {levels.map((l, i) => (
          <View key={i} style={[s.waveBar, { height: 4 + l * 22, opacity: 0.35 + l * 0.65 }]} />
        ))}
      </View>
      <Text style={s.timer}>{formatTime(seconds)}</Text>
    </View>
  );
}

/** Голосовое в ленте: кнопка, прогресс, длительность и расшифровка от ИИ. */
export function VoiceBubble({
  audioId,
  seconds,
  transcript,
  mine,
}: {
  audioId: number;
  seconds: number | null;
  transcript: string | null | undefined;
  mine: boolean;
}) {
  const player = useAudioPlayer({ uri: attachmentUrl(audioId) });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration > 0 ? status.duration : seconds ?? 0;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;
  const fg = mine ? '#fff' : (colors.label as string);

  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  async function toggle() {
    Haptics.selectionAsync();
    if (status.playing) return player.pause();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    player.play();
  }

  return (
    <View style={{ gap: 6, minWidth: 200 }}>
      <View style={s.player}>
        <Pressable onPress={toggle} hitSlop={8} style={[s.play, { backgroundColor: mine ? '#ffffff2a' : colors.label }]}>
          <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={14} tintColor={mine ? '#fff' : (colors.card as string)} />
        </Pressable>
        <View style={[s.track, { backgroundColor: mine ? '#ffffff40' : colors.fill }]}>
          <View style={[s.fill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
        </View>
        <Text style={[s.time, { color: mine ? '#ffffffb0' : colors.secondary }]}>
          {formatTime(status.playing || status.currentTime > 0 ? status.currentTime : duration)}
        </Text>
      </View>
      {transcript === null || transcript === undefined ? (
        <Text style={[s.transcript, { color: mine ? '#ffffffa0' : colors.tertiary }]}>Расшифровываем…</Text>
      ) : transcript ? (
        <Text style={[s.transcript, { color: mine ? '#ffffffd0' : colors.secondary }]}>«{transcript}»</Text>
      ) : null}
    </View>
  );
}

const RED = '#e5484d';
const s = StyleSheet.create({
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, minHeight: 36 },
  cancel: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 28 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: RED },
  timer: { fontSize: 15, fontVariant: ['tabular-nums'], color: colors.secondary, minWidth: 36 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  time: { fontSize: 12, fontVariant: ['tabular-nums'] },
  transcript: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
});
