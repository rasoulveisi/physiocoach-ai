import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Params for the bottom tab navigator (the app's main surface).
 */
export type MainTabParamList = {
  Dashboard: undefined;
  MyPlan: undefined;
  Workout: undefined;
  Explore: undefined;
  Settings: undefined;
};

export type MainTabRouteName = keyof MainTabParamList;

/**
 * Root stack — currently hosts the tab shell; later phases push
 * modals (e.g. active WorkoutSession) above the tabs.
 */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
};

export type RootStackRouteName = keyof RootStackParamList;

declare global {
  namespace ReactNavigation {
    // Augment the base types so navigation prop helpers are typed app-wide.
    interface RootParamList extends RootStackParamList {}
  }
}
