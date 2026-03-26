import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function useFadeInUp(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return { opacity, transform: [{ translateY }] };
}

export function useSpring() {
  const scale = useRef(new Animated.Value(1)).current;

  function trigger() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, speed: 50, bounciness: 0, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 12, useNativeDriver: true }),
    ]).start();
  }

  return { scale, trigger };
}

export function usePulse() {
  const scale = useRef(new Animated.Value(1)).current;

  function pulse() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 120, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 10, useNativeDriver: true }),
    ]).start();
  }

  return { scale, pulse };
}

export function useShake() {
  const translateX = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(translateX, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  return { translateX, shake };
}