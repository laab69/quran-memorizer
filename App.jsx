import React from 'react';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import EntranceScreen from './src/screens/EntranceScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SurahListScreen from './src/screens/SurahListScreen';
import AyahScreen from './src/screens/AyahScreen';
import MemorizationMapScreen from './src/screens/MemorizationMapScreen';
import LevelMapScreen from './src/screens/LevelMapScreen';
import { AppStoreProvider } from './src/store/AppStore';

const Stack = createStackNavigator();

export default function App() {
  const [dbLoaded, setDbLoaded] = React.useState(false);
  let [fontsLoaded] = useFonts({
    Amiri: Amiri_400Regular,
    SurahNames: require('./assets/fonts/surah-names-v4.ttf'),
    AmiriBold: Amiri_700Bold,
  });

  React.useEffect(() => {
    setDbLoaded(true); // Assuming entrance screen handles it now
  }, []);

  if (!fontsLoaded || !dbLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#050A07' }}>
        <StatusBar barStyle="light-content" backgroundColor="#050A07" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#080810" translucent />
      <AppStoreProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Entrance"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Entrance" component={EntranceScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="SurahList" component={SurahListScreen} />
            <Stack.Screen name="AyahScreen" component={AyahScreen} />
            <Stack.Screen name="MemorizationMap" component={MemorizationMapScreen} />
            <Stack.Screen name="LevelMap" component={LevelMapScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </AppStoreProvider>
    </>
  );
}
