import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useLiveSocket } from '@/live';
import { useUpdateWatcher } from '@/updates';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/auth';
import { NotesProvider } from '@/notes';
import { colors } from '@/theme';
import { fontAssets, headerFonts } from '@/ui';

function RootStack() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useUpdateWatcher(user);
  useLiveSocket(user);
  useEffect(() => {
    // Нажатие на уведомление открывает нужное обращение.
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data?.ticketId;
      if (id) router.push(`/ticket/${id}`);
    });
    return () => sub.remove();
  }, [router]);
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ ...headerFonts, contentStyle: { backgroundColor: colors.background }, animation: 'default' }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="ticket/[id]" options={{ title: '', headerTransparent: true, headerBackButtonDisplayMode: 'minimal' }} />
        <Stack.Screen name="new" options={{ presentation: 'modal', title: 'Новое обращение', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="note" options={{ presentation: 'modal', title: '', headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(fontAssets);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <NotesProvider>
        <RootStack />
      </NotesProvider>
    </AuthProvider>
  );
}
