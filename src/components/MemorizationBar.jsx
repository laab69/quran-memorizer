import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

const TOTAL_VERSES = 6236;

export default function MemorizationBar({ memorizedIds = [] }) {
  const segments = useMemo(() => {
    if (!memorizedIds || memorizedIds.length === 0) return [];

    // Extracts actual numbers in case the database sends objects
    const cleanIds = memorizedIds.map(item => {
      return typeof item === 'object' && item !== null ? (item.verse_id || item.id) : item;
    }).filter(val => typeof val === 'number' && !isNaN(val));

    if (cleanIds.length === 0) return [];

    const sorted = cleanIds.sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push({ start, end: prev });
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push({ start, end: prev });
    return ranges;
  }, [memorizedIds]);

  return (
    <View style={styles.track}>
      {segments.map((seg, idx) => {
        const leftPercent = ((seg.start - 1) / TOTAL_VERSES) * 100;
        const widthPercent = ((seg.end - seg.start + 1) / TOTAL_VERSES) * 100;

        return (
          <View
            key={idx}
            style={[
              styles.segment,
              {
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 0.2)}%`
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    backgroundColor: '#1e1e3a',
    borderRadius: 5,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  segment: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#2ecc71',
    shadowColor: '#2ecc71',
    shadowRadius: 4,
    shadowOpacity: 0.5,
    borderRadius: 2,
  }
});