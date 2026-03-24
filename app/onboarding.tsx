import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

I18nManager.allowRTL(true);

const ONBOARDING_SEEN_KEY = 'onboarding_seen';

const SLIDES = [
  {
    id: '1',
    emoji: '🗺️',
    title: 'خريطة تفاعلية',
    desc: 'استكشف طولكرم على خريطة واضحة تعرض موقعك ومختلف الأماكن',
  },
  {
    id: '2',
    emoji: '🏪',
    title: 'دليل المتاجر والأماكن',
    desc: 'تصفح المتاجر والمطاعم والصيدليات والخدمات حسب الفئة والقرب منك',
  },
  {
    id: '3',
    emoji: '📍',
    title: 'اكتشف ما حولك',
    desc: 'اعرف المسافة بينك وبين كل مكان واختر الأنسب لك',
  },
];

function saveOnboardingSeen() {
  AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
}

function AnimatedPaginationDot({ isActive }: { isActive: boolean }) {
  const widthAnim = React.useRef(new Animated.Value(isActive ? 24 : 8)).current;
  React.useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: isActive ? 24 : 8,
      tension: 180,
      friction: 14,
      useNativeDriver: false,
    }).start();
  }, [isActive]);
  return (
    <Animated.View
      style={[
        styles.dot,
        styles.dotBase,
        {
          width: widthAnim,
          backgroundColor: isActive ? '#2E86AB' : '#94A3B8',
        },
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSlide = SLIDES[currentIndex];
  const emojiOpacity = useRef(new Animated.Value(1)).current;
  const emojiScale = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslate = useRef(new Animated.Value(0)).current;
  const descOpacity = useRef(new Animated.Value(1)).current;
  const descTranslate = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  const handleNextPress = () => {
    Animated.sequence([
      Animated.timing(btnScale, {
        toValue: 0.95,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        tension: 200,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
    setCurrentIndex(currentIndex + 1);
  };

  useEffect(() => {
    const springConfig = { tension: 80, friction: 12 };
    const duration = 280;

    emojiOpacity.setValue(0);
    emojiScale.setValue(0.3);
    titleOpacity.setValue(0);
    titleTranslate.setValue(20);
    descOpacity.setValue(0);
    descTranslate.setValue(15);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(emojiOpacity, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.spring(emojiScale, {
          toValue: 1.15,
          ...springConfig,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslate, {
          toValue: 0,
          ...springConfig,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(descOpacity, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.spring(descTranslate, {
          toValue: 0,
          ...springConfig,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      Animated.spring(emojiScale, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }).start();
    });
  }, [currentIndex]);

  const handleLogin = () => {
    saveOnboardingSeen();
    router.replace('/(auth)/login');
  };

  const handleRegister = () => {
    saveOnboardingSeen();
    router.replace('/(auth)/register');
  };

  const handleGuest = async () => {
    saveOnboardingSeen();
    await loginAsGuest();
    router.replace('/(main)/map');
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        <View style={styles.slide}>
          <Animated.Text
            style={[
              styles.slideEmoji,
              {
                opacity: emojiOpacity,
                transform: [{ scale: emojiScale }],
              },
            ]}
          >
            {currentSlide.emoji}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.slideTitle,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslate }],
              },
            ]}
          >
            {currentSlide.title}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.slideDesc,
              {
                opacity: descOpacity,
                transform: [{ translateY: descTranslate }],
              },
            ]}
          >
            {currentSlide.desc}
          </Animated.Text>
        </View>
      </View>

      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <AnimatedPaginationDot
            key={i}
            isActive={i === currentIndex}
          />
        ))}
      </View>

      <View style={styles.buttonsContainer}>
        {isLastSlide ? (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
              <Text style={styles.primaryBtnText}>تسجيل الدخول</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRegister}>
              <Text style={styles.secondaryBtnText}>إنشاء حساب</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.guestBtn} onPress={handleGuest}>
              <Text style={styles.guestBtnText}>دخول كضيف</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleNextPress}
          >
            <Animated.View
              style={[
                styles.nextBtn,
                { transform: [{ scale: btnScale }] },
              ]}
            >
              <Text style={styles.nextBtnText}>التالي</Text>
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF5FB',
    paddingTop: 60,
  },
  sliderContainer: {
    flex: 1,
  },
  slide: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A3A5C',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideDesc: {
    fontSize: 16,
    color: '#4A7FA5',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  dotBase: {
    height: 8,
    borderRadius: 4,
  },
  dot: {
    width: 8,
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E86AB',
  },
  secondaryBtnText: {
    color: '#2E86AB',
    fontSize: 16,
    fontWeight: '700',
  },
  guestBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  guestBtnText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
