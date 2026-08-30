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
 * Params for the auth stack (pre-login surface).
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AuthStackRouteName = keyof AuthStackParamList;

/** Params accepted by the Explore tool stack (pushed from the Explore tab). */
export type ExploreToolParamList = {
  Calculator: undefined;
  Prehab: undefined;
};

/** Optional params accepted by the LiveSession route. */
export interface LiveSessionParams {
  /** The plan to run the session against; falls back to the active plan. */
  plan?: unknown;
  /** 1-based index of the scheduled day within the plan. */
  dayIndex?: number;
  /** Display name of the scheduled day (e.g. "Push"). */
  dayName?: string;
}

/**
 * Root stack — hosts the auth stack pre-login and the tab shell post-login;
 * LiveSession is pushed as a full-screen modal above the tabs. Explore tools
 * (Calculator, Prehab) are pushed as card screens from the Explore tab.
 */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  LiveSession: LiveSessionParams | undefined;
  Calculator: ExploreToolParamList['Calculator'];
  Prehab: ExploreToolParamList['Prehab'];
};

export type RootStackRouteName = keyof RootStackParamList;

declare global {
  namespace ReactNavigation {
    // Augment the base types so navigation prop helpers are typed app-wide.
    interface RootParamList extends RootStackParamList {}
  }
}
