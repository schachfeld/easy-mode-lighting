import { Tabs } from "expo-router";
import { LayoutGrid, Settings2, Sparkles } from "lucide-react-native";
import { GlowProvider } from "../../glow";
import { useSession } from "../../session";
import { fonts, useColors } from "../../theme";
import { Overlays, ToastView } from "../../components/Overlays";

export default function HomeLayout() {
  const colors = useColors();
  const { client } = useSession();
  if (!client) return null;
  return (
    <GlowProvider client={client}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accentDark,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.bar,
            borderTopColor: colors.border,
          },
          tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="(rooms)"
          options={{
            title: "Rooms",
            tabBarIcon: ({ color, size }) => (
              <LayoutGrid color={color} size={size - 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="scenes"
          options={{
            title: "Scenes",
            tabBarIcon: ({ color, size }) => (
              <Sparkles color={color} size={size - 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarAccessibilityLabel: "Settings & help",
            tabBarIcon: ({ color, size }) => (
              <Settings2 color={color} size={size - 2} />
            ),
          }}
        />
      </Tabs>
      <Overlays />
      <ToastView />
    </GlowProvider>
  );
}
