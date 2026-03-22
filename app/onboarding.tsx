import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ViewToken,
  I18nManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

I18nManager.allowRTL(true);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setCurrentIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

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

  const getItemLayout = (
    _: unknown,
    index: number
  ): { length: number; offset: number; index: number } => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const renderSlide = ({ item }: { item: (typeof SLIDES)[0] }) => (
    <View style={styles.slide}>
      <Text style={styles.slideEmoji}>{item.emoji}</Text>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideDesc}>{item.desc}</Text>
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.sliderContainer}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.id}
          getItemLayout={getItemLayout}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      </View>

      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
            ]}
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
            style={styles.nextBtn}
            onPress={() =>
              flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
              })
            }
          >
            <Text style={styles.nextBtnText}>التالي</Text>
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
    width: SCREEN_WIDTH,
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
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  dotActive: {
    backgroundColor: '#2E86AB',
    width: 24,
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
