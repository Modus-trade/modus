import { NativeTabs } from 'expo-router/native-tabs';
import { useAuth, isManager } from '@/auth';
import { colors } from '@/theme';
import { fonts } from '@/ui';

// Нативный UITabBar: на iOS 26 он автоматически рендерится в стиле Liquid Glass,
// сворачивается при прокрутке, а вкладка «Поиск» выносится отдельной стеклянной кнопкой.
export default function TabsLayout() {
  const { user } = useAuth();
  return (
    <NativeTabs
      tintColor={colors.accent}
      iconColor={{ default: colors.secondary, selected: colors.accent }}
      labelStyle={{ default: { fontFamily: fonts[600], fontSize: 10, color: colors.secondary }, selected: { fontFamily: fonts[700], fontSize: 10, color: colors.accent } }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Обзор</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(tickets)">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray.full', selected: 'tray.full.fill' }} md="inbox" />
        <NativeTabs.Trigger.Label>{isManager(user) ? 'Входящие' : 'Обращения'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(notes)">
        <NativeTabs.Trigger.Icon sf={{ default: 'note.text', selected: 'note.text' }} md="sticky_note_2" />
        <NativeTabs.Trigger.Label>Заметки</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Профиль</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Поиск</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
