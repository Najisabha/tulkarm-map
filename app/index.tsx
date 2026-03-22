import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const ONBOARDING_SEEN_KEY = 'onboarding_seen';

export default function IndexScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then((seen) => {
      setOnboardingSeen(!!seen);
      if (!seen) router.replace('/onboarding');
    });
  }, []);

  useEffect(() => {
    if (onboardingSeen === false) return;
    if (onboardingSeen === null || isLoading) return;

    if (user) {
      router.replace('/(main)/map');
    } else {
      router.replace('/(auth)/login');
    }
  }, [user, isLoading, onboardingSeen]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2E86AB" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
