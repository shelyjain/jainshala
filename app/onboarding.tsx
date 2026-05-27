import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLogo } from '@/components/app-logo';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🕉️',
    title: 'Welcome to Jain Shala',
    subtitle: 'Your personal path through the sacred sutras of the Jain tradition.',
    color: '#fdf8f4',
    accent: '#a0522d',
  },
  {
    emoji: '📖',
    title: 'Read',
    subtitle: 'Start with each sutra — read the transliteration and English meaning line by line.',
    color: '#fdf8f4',
    accent: '#a0522d',
    step: 1,
  },
  {
    emoji: '🎧',
    title: 'Listen',
    subtitle: 'Use flashcards with Hindi audio to hear each line spoken aloud. Words highlight as they\'re read.',
    color: '#fdf8f4',
    accent: '#a0522d',
    step: 2,
  },
  {
    emoji: '❓',
    title: 'Quiz · Level 1',
    subtitle: 'Match each English meaning to the correct transliterated line — pick from four options.',
    color: '#fdf8f4',
    accent: '#a0522d',
    step: 3,
  },
  {
    emoji: '✏️',
    title: 'Fill · Level 2',
    subtitle: 'Restore missing words in each line from the word bank.',
    color: '#fdf8f4',
    accent: '#a0522d',
    step: 4,
  },
  {
    emoji: '🔢',
    title: 'Order · Level 3',
    subtitle: 'Put every line in the correct sequence — the hardest challenge.',
    color: '#fdf8f4',
    accent: '#a0522d',
    step: 5,
  },
  {
    emoji: '🏅',
    title: 'Earn Badges',
    subtitle: 'Complete all four steps for a sutra to earn your badge. Track every sutra you\'ve mastered.',
    color: '#fdf8f4',
    accent: '#a0522d',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const emojiScaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / SLIDES.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentIndex]);

  // Bounce the emoji on each new slide
  useEffect(() => {
    emojiScaleAnim.setValue(0.6);
    Animated.spring(emojiScaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  const transitionTo = (nextIndex: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -40, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(nextIndex);
      slideAnim.setValue(40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      transitionTo(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    router.replace('/');
  };

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Step badge */}
        {'step' in slide && (
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {slide.step} of 4</Text>
          </View>
        )}

        {/* Logo on welcome slide; emoji on feature slides */}
        <Animated.View
          style={[styles.heroVisual, { transform: [{ scale: emojiScaleAnim }] }]}
        >
          {currentIndex === 0 ? (
            <AppLogo size={128} />
          ) : (
            <Text style={styles.emoji}>{slide.emoji}</Text>
          )}
        </Animated.View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        {/* Visual demo for the pathway */}
        {currentIndex === 0 && (
          <View style={styles.pathwayPreview}>
            {['📖 Read', '🎧 Listen', '❓ Quiz', '✏️ Fill', '🔢 Order'].map((s, i) => (
              <View key={i} style={styles.pathwayItem}>
                <View style={styles.pathwayBubble}>
                  <Text style={styles.pathwayBubbleText}>{s}</Text>
                </View>
                {i < 3 && <Text style={styles.pathwayArrow}>→</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Badge preview on last slide */}
        {isLast && (
          <View style={styles.badgePreview}>
            {['🏅', '🏅', '🏅'].map((b, i) => (
              <View key={i} style={[styles.badgeCard, { opacity: 1 - i * 0.25 }]}>
                <Text style={styles.badgeEmoji}>{b}</Text>
                <Text style={styles.badgeLabel}>Sutra {i + 1}</Text>
              </View>
            ))}
            <View style={[styles.badgeCard, { opacity: 0.3 }]}>
              <Text style={styles.badgeEmoji}>🔒</Text>
              <Text style={styles.badgeLabel}>Locked</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Bottom button */}
      <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextBtnText}>
          {isLast ? 'Start Learning 🕉️' : 'Next →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdf8f4',
    paddingTop: 60,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 28,
    zIndex: 10,
  },
  skipText: {
    fontSize: 15,
    color: '#bbb',
    fontWeight: '500',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#f0ebe3',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#a0522d',
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 40,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0d8d0',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#a0522d',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadge: {
    backgroundColor: '#f0ebe3',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 24,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a0522d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroVisual: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  pathwayPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  pathwayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pathwayBubble: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#a0522d',
  },
  pathwayBubbleText: {
    fontSize: 13,
    color: '#a0522d',
    fontWeight: '600',
  },
  pathwayArrow: {
    fontSize: 14,
    color: '#ccc',
    marginHorizontal: 2,
  },
  badgePreview: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  badgeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0ebe3',
    minWidth: 70,
  },
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeLabel: {
    fontSize: 11,
    color: '#a0522d',
    fontWeight: '600',
  },
  nextBtn: {
    backgroundColor: '#a0522d',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});