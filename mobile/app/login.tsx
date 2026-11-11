import { Haptics } from '@/settings';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useAuth } from '@/auth';
import { Logo } from '@/logo';
import { colors } from '@/theme';
import { fonts, PressableScale, Text } from '@/ui';

const DEMO = [
  { label: 'Сотрудник', email: 'employee@modus.demo' },
  { label: 'Руководитель', email: 'manager.procurement@modus.demo' },
  { label: 'Админ', email: 'admin@modus.demo' },
];

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const rise = (i: number) => FadeInDown.delay(150 + i * 90).duration(700).easing(ease).withInitialValues({ transform: [{ translateY: 16 }] });

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const passwordRef = useRef<ComponentRef<typeof RNTextInput>>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  async function submit(e = email, p = password) {
    if (!e.trim() || !p) return fail('Введите почту и пароль');
    if (!/^\S+@\S+\.\S+$/.test(e.trim())) return fail('Проверьте адрес почты');
    setBusy(true);
    setError(null);
    try {
      await login(e, p);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      fail(status === 0 ? 'Нет связи с сервером' : status === 401 || status === 422 ? 'Неверная почта или пароль' : 'Не удалось войти, попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  function fail(message: string) {
    setError(message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shake.value = withSequence(...[8, -8, 6, -6, 3, 0].map((v) => withTiming(v, { duration: 55 })));
  }

  return (
    <View style={s.root}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" bounces={false}>
          <Animated.View entering={FadeIn.duration(800)} style={s.logo}>
            <Logo width={190} />
          </Animated.View>

          <Animated.View entering={rise(2)}>
            <Animated.View style={[s.form, shakeStyle]}>
              <Field
                label="Почта"
                active={focus === 'email'}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                onFocus={() => setFocus('email')}
                onBlur={() => setFocus(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Field
                inputRef={passwordRef}
                label="Пароль"
                active={focus === 'password'}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                onFocus={() => setFocus('password')}
                onBlur={() => setFocus(null)}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => submit()}
              />
            </Animated.View>
          </Animated.View>

          <View style={s.errorBox}>
            {error ? (
              <Animated.Text entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={s.error}>
                {error}
              </Animated.Text>
            ) : null}
          </View>

          <Animated.View entering={rise(3)}>
            <PressableScale onPress={() => submit()} disabled={busy} style={s.button}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Войти</Text>}
            </PressableScale>
          </Animated.View>

          <Animated.View entering={rise(4)} style={s.demo}>
            <Text style={s.demoTitle}>Демо-вход</Text>
            <View style={s.demoRow}>
              {DEMO.map((d, i) => (
                <View key={d.email} style={s.demoItem}>
                  {i > 0 ? <View style={s.demoSep} /> : null}
                  <PressableScale
                    hitSlop={8}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEmail(d.email);
                      setPassword('demo1234');
                      submit(d.email, 'demo1234');
                    }}
                  >
                    <Text style={s.demoLink}>{d.label}</Text>
                  </PressableScale>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  active,
  inputRef,
  ...props
}: React.ComponentProps<typeof RNTextInput> & { label: string; active: boolean; inputRef?: React.Ref<ComponentRef<typeof RNTextInput>> }) {
  const line = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? colors.label : '#DDE3E9', { duration: 220 }),
    transform: [{ scaleY: withTiming(active ? 1.5 : 1, { duration: 220 }) }],
  }));
  return (
    <View style={s.field}>
      <Text style={[s.label, active && { color: colors.label }]}>{label}</Text>
      <RNTextInput ref={inputRef} style={s.input} placeholderTextColor={colors.tertiary} selectionColor={colors.accent} {...props} />
      <Animated.View style={[s.line, line]} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFBFC' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  logo: { alignItems: 'center' },
  form: { marginTop: 56, gap: 22 },
  field: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.tertiary, letterSpacing: 0.3 },
  input: { height: 40, fontSize: 17, color: colors.label, fontFamily: fonts[500] },
  line: { height: 1, borderRadius: 1 },
  errorBox: { height: 36, justifyContent: 'flex-end' },
  error: { color: '#C6474F', fontSize: 14, fontFamily: fonts[500] },
  button: { marginTop: 18, height: 54, borderRadius: 16, backgroundColor: '#0B2D48', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  demo: { marginTop: 36, alignItems: 'center', gap: 10 },
  demoTitle: { fontSize: 12, color: colors.tertiary },
  demoRow: { flexDirection: 'row', alignItems: 'center' },
  demoItem: { flexDirection: 'row', alignItems: 'center' },
  demoSep: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.tertiary, marginHorizontal: 12 },
  demoLink: { fontSize: 14, fontWeight: '600', color: colors.secondary },
});
