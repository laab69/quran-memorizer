
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import SurahDropdown from '../components/SurahDropdown';
import { getAllHizbs, getRubusForHizb, getRubuChunks } from '../db/queries';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

function countMemorizedInRange(set, first, last) {
  let count = 0;
  for (let id = first; id <= last; id++) {
    if (set.has(id)) count++;
  }
  return count;
}

function HizbRow({ hizb, selectedRanges, onRangeSelect }) {
  const { store } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [rubus, setRubus] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const isToggling = useRef(false);
  const chevronRotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  const toggleExpand = async () => {
    if (isToggling.current) return;
    isToggling.current = true;

    if (!expanded && rubus.length === 0) {
      setIsLoading(true);
      try {
        const data = await getRubusForHizb(hizb.id);
        setRubus(data ?? []);
      } catch (e) {
        setRubus([]);
      } finally {
        setIsLoading(false);
      }
    }
    const next = !expanded;
    chevronRotation.value = withSpring(next ? 1 : 0, { damping: 15, stiffness: 180 });
    setExpanded(next);
    setTimeout(() => { isToggling.current = false; }, 400);
  };

  const getLabel = (index) => {
    if (index === 0) return 'الربع الأول';
    if (index === 1) return 'النصف';
    if (index === 2) return 'الربع الثالث';
    return 'الحزب كامل';
  };

  const totalVerses = (hizb.last_verse_id - hizb.first_verse_id + 1) || 1;
  const memCount = countMemorizedInRange(store.memorizedSet, hizb.first_verse_id, hizb.last_verse_id);
  const progressPercent = Math.min((memCount / totalVerses) * 100, 100);

  return (
    <View style={styles.hizbRowContainer}>
      <View style={styles.hizbHeader}>
        <TouchableOpacity style={styles.chevronBtn} onPress={toggleExpand}>
          <Animated.Text style={[styles.chevronText, chevronStyle]}>›</Animated.Text>
        </TouchableOpacity>
        <Text style={styles.hizbTitle} numberOfLines={1}>الحزب {hizb.id}</Text>
      </View>
      <View style={{ height: 3, backgroundColor: theme.cardBorder, width: '100%' }}>
        <View style={{ height: '100%', backgroundColor: theme.primary, width: `${progressPercent}%` }} />
      </View>
      {expanded && (
        <View style={styles.rubuContainer}>
          {isLoading ? (
            <ActivityIndicator color={theme.primary} style={{ margin: 12 }} />
          ) : (
            rubus.map((rubu, index) => {
              const isSelected = selectedRanges.some(r => r.start === rubu.first_verse_id && r.end === rubu.last_verse_id);
              return (
                <TouchableOpacity
                  key={rubu.id}
                  style={[styles.rubuRow, isSelected && styles.rubuRowSelected]}
                  onPress={() => onRangeSelect({ start: rubu.first_verse_id, end: rubu.last_verse_id })}
                >
                  <Text style={[styles.rubuLabel, isSelected && styles.rubuLabelSelected]} numberOfLines={1}>{getLabel(index)}</Text>
                  {rubu.text_uthmani && (
                    <Text style={[styles.rubuText, isSelected && styles.rubuTextSelected]} numberOfLines={1}>
                      {rubu.text_uthmani.split(' ').slice(0, 5).join(' ')} {'...'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// Custom Memoization to stop re-renders
const areHizbPropsEqual = (prevProps, nextProps) => {
  if (prevProps.hizb.id !== nextProps.hizb.id) return false;

  const getRelevantRanges = (ranges, hizb) =>
    ranges.filter(r => r.start >= hizb.first_verse_id && r.end <= hizb.last_verse_id);

  const prevRelevant = getRelevantRanges(prevProps.selectedRanges, prevProps.hizb);
  const nextRelevant = getRelevantRanges(nextProps.selectedRanges, nextProps.hizb);

  return JSON.stringify(prevRelevant) === JSON.stringify(nextRelevant);
};

const MemoizedHizbRow = React.memo(HizbRow, areHizbPropsEqual);

// export default function SurahListScreen({ route, navigation }) {
//   const { store } = useAppStore();
//   const { mode } = route.params || { mode: 'random' };
//   const [activeTab, setActiveTab] = useState('surahs');
export default function SurahListScreen({ route, navigation }) {
  const { store, ready, activeSession, saveSession, clearSession } = useAppStore();
  const { mode } = route.params || { mode: 'random' };
  const [activeTab, setActiveTab] = useState('surahs');
  const [hizbs, setHizbs] = useState([]);
  const [selectedVerseIds, setSelectedVerseIds] = useState(() => new Set());
  const [selectedRanges, setSelectedRanges] = useState([]);
  const tabUnderlineX = useSharedValue(0);

  useEffect(() => {
    if (ready) {
      getAllHizbs().then(d => setHizbs(d));
    }
  }, [ready]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    tabUnderlineX.value = withSpring(tab === 'surahs' ? 0 : 1, { damping: 18, stiffness: 180 });
  };

  const underlineStyle = useAnimatedStyle(() => ({
    left: `${tabUnderlineX.value * 50}%`,
  }));

  const handleVerseSelect = useCallback((verseId) => {
    if (mode === 'choose') {
      navigation.navigate('AyahScreen', { mode: 'choose', verseId });
      return;
    }
    setSelectedVerseIds(prev => {
      const next = new Set(prev);
      if (next.has(verseId)) next.delete(verseId); else next.add(verseId);
      return next;
    });
  }, [mode, navigation]);

  const handleSurahSelect = useCallback((surahId) => {
    if (mode !== 'random') return;
    const range = store.surahRanges[surahId];
    if (!range) return;
    setSelectedVerseIds(prev => {
      let allSelected = true;
      for (let i = range.first; i <= range.last; i++) {
        if (!prev.has(i)) { allSelected = false; break; }
      }
      const next = new Set(prev);
      for (let i = range.first; i <= range.last; i++) {
        if (allSelected) next.delete(i); else next.add(i);
      }
      return next;
    });
  }, [mode, store.surahRanges]);

  const handleRangeSelect = useCallback((range) => {
    setSelectedRanges(prev => {
      const exists = prev.some(r => r.start === range.start && r.end === range.end);
      if (exists) return prev.filter(r => r.start !== range.start || r.end !== range.end);
      return [...prev, range];
    });
  }, []);

  const startRandomSession = async () => {
    const selectedVerseIdsArr = Array.from(selectedVerseIds);
    if (selectedVerseIdsArr.length === 0 && selectedRanges.length === 0) return;

    let minId = Infinity;
    let maxId = -Infinity;

    selectedVerseIdsArr.forEach(id => {
      if (id < minId) minId = id;
      if (id > maxId) maxId = id;
    });

    selectedRanges.forEach(r => {
      if (r.start < minId) minId = r.start;
      if (r.end > maxId) maxId = r.end;
    });

    if (minId !== Infinity && maxId !== -Infinity) {
      const rubus = await getRubuChunks(minId, maxId);
      if (rubus.length > 0) {
        await saveSession(minId, maxId, rubus);
        navigation.navigate('LevelMap');
      } else {
        navigation.navigate('AyahScreen', { mode: 'random', selectedVerseIds: selectedVerseIdsArr, selectedRanges });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{"\u2039"}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>اختر السورة</Text>
        </View>

        {mode === 'random' && activeSession ? (
          <View style={styles.resumeContainer}>
            <View style={styles.resumeCard}>
              <Text style={styles.resumeTitle}>جلسة مستويات نشطة</Text>
              <Text style={styles.resumeSubtitle}>
                لديك تحدي مستويات نشط حالياً للآيات من {activeSession.levels_data[0]?.first_verse_key} إلى {activeSession.levels_data[activeSession.levels_data.length - 1]?.last_verse_key}
              </Text>

              <View style={styles.resumeProgressWrapper}>
                <Text style={styles.resumeProgressText} numberOfLines={1}>
                  المكتمل: {activeSession.completed_level_indices.length} من {activeSession.levels_data.length} مستوى
                </Text>
                <View style={styles.resumeProgressBarBg}>
                  <View 
                    style={[
                      styles.resumeProgressBarFill, 
                      { width: `${(activeSession.completed_level_indices.length / activeSession.levels_data.length) * 100}%` }
                    ]} 
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => navigation.navigate('LevelMap')}
              >
                <Text style={styles.continueBtnText}>متابعة المستويات</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.startNewBtn}
                onPress={async () => {
                  await clearSession();
                  setSelectedVerseIds(new Set());
                  setSelectedRanges([]);
                }}
              >
                <Text style={styles.startNewBtnText}>بدء تحدي جديد</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {mode === 'random' && (
              <View style={styles.tabContainer}>
                <TouchableOpacity style={styles.tab} onPress={() => switchTab('surahs')}>
                  <Text style={[styles.tabText, activeTab === 'surahs' && styles.tabTextActive]} numberOfLines={1}>السور</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => switchTab('hizbs')}>
                  <Text style={[styles.tabText, activeTab === 'hizbs' && styles.tabTextActive]} numberOfLines={1}>الأحزاب</Text>
                </TouchableOpacity>
                <Animated.View style={[styles.tabUnderline, underlineStyle]} />
              </View>
            )}

            <View style={styles.content}>
              {activeTab === 'surahs' || mode === 'choose' ? (
                <FlashList
                  data={store.chapters}
                  extraData={selectedVerseIds}
                  estimatedItemSize={80}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ paddingBottom: 100 }}
                  renderItem={({ item: surah }) => (
                    <SurahDropdown
                      surah={surah} mode={mode}
                      range={store.surahRanges[surah.id]}
                      selectedVerseIds={selectedVerseIds}
                      onVerseSelect={handleVerseSelect}
                      onSurahSelect={handleSurahSelect}
                    />
                  )}
                />
              ) : (
                <FlashList
                  data={hizbs}
                  extraData={selectedRanges}
                  estimatedItemSize={80}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ paddingBottom: 100 }}
                  renderItem={({ item: hizb }) => (
                    <MemoizedHizbRow
                      hizb={hizb}
                      selectedRanges={selectedRanges}
                      onRangeSelect={handleRangeSelect}
                    />
                  )}
                />
              )}
            </View>

            {mode === 'random' && (
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  style={[styles.startBtn, (selectedVerseIds.size === 0 && selectedRanges.length === 0) && styles.startBtnDisabled]}
                  onPress={startRandomSession}
                  disabled={selectedVerseIds.size === 0 && selectedRanges.length === 0}
                >
                  <Text style={styles.startBtnText}>ابدأ</Text>
                </TouchableOpacity>
                <Text style={styles.selectionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {selectedVerseIds.size > 0 ? `${selectedVerseIds.size} آية ` : ''}
                  {selectedRanges.length > 0 ? `${selectedRanges.length} ربع` : ''}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backText: {
    color: theme.primary, fontSize: 26,
    lineHeight: 30, includeFontPadding: false, marginTop: -2,
  },
  headerTitle: { fontFamily: 'Amiri', color: theme.primary, fontSize: 24 },
  tabContainer: {
    flexDirection: 'row', position: 'relative',
    borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { color: theme.grey, fontSize: 16 },
  tabTextActive: { color: theme.primary, fontWeight: 'bold' },
  tabUnderline: {
    position: 'absolute', bottom: 0, width: '50%', height: 2,
    backgroundColor: theme.primary, borderRadius: 1,
  },
  content: { flex: 1, padding: 16 },
  hizbRowContainer: { marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.cardBorder, backgroundColor: theme.backgroundCard, overflow: 'hidden' },
  hizbHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  chevronBtn: { padding: 8, width: 36, alignItems: 'center' },
  chevronText: { color: theme.primary, fontSize: 22 },
  hizbTitle: { fontFamily: 'Amiri', color: theme.white, fontSize: 20, flex: 1, textAlign: 'right' },
  rubuContainer: { backgroundColor: '#0a0a18', paddingVertical: 8 },
  rubuRow: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.cardBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rubuRowSelected: { backgroundColor: 'rgba(201,168,76,0.15)' },
  rubuLabel: { color: theme.grey, fontSize: 16, textAlign: 'right', fontFamily: 'Amiri', minWidth: 80 },
  rubuLabelSelected: { color: theme.primary },
  rubuText: { color: theme.greyLight, fontFamily: 'Amiri', fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 16 },
  rubuTextSelected: { color: theme.primary },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,8,16,0.95)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20,
    borderTopWidth: 1, borderTopColor: theme.cardBorder,
  },
  selectionText: { color: theme.primary, fontSize: 15, flexShrink: 1, marginLeft: 12 },
  startBtn: {
    backgroundColor: theme.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10,
  },
  startBtnDisabled: { backgroundColor: theme.grey },
  startBtnText: { color: theme.background, fontSize: 17, fontWeight: 'bold' },
  resumeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resumeCard: {
    width: '100%',
    backgroundColor: theme.backgroundCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 24,
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  resumeTitle: { fontFamily: 'Amiri', fontSize: 22, color: theme.primary, marginBottom: 12, textAlign: 'center' },
  resumeSubtitle: { fontSize: 14, color: theme.greyLight, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  resumeProgressWrapper: { width: '100%', marginBottom: 30 },
  resumeProgressText: { color: theme.white, fontSize: 13, marginBottom: 8, textAlign: 'right' },
  resumeProgressBarBg: { height: 8, backgroundColor: theme.cardBorder, borderRadius: 4, overflow: 'hidden' },
  resumeProgressBarFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 4 },
  continueBtn: {
    width: '100%',
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  continueBtnText: { color: theme.background, fontSize: 16, fontWeight: 'bold' },
  startNewBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  startNewBtnText: { color: theme.greyLight, fontSize: 15 },
});