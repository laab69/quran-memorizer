import { FlashList } from '@shopify/flash-list';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import MemorizationBar from '../components/MemorizationBar';
import StrengthMeter from '../components/StrengthMeter';
import { getReviewCount, getVersesForSurah } from '../db/queries';
import { getSurahNameGlyph } from '../srs/utils/fontUtils';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

function countMemorizedInRange(set, first, last) {
  let count = 0;
  for (let id = first; id <= last; id++) {
    if (set.has(id)) count++;
  }
  return count;
}

function VerseRow({ verse, isMem }) {
  const [rc, setRc] = useState(0);
  useEffect(() => { if (isMem) getReviewCount(verse.id).then(c => setRc(c)); }, [isMem]);
  const preview = verse.text_uthmani ? verse.text_uthmani.split(' ').slice(0, 6).join(' ') + '...' : '';
  return (
    <View style={[rStyles.row, isMem && rStyles.rowMem]}>
      {isMem && <View style={rStyles.accent} />}
      <View style={rStyles.inner}>
        <View style={rStyles.keyWrap}>
          {isMem && <Text style={rStyles.greenDot}>●</Text>}
          <Text style={rStyles.key}>{verse.verse_key}</Text>
          {isMem && <View style={rStyles.strengthWrap}><StrengthMeter reviewCount={rc} /></View>}
        </View>
        <Text style={rStyles.text} numberOfLines={1}>{preview}</Text>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: theme.cardBorder },
  rowMem: { backgroundColor: '#12122a' },
  accent: { width: 3, alignSelf: 'stretch', backgroundColor: theme.primary, borderRadius: 2, marginRight: 8 },
  inner: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  keyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greenDot: { color: theme.secondary, fontSize: 10 },
  key: { color: theme.primary, fontSize: 13 },
  strengthWrap: { marginLeft: 6, transform: [{ scale: 0.75 }] },
  text: { color: theme.white, fontFamily: 'Amiri', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 12 },
});

function SurahRow({ surah }) {
  const { store } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [verses, setVerses] = useState([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const isToggling = useRef(false);
const chevronRotation = useSharedValue(0);
  // 👇 This is the fix — reset when FlashList recycles this row for a different surah
  useEffect(() => {
    setExpanded(false);
    setVerses([]);
    setLoadingVerses(false);
    isToggling.current = false;
    chevronRotation.value = 0;
  }, [surah.id]);

  // ... rest of component


  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));
 // add this

const toggleExpand = async () => {
  if (isToggling.current) return; // 👈 block rapid taps
  isToggling.current = true;

  if (!expanded && verses.length === 0) {
    if (loadingVerses) return;
    setLoadingVerses(true);
    try {
      const data = await getVersesForSurah(surah.id);
      setVerses(data ?? []);
    } catch (e) {
      setVerses([]);
    } finally {
      setLoadingVerses(false);
    }
  }
  const next = !expanded;
  chevronRotation.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 180 });
  setExpanded(next);

  setTimeout(() => { isToggling.current = false; }, 400); // unlock after animation settles
};

  const range = store.surahRanges[surah.id] || { first: 1, last: 1, count: 1 };
  const totalVerses = range.count || 1;
  const memCount = countMemorizedInRange(store.memorizedSet, range.first, range.last);
  const progressPercent = Math.min((memCount / totalVerses) * 100, 100);
  const isFullyMem = memCount > 0 && memCount === totalVerses;
  const glyph = getSurahNameGlyph(surah.id);

  return (
    <View style={[sStyles.container, isFullyMem && sStyles.fullyMem]}>
      <View style={sStyles.header}>
        <TouchableOpacity style={sStyles.chevronBtn} onPress={toggleExpand}>
          <Animated.Text style={[sStyles.chevronText, chevronStyle]}>›</Animated.Text>
        </TouchableOpacity>
        <View style={sStyles.barWrap}>
          <View style={{ width: '100%', height: 4, backgroundColor: theme.cardBorder, borderRadius: 2 }}>
            <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 2 }} />
          </View>
        </View>
        <View style={sStyles.info}>
          <View style={sStyles.nameRow}>
            {glyph ? (
              <Text style={{ fontFamily: 'SurahNames', fontSize: 32, color: theme.white, textAlign: 'right', includeFontPadding: false }}>{glyph}</Text>
            ) : (
              <Text style={sStyles.name}>{surah.name_arabic}</Text>
            )}
          </View>
        </View>
      </View>
      {expanded && (
        <View style={sStyles.versesWrap}>
          {loadingVerses ? (
            <ActivityIndicator color={theme.primary} style={{ margin: 12 }} />
          ) : (
            <FlatList
              data={verses}
              keyExtractor={(v) => v.id.toString()}
              renderItem={({ item: v }) => (
                <VerseRow verse={v} isMem={store.memorizedSet.has(v.id)} />
              )}
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          )}
        </View>
      )}
    </View>
  );
}

const sStyles = StyleSheet.create({
  container: { backgroundColor: theme.backgroundCard, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.cardBorder, overflow: 'hidden' },
  fullyMem: { borderColor: 'rgba(46,204,113,0.4)', shadowColor: theme.secondary, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  chevronBtn: { padding: 8, width: 36, alignItems: 'center' },
  chevronText: { color: theme.primary, fontSize: 22 },
  barWrap: { width: 60, marginHorizontal: 12 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  name: { fontFamily: 'Amiri', color: theme.white, fontSize: 20 },
  verseCount: { color: theme.grey, fontSize: 11 },
  versesWrap: { backgroundColor: '#0a0a18' },
});

export default function MemorizationMapScreen({ navigation }) {
  const { store } = useAppStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{"\u2039"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>خريطة الحفظ</Text>
      </View>
      <View style={styles.globalSection}>
        <MemorizationBar memorizedIds={Array.from(store.memorizedSet)} />
        <Text style={styles.globalCount}>{store.memorizedSet.size} من ٦٢٣٦ آية محفوظة</Text>
      </View>
      <View style={styles.list}>
        <FlashList
          data={store.chapters}
          estimatedItemSize={80}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item: s }) => <SurahRow surah={s} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: theme.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  backText: { color: theme.primary, fontSize: 26, lineHeight: 30, includeFontPadding: false, marginTop: -2 },
  headerTitle: { fontFamily: 'Amiri', color: theme.primary, fontSize: 24 },
  globalSection: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.cardBorder },
  globalCount: { color: theme.grey, fontSize: 12, textAlign: 'right', marginTop: 8 },
  list: { flex: 1 },
});