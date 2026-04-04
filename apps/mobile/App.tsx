import './global.css';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { RecordScreen } from './src/components/RecordScreen';
import { JotGallery } from './src/components/JotGallery';
import { useJotStore } from './src/store';
import { getDb } from './src/db';

export default function App() {
  const { view, loadJots, loadApiKeys } = useJotStore();

  const [fontsLoaded, fontError] = useFonts({
    DMSans: DMSans_400Regular,
    DMSansSemiBold: DMSans_600SemiBold,
    DMSansBold: DMSans_700Bold,
    SpaceMono: SpaceMono_400Regular,
  });

  useEffect(() => {
    getDb().then(() => Promise.all([loadJots(), loadApiKeys()])).catch(console.error);
  }, []);

  // Render with system fonts if custom fonts fail (e.g. no network in Tauri)
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1 }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {view === 'record' ? <RecordScreen /> : <JotGallery />}
    </GestureHandlerRootView>
  );
}
