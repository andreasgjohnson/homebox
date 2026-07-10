import { Tabs } from 'expo-router';

import { DaybookTabBar } from '@/components/DaybookChrome';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ navigation, state }) => <DaybookTabBar navigation={navigation} state={state} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="archive" />
      <Tabs.Screen name="your-box" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="pair-box" options={{ href: null }} />
      <Tabs.Screen name="people/[name]" options={{ href: null }} />
      <Tabs.Screen name="themes/[name]" options={{ href: null }} />
    </Tabs>
  );
}
