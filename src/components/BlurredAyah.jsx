import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { getSurahNameGlyph } from '../srs/utils/fontUtils';
import theme from '../theme';

const END_OF_AYAH = String.fromCodePoint(0x06DD);

function toArabicDigits(num) {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export default function BlurredAyah({ ayah }) {
  const [revealed, setRevealed] = useState(false);
  const blurOpacity = useSharedValue(1);

  if (!ayah) return null;

  const handlePress = () => {
    if (revealed) return;
    blurOpacity.value = withTiming(0, { duration: 300 }, (fin) => {
      if (fin) runOnJS(setRevealed)(true);
    });
  };

  const blurStyle = useAnimatedStyle(() => ({
    opacity: blurOpacity.value,
  }));

  // Parse the text to find the ayah number and append the Uthmani marker to it
  const formattedUthmaniText = ayah.text_uthmani.split(' ').map((word) => {
    const isAyahNum = /^[\u0660-\u0669\d]+$/.test(word);
    // Convert to Arabic digits just in case the DB has standard numbers
    return isAyahNum ? END_OF_AYAH + toArabicDigits(word) : word;
  }).join(' ');

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={handlePress} 
        style={styles.textContainer}
      >
        <Text style={styles.arabicText}>
          {formattedUthmaniText}
        </Text>
        
        {!revealed && (
          <Animated.View style={[styles.blurWrapper, blurStyle]} pointerEvents="none">
            <BlurView 
              tint="dark" 
              intensity={100} 
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill} 
            />
          </Animated.View>
        )}
      </TouchableOpacity>

      <View style={styles.verseKeyRow}>
        {ayah.surah_number && getSurahNameGlyph(ayah.surah_number) && (
          <Text style={styles.surahGlyph}>
            {getSurahNameGlyph(ayah.surah_number)}
          </Text>
        )}
      </View>
      <Text style={styles.translation}>{ayah.translation || ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: theme.backgroundCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 16,
  },
  textContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 8,
    backgroundColor: 'rgba(10, 10, 20, 0.4)',
  },
  arabicText: {
    fontFamily: 'Amiri',
    fontSize: 20,
    color: theme.white,
    lineHeight: 58,
    textAlign: 'center',
    direction: 'rtl',
  },
  blurWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 5,
    backgroundColor: 'rgba(8, 8, 16, 0.75)',
  },
  verseKeyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  surahGlyph: {
    fontFamily: 'SurahNames',
    fontSize: 28,
    color: theme.primary,
    includeFontPadding: false,
  },
  verseKey: {
    color: theme.primary,
    fontSize: 14,
    fontFamily: 'Amiri',
    textAlign: 'center',
  },
  translation: {
    color: theme.grey,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
