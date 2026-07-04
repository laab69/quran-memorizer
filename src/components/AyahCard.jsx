import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../theme';

export default function AyahCard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ayah Card Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: theme.card,
    borderRadius: 16,
  },
  text: {
    color: theme.white,
  }
});
