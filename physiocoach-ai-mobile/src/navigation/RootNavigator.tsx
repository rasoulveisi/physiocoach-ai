import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Calendar,
  Compass,
  Dumbbell,
  Home,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { fontSize } from '../theme/typography';
import type { MainTabParamList, RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import MyPlanScreen from '../screens/MyPlanScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import ExploreScreen from '../screens/ExploreScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CalculatorScreen from '../screens/tools/CalculatorScreen';
import PrehabScreen from '../screens/explore/PrehabScreen';
import LiveSessionScreen from '../screens/session/LiveSessionScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, LucideIcon> = {
  Dashboard: Home,
  MyPlan: Calendar,
  Workout: Dumbbell,
  Explore: Compass,
  Settings: Settings,
};

/** Navigation theme: keeps transitions/headers on the Precision Dark canvas. */
const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accentVolt,
    background: colors.bgPrimary,
    card: colors.bgSurface,
    text: colors.textPrimary,
    border: colors.borderSubtle,
    notification: colors.accentAmber,
  },
};

/** Full-screen dark loader shown while the persisted session is restored. */
function BootSplash() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={colors.accentVolt} />
    </View>
  );
}

/** Post-login tab shell, hosted inside the root stack as "MainTabs". */
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accentVolt,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const Icon = TAB_ICONS[route.name as keyof MainTabParamList];
          // Workout tab gets an elevated, highlighted treatment.
          if (route.name === 'Workout') {
            return (
              <View style={[styles.workoutBadge, focused && styles.workoutBadgeActive]}>
                <Icon size={size - 2} color={focused ? colors.accentVolt : colors.textMuted} strokeWidth={2.2} />
              </View>
            );
          }
          return <Icon size={size} color={color} strokeWidth={focused ? 2.2 : 1.8} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="MyPlan" component={MyPlanScreen} options={{ title: 'My Plan' }} />
      <Tab.Screen
        name="Workout"
        component={WorkoutScreen}
        options={{ title: 'Workout', tabBarLabelStyle: styles.workoutLabel }}
      />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  return (
    <NavigationContainer theme={navigationTheme}>
      {isLoading ? (
        <BootSplash />
      ) : isAuthenticated ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs" component={MainTabs} />
          <RootStack.Screen
            name="Calculator"
            component={CalculatorScreen}
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="Prehab"
            component={PrehabScreen}
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
          <RootStack.Screen
            name="LiveSession"
            component={LiveSessionScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
          />
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgPrimary,
  },
  tabBar: {
    backgroundColor: colors.bgSurface,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  workoutBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  workoutBadgeActive: {
    backgroundColor: 'rgba(16, 231, 96, 0.14)',
    borderColor: 'rgba(16, 231, 96, 0.35)',
  },
  workoutLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});

export default RootNavigator;
