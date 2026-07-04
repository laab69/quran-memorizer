import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { getVersesForSurah } from '../db/queries';
import { getSurahNameGlyph } from '../srs/utils/fontUtils';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

const END_OF_AYAH = String.fromCodePoint(0x06DD);

function toArabicDigits(num) {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function countMemorizedInRange(set, first, last) {
  let count = 0;
  for (let id = first; id <= last; id++) {
    if (set.has(id)) count++;
  }
  return count;
}

export default function SurahDropdown({ surah, mode, selectedVerseIds, onVerseSelect, onSurahSelect }) {
  const { store } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [verses, setVerses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const isToggling = useRef(false);
  const chevronRotation = useSharedValue(0);
const renderVerseItem = useCallback(({ item: v }) => {
  const isSelected = selectedVerseIds.has(v.id);
  return (
    <TouchableOpacity
      style={[styles.verseRow, isSelected && styles.verseRowSelected]}
      onPress={() => onVerseSelect(v.id)}
    >
      <Text style={styles.verseKey}>
        {END_OF_AYAH + toArabicDigits(v.verse_number)}
      </Text>
      <Text style={styles.verseText} numberOfLines={1}>
        {v.text_uthmani ? v.text_uthmani.split(' ').slice(0, 5).join(' ') + '...' : ''}
      </Text>
    </TouchableOpacity>
  );
}, [selectedVerseIds, onVerseSelect]);
  // Reset when parent list recycles this component for a different surah
  useEffect(() => {
    setExpanded(false);
    setVerses([]);
    setIsLoading(false);
    isToggling.current = false;
    chevronRotation.value = 0;
  }, [surah.id]);

  const toggleExpand = async () => {
    if (isToggling.current) return;
    isToggling.current = true;

    if (!expanded && verses.length === 0) {
      setIsLoading(true);
      try {
        const data = await getVersesForSurah(surah.id);
        setVerses(data ?? []);
      } catch (e) {
        setVerses([]);
      } finally {
        setIsLoading(false);
      }
    }
    const next = !expanded;
    chevronRotation.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 180 });
    setExpanded(next);

    setTimeout(() => { isToggling.current = false; }, 400);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  const handleSurahPress = () => {
    if (mode === 'random') onSurahSelect(surah.id);
  };

  const range = store.surahRanges[surah.id] || { first: 1, last: 1, count: 1 };
  const totalVerses = range.count || 1;
  const memCount = countMemorizedInRange(store.memorizedSet, range.first, range.last);
  const progressPercent = Math.min((memCount / totalVerses) * 100, 100);
  const glyph = getSurahNameGlyph(surah.id);

const allSelected = mode === 'random' && selectedVerseIds.size > 0 &&
  (() => { for (let i = range.first; i <= range.last; i++) { if (!selectedVerseIds.has(i)) return false; } return true; })();

  return (
    <View style={[styles.container, allSelected && styles.containerSelected]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.chevronBtn} onPress={toggleExpand}>
          <Animated.Text style={[styles.chevronText, chevronStyle]}>›</Animated.Text>
        </TouchableOpacity>
        <View style={styles.miniBar}>
          <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 2 }} />
        </View>
        <TouchableOpacity style={styles.surahInfo} onPress={handleSurahPress}>
          <View style={styles.surahTextCol}>
            {glyph ? (
              <Text style={{ fontFamily: 'SurahNames', fontSize: 32, color: theme.white, textAlign: 'right', includeFontPadding: false }}>
                {glyph}
              </Text>
            ) : (
              <Text style={{ fontFamily: 'Amiri', fontSize: 22, color: theme.white, textAlign: 'right' }}>
                {surah.name_arabic}
              </Text>
            )}
            <Text style={styles.verseCount}>{surah.verses_count} آيات</Text>
          </View>
          <View style={styles.numBadge}>
            <Text style={styles.surahNumber}>{surah.id}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.versesContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ paddingVertical: 20 }} />
          ) : verses.length === 0 ? (
            <Text style={styles.loadingText}>لا توجد آيات</Text>
          ) : (<FlatList
  data={verses}
  renderItem={renderVerseItem}
  keyExtractor={(v) => v.id.toString()}
  scrollEnabled={false}
  nestedScrollEnabled={true}
/>
            // <FlatList
            //   data={verses}
            //   renderItem={({ item: v }) => {
            //     const isSelected = selectedVerseIds?.includes(v.id);
            //     return (
            //       <TouchableOpacity
            //         style={[styles.verseRow, isSelected && styles.verseRowSelected]}
            //         onPress={() => onVerseSelect(v.id)}
            //       >
            //         <Text style={styles.verseKey}>
            //           {END_OF_AYAH + toArabicDigits(v.verse_number)}
            //         </Text>
            //         <Text style={styles.verseText} numberOfLines={1}>
            //           {v.text_uthmani ? v.text_uthmani.split(' ').slice(0, 5).join(' ') + '...' : ''}
            //         </Text>
            //       </TouchableOpacity>
            //     );
            //   }}
            //   keyExtractor={(v) => v.id.toString()}
            //   scrollEnabled={false}
            //   nestedScrollEnabled={true}
            // />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundCard,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
  },
  containerSelected: {
    borderColor: 'rgba(201,168,76,0.5)',
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  chevronBtn: { padding: 8, width: 36, alignItems: 'center' },
  chevronText: { color: theme.primary, fontSize: 22 },
  miniBar: { width: 60, height: 4, backgroundColor: theme.cardBorder, borderRadius: 2, marginHorizontal: 12 },
  surahInfo: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  surahTextCol: { alignItems: 'flex-end', marginRight: 12 },
  verseCount: { color: theme.grey, fontSize: 11, marginTop: 2 },
  numBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(201,168,76,0.1)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  surahNumber: { color: theme.primary, fontSize: 13, fontWeight: 'bold' },
  versesContainer: { backgroundColor: '#080810', paddingVertical: 4 },
  loadingText: { color: theme.grey, textAlign: 'center', paddingVertical: 12 },
  verseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: 'rgba(30,30,58,0.8)' },
  verseRowSelected: { backgroundColor: 'rgba(201,168,76,0.08)', borderLeftWidth: 3, borderLeftColor: theme.primary },
  verseKey: { color: theme.primary, fontSize: 14, fontFamily: 'Amiri', minWidth: 44 },
  verseText: { color: theme.greyLight, fontFamily: 'Amiri', fontSize: 17, flex: 1, textAlign: 'right', marginLeft: 16 },
});