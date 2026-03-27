import { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';
import { getAppBootstrapState } from '../services/profileService';
import { isBiometricEnabled, authenticateWithBiometrics } from '../utils/biometrics';

import HomeScreen from '../screens/HomeScreen';
import HabitsScreen from '../screens/HabitsScreen';
import FinanceScreen from '../screens/FinanceScreen';
import InsightsScreen from '../screens/InsightsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import BiometricScreen from '../screens/BiometricScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 83,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 10,
          marginTop: 2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />, tabBarLabel: 'Home' }} />
      <Tab.Screen name="Hábitos" component={HabitsScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />, tabBarLabel: 'Hábitos' }} />
      <Tab.Screen name="Finanças" component={FinanceScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💶" focused={focused} />, tabBarLabel: 'Finanças' }} />
      <Tab.Screen name="Insights" component={InsightsScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" focused={focused} />, tabBarLabel: 'Insights' }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />, tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [state, setState] = useState('loading');

  useEffect(() => {
    checkInitialState();
  }, []);

  async function checkInitialState() {
    try {
      // 1. Onboarding feito?
      const onboardingDone = await AsyncStorage.getItem('onboarding_done');
      if (!onboardingDone) {
        setState('onboarding');
        return;
      }

      // 2. Sessão ativa?
      const session = await getSession();
      if (!session) {
        setState('auth');
        return;
      }

      // 3. Biometria ativa?
      const biometricEnabled = await isBiometricEnabled();
      if (biometricEnabled) {
        const success = await authenticateWithBiometrics();
        if (!success) {
          setState('auth');
          return;
        }
      }

      // Tudo ok → app principal
      setState('main');
    } catch (e) {
      console.error('Erro ao verificar estado:', e);
      setState('auth');
    }
  }

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>

      {/* Onboarding — só na primeira vez */}
      {state === 'onboarding' && (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </>
      )}

      {/* Auth — sem sessão */}
      {(state === 'auth' || state === 'onboarding') && (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="BiometricSetup" component={BiometricScreen} />
        </>
      )}

      {/* App principal */}
      <Stack.Screen name="Main" component={MainTabs} />

    </Stack.Navigator>
  );
}