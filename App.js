import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth } from './src/firebase';
import CalendarScreen from './src/screens/CalendarScreen';
import LoginScreen from './src/screens/LoginScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import { colors } from './src/theme';

const Tab = createMaterialTopTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="Calendario" tabBar={() => null}>
      <Tab.Screen name="Calendario" component={CalendarScreen} />
      <Tab.Screen name="Masajes" component={ServicesScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  // Metro's web bundler (unlike the old webpack config) doesn't
  // auto-register @expo/vector-icons as web fonts, so icons render as
  // blank boxes on web until explicitly loaded here.
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setCheckingAuth(false);
    });
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {checkingAuth || !fontsLoaded ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : user ? (
          <NavigationContainer>
            <MainTabs />
          </NavigationContainer>
        ) : (
          <LoginScreen />
        )}
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
