import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './src/context/SettingsContext';
import { SyncProvider } from './src/context/SyncContext';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SyncProvider>
          <AuthProvider>
            <StatusBar style="light" backgroundColor="#090D15" />
            <RootNavigator />
          </AuthProvider>
        </SyncProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
