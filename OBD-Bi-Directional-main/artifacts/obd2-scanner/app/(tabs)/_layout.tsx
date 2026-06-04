import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "gauge", selected: "gauge.with.needle.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dtc">
        <Icon sf={{ default: "exclamationmark.triangle", selected: "exclamationmark.triangle.fill" }} />
        <Label>DTCs</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="service">
        <Icon sf={{ default: "wrench.and.screwdriver", selected: "wrench.and.screwdriver.fill" }} />
        <Label>Service</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bidirectional">
        <Icon sf={{ default: "arrow.left.arrow.right", selected: "arrow.left.arrow.right.circle.fill" }} />
        <Label>Bi-Di</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="vehicle">
        <Icon sf={{ default: "car", selected: "car.fill" }} />
        <Label>Vehicle</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pcm">
        <Icon sf={{ default: "cpu", selected: "cpu.fill" }} />
        <Label>PCM</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="secrets">
        <Icon sf={{ default: "bolt", selected: "bolt.fill" }} />
        <Label>Secrets</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: "Inter_500Medium",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="gauge" tintColor={color} size={20} /> : <MaterialCommunityIcons name="gauge" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dtc"
        options={{
          title: "DTCs",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="exclamationmark.triangle" tintColor={color} size={20} /> : <Feather name="alert-triangle" size={18} color={color} />,
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          title: "Service",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="wrench.and.screwdriver" tintColor={color} size={20} /> : <MaterialCommunityIcons name="wrench-outline" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bidirectional"
        options={{
          title: "Bi-Di",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="arrow.left.arrow.right" tintColor={color} size={20} /> : <MaterialCommunityIcons name="swap-horizontal" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vehicle"
        options={{
          title: "Vehicle",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="car" tintColor={color} size={20} /> : <MaterialCommunityIcons name="car" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pcm"
        options={{
          title: "PCM",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="cpu" tintColor={color} size={20} /> : <MaterialCommunityIcons name="cpu-64-bit" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="secrets"
        options={{
          title: "Secrets",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="bolt" tintColor={color} size={20} /> : <MaterialCommunityIcons name="lightning-bolt" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
