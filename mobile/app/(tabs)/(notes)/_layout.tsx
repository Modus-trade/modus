import { Stack } from 'expo-router';
import { colors } from '@/theme';
import { headerFonts } from '@/ui';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        ...headerFonts,
        headerLargeTitleShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Заметки' }} />
    </Stack>
  );
}
