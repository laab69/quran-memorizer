import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import theme from '../theme';

export default function DashboardCard({ title, subtitle, children, onPress }) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 200 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); };

  return (
    <Animated.View style={scaleStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={['#10101e', '#0d0d1a']}
          style={styles.card}
        >
          <View style={styles.topAccent} />
          <View style={styles.accentGlow} />
          <View style={styles.inner}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {children && <View style={styles.content}>{children}</View>}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: theme.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  topAccent: {
    height: 1.5,
    backgroundColor: theme.primary,
  },
  accentGlow: {
    height: 6,
    backgroundColor: theme.primaryGlow,
  },
  inner: {
    padding: 20,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Amiri',
    fontSize: 24,
    color: theme.primary,
    textAlign: 'right',
    textShadowColor: 'rgba(201,168,76,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 13,
    color: theme.grey,
    textAlign: 'right',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  content: {
    width: '100%',
  },
});
