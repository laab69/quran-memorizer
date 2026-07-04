import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../theme';

export default function StrengthMeter({ reviewCount }) {
  let color, label;
  if (reviewCount >= 5) { color = theme.secondary; label = 'محفوظ'; }
  else if (reviewCount >= 1) { color = '#f1c40f'; label = 'قيد الحفظ'; }
  else { color = theme.error; label = 'جديد'; }

  const dots = [
    reviewCount >= 1 ? color : '#1e1e3a',
    reviewCount >= 3 ? color : '#1e1e3a',
    reviewCount >= 5 ? color : '#1e1e3a',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {dots.map((c, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: c, shadowColor: c, shadowOpacity: c !== '#1e1e3a' ? 0.6 : 0, shadowRadius: 4 }]} />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 6 },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
});
