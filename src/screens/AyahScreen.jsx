import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import BlurredAyah from '../components/BlurredAyah';
import StrengthMeter from '../components/StrengthMeter';
import { getAyahAudioUrl } from '../audio/recitation';
import { getAyahKeysForPhrase, getPhrasesForAyah } from '../db/mutashabihat';
import {
  getAyahById,
  getFullAyahsByKeys,
  getNextAyah, getPrevAyah,
  getOverdueVerseIds,
  getReviewCount,
  getSimilarAyahs,
  getSpacedRepetitionAyah,
  incrementReviewCount,
  searchVersesByPhrase
} from '../db/queries';
import { getSurahNameGlyph } from '../srs/utils/fontUtils';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

const PHRASE_COLORS = ['#FF6B6B', '#51CF66', '#339AF0', '#FCC419', '#CC5DE8', '#FF922B', '#22B8CF'];
const END_OF_AYAH = String.fromCodePoint(0x06DD);

// ============ Modal Content Components ============

// Note: these lists render inside a modal's outer ScrollView (scrollEnabled={false}
// on the list itself), so FlashList/FlatList virtualization has no viewport to work
// with anyway -- a plain map avoids that overhead entirely.

function SimilarAyahsContent({ data, dividerStyle }) {
  return (
    <View>
      {data.map((item, index) => (
        <View key={item.id.toString()}>
          <BlurredAyah ayah={item} />
          {index < data.length - 1 && <View style={dividerStyle} />}
        </View>
      ))}
    </View>
  );
}

function SimilarPhrasesContent({ data, phraseColors, onPhraseSelect, phraseCardStyle, phraseCardTextStyle, phraseCardStatsStyle, phraseCardBtnStyle, phraseCardBtnTextStyle }) {
  return (
    <View>
      {data.map((item, index) => {
        const color = phraseColors[index % phraseColors.length];
        return (
          <View key={item.id.toString()} style={[phraseCardStyle, { borderLeftColor: color, borderLeftWidth: 4 }]}>
            <Text style={[phraseCardTextStyle, { color }]}>{item.text}</Text>
            <Text style={phraseCardStatsStyle}>وردت {item.count} مرات في {item.surahs} سورة</Text>
            <TouchableOpacity style={phraseCardBtnStyle} onPress={() => onPhraseSelect(item.id)}>
              <Text style={phraseCardBtnTextStyle}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function PhraseAyahsContent({ data, dividerStyle, headerText, headerStyle }) {
  return (
    <View>
      <Text style={headerStyle}>{headerText}</Text>
      {data.map((item, index) => (
        <View key={item.id.toString()}>
          <BlurredAyah ayah={item} />
          {index < data.length - 1 && <View style={dividerStyle} />}
        </View>
      ))}
    </View>
  );
}

function SimilarAyahsWithBackContent({ data, dividerStyle, onBack, backBtnStyle, backBtnTextStyle }) {
  return (
    <View>
      <TouchableOpacity style={backBtnStyle} onPress={onBack}>
        <Text style={backBtnTextStyle}>← رجوع للمقاطع</Text>
      </TouchableOpacity>
      {data.map((item, index) => (
        <View key={item.id.toString()}>
          <BlurredAyah ayah={item} />
          {index < data.length - 1 && <View style={dividerStyle} />}
        </View>
      ))}
    </View>
  );
}

// ============ Main Component ============

function toArabicDigits(num) {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export default function AyahScreen({ route, navigation }) {
  const { store, activeSession, updateSessionProgress, toggleMemorized } = useAppStore();
  const { mode, selectedVerseIds, selectedRanges, verseId } = route.params || {};
  const [currentAyah, setCurrentAyah] = useState(null);
  const [ayahPhrases, setAyahPhrases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [phraseModalTitle, setPhraseModalTitle] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const floatingBarOpacity = useSharedValue(0);
  const [memorized, setMemorized] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [audioState, setAudioState] = useState('idle'); // idle | loading | playing | error
  const soundRef = useRef(null);
  const cardOpacity = useSharedValue(1);
  const refreshSpin = useSharedValue(0);

  // Level mode variables
  const remainingIdsRef = useRef(route.params?.mode === 'level' ? [...(route.params.selectedVerseIds || [])] : []);
  const [totalVersesInLevel, setTotalVersesInLevel] = useState(route.params?.mode === 'level' ? (route.params.selectedVerseIds?.length || 0) : 0);
  const [progressCount, setProgressCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [levelIndex, setLevelIndex] = useState(route.params?.levelIndex ?? 0);

  useEffect(() => {
    if (route.params?.mode === 'level') {
      const ids = route.params.selectedVerseIds || [];
      remainingIdsRef.current = [...ids];
      setTotalVersesInLevel(ids.length);
      setProgressCount(0);
      setLevelIndex(route.params.levelIndex ?? 0);
      setShowCelebration(false);
    }
  }, [route.params?.selectedVerseIds, route.params?.levelIndex]);

  useEffect(() => { loadAyah(); }, []);

  useEffect(() => {
    floatingBarOpacity.value = withTiming(selectedText.length > 0 ? 1 : 0, { duration: 200 });
  }, [selectedText]);

  // Stop any in-flight recitation when leaving the screen
  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, []);

  const stopAyahAudio = async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setAudioState('idle');
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {
        // already unloaded/stopped, ignore
      }
    }
  };

  const playAyahAudio = async () => {
    if (!currentAyah) return;
    if (audioState === 'playing' || audioState === 'loading') {
      await stopAyahAudio();
      return;
    }
    setAudioState('loading');
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const url = getAyahAudioUrl(currentAyah.surah_number, currentAyah.verse_number);
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setAudioState('playing');
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish || status.error) {
          sound.unloadAsync();
          if (soundRef.current === sound) {
            soundRef.current = null;
            setAudioState('idle');
          }
        }
      });
    } catch (e) {
      console.warn('playAyahAudio error:', e);
      soundRef.current = null;
      setAudioState('error');
      setTimeout(() => setAudioState('idle'), 2000);
    }
  };

  const loadAyah = async () => {
    await stopAyahAudio();
    cardOpacity.value = withTiming(0, { duration: 200 });
    setLoading(true);
    setSelectedText('');
    setAyahPhrases([]);
    setMemorized(false);
    setReviewCount(0);
    let ayah = null;
    if (route.params?.mode === 'level') {
      const remaining = remainingIdsRef.current;
      if (remaining.length === 0) {
        setLoading(false);
        return;
      }
      // Spaced repetition: within this level's remaining verses, bias toward
      // ones overdue for review so weak spots surface earlier in the session
      // (the level still isn't "complete" until every verse has been shown once).
      const overdueIds = await getOverdueVerseIds();
      const overdueInRemaining = remaining.filter(id => overdueIds.includes(id));
      const pickFrom = overdueInRemaining.length > 0 && Math.random() < 0.7
        ? overdueInRemaining
        : remaining;
      const chosenId = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      remainingIdsRef.current = remaining.filter(id => id !== chosenId);
      setProgressCount(totalVersesInLevel - remainingIdsRef.current.length);

      ayah = await getAyahById(chosenId);
    } else if (mode === 'random') {
      ayah = await getSpacedRepetitionAyah(selectedVerseIds, selectedRanges);
    } else {
      ayah = await getAyahById(verseId);
    }
    setCurrentAyah(ayah);
    if (ayah) {
      const isMem = store.memorizedSet.has(ayah.id);
      setMemorized(isMem);
      const count = await getReviewCount(ayah.id);
      setReviewCount(count);
      if (isMem) { await incrementReviewCount(ayah.id); setReviewCount(count + 1); }
      getPhrasesForAyah(ayah.verse_key).then(setAyahPhrases);
    }
    setLoading(false);
    cardOpacity.value = withTiming(1, { duration: 300 });
  };

  const loadNewRandom = () => {
    refreshSpin.value = withTiming(refreshSpin.value + 360, { duration: 400 });
    loadAyah();
  };

  const handleLevelComplete = async () => {
    if (!activeSession) return;
    const completedIndices = Array.from(new Set([...activeSession.completed_level_indices, levelIndex]));
    let nextIndex = levelIndex;
    if (levelIndex + 1 < activeSession.levels_data.length) {
      nextIndex = levelIndex + 1;
    }
    await updateSessionProgress(nextIndex, completedIndices);
    setShowCelebration(true);
  };

  const handleToggleMemorized = async (value) => {
    if (!currentAyah) return;
    setMemorized(value);
    await toggleMemorized(currentAyah.id, currentAyah.verse_key, value);
    if (value) {
      const count = await getReviewCount(currentAyah.id);
      setReviewCount(count);
    } else {
      setReviewCount(0);
    }
  };

  const openModal = async (type) => {
    setActiveModal(type); setModalLoading(true); setModalData(null); setSelectedText('');
    if (!currentAyah) { setModalLoading(false); return; }
    if (type === 'next') setModalData(await getNextAyah(currentAyah.surah_number, currentAyah.verse_number));
    else if (type === 'prev') setModalData(await getPrevAyah(currentAyah.surah_number, currentAyah.verse_number));
    else if (type === 'similar') setModalData(await getSimilarAyahs(currentAyah.verse_key));
    else if (type === 'similar_phrases') setModalData(ayahPhrases);
    setModalLoading(false);
  };

  const openPhraseAyahs = async (phraseId) => {
    setActiveModal('similar_ayahs');
    setModalLoading(true);
    setModalData(null);
    const keys = getAyahKeysForPhrase(phraseId);
    const ayahs = await getFullAyahsByKeys(keys);
    setModalData(ayahs);
    setModalLoading(false);
  };

  const openPhraseSearch = async () => {
    const phrase = selectedText.trim();
    if (!phrase || !currentAyah) return;
    setSelectedText(''); setPhraseModalTitle(phrase);
    setActiveModal('phrase'); setModalLoading(true); setModalData(null);
    setModalData(await searchVersesByPhrase(phrase, currentAyah.verse_key));
    setModalLoading(false);
  };

  const closeModal = () => { setActiveModal(null); setModalData(null); setPhraseModalTitle(''); };

  const handleOutsideTap = () => {
    if (selectedText) setSelectedText('');
  };

  const renderModalContent = () => {
    if (modalLoading) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />;
    if (activeModal === 'next') {
      if (!modalData) return <Text style={styles.modalEmptyText}>هذه آخر آية في السورة</Text>;
      return <BlurredAyah ayah={modalData} />;
    }
    if (activeModal === 'prev') {
      if (!modalData) return <Text style={styles.modalEmptyText}>هذه أول آية في السورة</Text>;
      return <BlurredAyah ayah={modalData} />;
    }
    if (activeModal === 'similar') {
      if (!modalData?.length) return <Text style={styles.modalEmptyText}>لا توجد آيات متشابهة</Text>;
      return <SimilarAyahsContent data={modalData} dividerStyle={styles.divider} />;
    }
    if (activeModal === 'similar_phrases') {
      if (!modalData?.length) return <Text style={styles.modalEmptyText}>لا توجد مقاطع متشابهة</Text>;
      return <SimilarPhrasesContent data={modalData} phraseColors={PHRASE_COLORS} onPhraseSelect={openPhraseAyahs} phraseCardStyle={styles.phraseCard} phraseCardTextStyle={styles.phraseCardText} phraseCardStatsStyle={styles.phraseCardStats} phraseCardBtnStyle={styles.phraseCardBtn} phraseCardBtnTextStyle={styles.phraseCardBtnText} />;
    }
    if (activeModal === 'similar_ayahs') {
      if (!modalData?.length) return <Text style={styles.modalEmptyText}>لم يُعثر على آيات</Text>;
      return <SimilarAyahsWithBackContent data={modalData} dividerStyle={styles.divider} onBack={() => openModal('similar_phrases')} backBtnStyle={styles.backToPhrasesBtn} backBtnTextStyle={styles.backToPhrasesText} />;
    }
    if (activeModal === 'phrase') {
      if (!modalData?.length) return <Text style={styles.modalEmptyText}>لم يُعثر على آيات مشابهة</Text>;
      return <PhraseAyahsContent data={modalData} dividerStyle={styles.divider} headerText={`وجد ${modalData.length} آية`} headerStyle={styles.phraseCount} />;
    }
    return null;
  };

  const modalTitle = () => {
    if (activeModal === 'next') return 'الآية التالية';
    if (activeModal === 'prev') return 'الآية السابقة';
    if (activeModal === 'similar') return 'الآيات المتشابهة';
    if (activeModal === 'similar_phrases') return 'المقاطع المتشابهة في هذه الآية';
    if (activeModal === 'similar_ayahs') return 'مواضع المتشابه';
    if (activeModal === 'phrase') return `آيات تحتوي على: ${phraseModalTitle}`;
    return '';
  };

  const getWordColor = (wordIndex) => {
    for (let i = 0; i < ayahPhrases.length; i++) {
      const phrase = ayahPhrases[i];
      if (phrase.occurrences) {
        for (const range of phrase.occurrences) {
          if (wordIndex >= range[0] && wordIndex <= range[1]) {
            return PHRASE_COLORS[i % PHRASE_COLORS.length];
          }
        }
      }
    }
    return theme.white;
  };

  const floatingStyle = useAnimatedStyle(() => ({ opacity: floatingBarOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${refreshSpin.value}deg` }] }));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{"\u2039"}</Text>
          </TouchableOpacity>
          {route.params?.mode === 'level' && (
            <View style={styles.levelHeaderProgress}>
              <Text style={styles.levelHeaderText} numberOfLines={1}>
                {toArabicDigits(progressCount)} / {toArabicDigits(totalVersesInLevel)} آية
              </Text>
            </View>
          )}
          {currentAyah ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Text
                style={{ fontFamily: 'Amiri', color: theme.primary, fontSize: 28, includeFontPadding: false }}
                numberOfLines={1}
              >
                {END_OF_AYAH + toArabicDigits(currentAyah.verse_key.split(':')[1])}
              </Text>
              {getSurahNameGlyph(currentAyah.surah_number) ? (
                <Text
                  style={{ fontFamily: 'SurahNames', fontSize: 40, color: theme.primary, includeFontPadding: false, flexShrink: 1 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {getSurahNameGlyph(currentAyah.surah_number)}
                </Text>
              ) : (
                <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{currentAyah.surah_name_arabic}</Text>
              )}
            </View>
          ) : null}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 170 }}>
          {loading && !currentAyah ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
          ) : currentAyah ? (
            <Animated.View style={cardStyle}>
              <TouchableOpacity activeOpacity={1} onPress={handleOutsideTap}>
                <LinearGradient colors={['#10101e', '#0d0d1a']} style={styles.ayahCard}>
                  <TouchableOpacity
                    style={[styles.audioBtn, audioState === 'playing' && styles.audioBtnPlaying]}
                    onPress={playAyahAudio}
                    activeOpacity={0.8}
                  >
                    {audioState === 'loading' ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <Text style={styles.audioIcon}>
                        {audioState === 'playing' ? '⏸' : audioState === 'error' ? '⚠' : '▶'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {selectedText.length > 0 && (
                    <Animated.View style={[styles.floatingBar, floatingStyle]}>
                      <Text style={styles.floatingBarPrefix} numberOfLines={1} ellipsizeMode="tail">ابحث عن: {selectedText}</Text>
                      <TouchableOpacity style={styles.floatingBarBtn} onPress={openPhraseSearch}>
                        <Text style={styles.floatingBarText} numberOfLines={1}>عرض المتشابه</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setSelectedText('')}>
                        <Text style={styles.floatingBarDismiss}>✕</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                  <View style={styles.goldLine} />
                  <View style={styles.arabicTextContainer}>
                    {currentAyah.text_uthmani.split(' ').map((word, idx) => {
                      const wordColor = getWordColor(idx + 1);
                      const isAyahNum = /^[\u0660-\u0669\d]+$/.test(word);
                      const displayWord = isAyahNum ? END_OF_AYAH + word : word;
                      return (
                        <TouchableOpacity
                          key={`${idx}-${word}`}
                          onPress={() => setSelectedText(selectedText === word ? '' : word)}
                          style={[styles.wordWrap, selectedText === word && styles.wordWrapSelected]}
                        >
                          <Text style={[styles.arabicWord, { color: wordColor }, selectedText === word && styles.arabicWordSelected]}>
                            {displayWord}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.verseKeyRow}>
                    {getSurahNameGlyph(currentAyah.surah_number) ? (
                      <Text style={styles.surahNameGlyph} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                        {getSurahNameGlyph(currentAyah.surah_number)}
                      </Text>
                    ) : (
                      <Text style={styles.surahNameFallback} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {currentAyah.surah_name_arabic}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.translation} numberOfLines={4}>{currentAyah.translation}</Text>
                  <View style={styles.memSection}>
                    <TouchableOpacity
                      onPress={() => handleToggleMemorized(!memorized)}
                      activeOpacity={0.8}
                      style={styles.sealWrapper}
                    >
                      <View style={[
                        styles.sealOuter,
                        memorized && styles.sealOuterActive
                      ]}>
                        <View style={[
                          styles.sealInner,
                          memorized && styles.sealInnerActive
                        ]}>
                          <Text style={[
                            styles.sealIcon,
                            memorized && styles.sealIconActive
                          ]}>
                            {memorized ? '✓' : '○'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[
                        styles.sealLabel,
                        memorized && styles.sealLabelActive
                      ]}>
                        {memorized ? 'محفوظة' : 'اضغط للحفظ'}
                      </Text>
                    </TouchableOpacity>
                    {memorized && (
                      <View style={styles.memDetails}>
                        <StrengthMeter reviewCount={reviewCount} />
                        <Text style={styles.reviewCountText}>
                          راجعت هذه الآية {reviewCount} مرة
                        </Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Text style={styles.modalEmptyText}>لم يتم العثور على الآية</Text>
          )}
        </ScrollView>

        <View style={styles.bottomBarWrapper}>
          {(mode === 'random' || route.params?.mode === 'level') && (
            <TouchableOpacity 
              style={[
                styles.anotherBtn, 
                (route.params?.mode === 'level' && progressCount === totalVersesInLevel) && styles.completeLevelBtn
              ]} 
              onPress={
                (route.params?.mode === 'level' && progressCount === totalVersesInLevel) 
                  ? handleLevelComplete 
                  : loadNewRandom
              }
            >
              {(route.params?.mode === 'level' && progressCount === totalVersesInLevel) ? (
                <>
                  <Text style={styles.completeLevelIcon}>🎉</Text>
                  <Text style={[styles.anotherBtnText, styles.completeLevelBtnText]} numberOfLines={1}>إنهاء المستوى</Text>
                </>
              ) : (
                <>
                  <Animated.Text style={[styles.anotherIcon, spinStyle]}>↺</Animated.Text>
                  <Text style={styles.anotherBtnText} numberOfLines={1}>آية أخرى</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <View style={styles.actionRow}>
            <ActionButton label="التالية" onPress={() => openModal('next')} />
            <ActionButton label="الآيات" onPress={() => openModal('similar')} />
            <ActionButton label="المقاطع" onPress={() => openModal('similar_phrases')} />
            <ActionButton label="السابقة" onPress={() => openModal('prev')} isLast />
          </View>
        </View>
      </View>

      <Modal visible={activeModal !== null} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.closeCircle}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={2}>{modalTitle()}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {renderModalContent()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCelebration} animationType="fade" transparent>
        <View style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🏆</Text>
            <Text style={styles.celebrationTitle}>أحسنت!</Text>
            <Text style={styles.celebrationSubtitle}>تم إكمال المستوى {levelIndex + 1} بنجاح!</Text>
            
            <View style={styles.celebrationStatsContainer}>
              <Text style={styles.celebrationStatText}>عدد الآيات التي تمت مراجعتها: {totalVersesInLevel}</Text>
            </View>

            <View style={styles.celebrationActions}>
              {levelIndex + 1 < activeSession?.levels_data?.length ? (
                <TouchableOpacity 
                  style={styles.celebrationBtnPrimary}
                  onPress={() => {
                    setShowCelebration(false);
                    const nextIdx = levelIndex + 1;
                    const nextLevel = activeSession.levels_data[nextIdx];
                    
                    navigation.replace('AyahScreen', {
                      mode: 'level',
                      selectedVerseIds: nextLevel.verseIds,
                      levelIndex: nextIdx,
                    });
                  }}
                >
                  <Text style={styles.celebrationBtnTextPrimary}>المستوى التالي</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity 
                style={styles.celebrationBtnSecondary}
                onPress={() => {
                  setShowCelebration(false);
                  navigation.navigate('LevelMap');
                }}
              >
                <Text style={styles.celebrationBtnTextSecondary}>العودة للخريطة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionButton({ label, onPress, isLast }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const s = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const handleIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
    opacity.value = withTiming(0.7, { duration: 80 });
  };
  const handleOut = () => {
    scale.value = withSpring(1, { damping: 15 });
    opacity.value = withTiming(1, { duration: 150 });
  };
  return (
    <TouchableOpacity onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} activeOpacity={1} style={{ flex: 1 }}>
      <Animated.View style={[styles.actionBtn, isLast && styles.lastActionBtn, s]}>
        <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backText: {
    color: theme.primary,
    fontSize: 26,
    lineHeight: 30,
    includeFontPadding: false,
    marginTop: -2,
  },
  headerTitle: { fontFamily: 'Amiri', color: theme.primary, fontSize: 24 },
  content: { flex: 1, padding: 8 },
  floatingBar: {
    position: 'absolute', top: 20, left: 16, right: 16, alignSelf: 'center', zIndex: 100,
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundCard,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: theme.cardBorder, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8,
  },
  floatingBarPrefix: { color: theme.white, fontSize: 13, marginRight: 8, fontFamily: 'Amiri', flexShrink: 1 },
  floatingBarBtn: { backgroundColor: 'rgba(46,204,113,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  floatingBarText: { color: theme.secondary, fontSize: 13, fontWeight: 'bold' },
  floatingBarDismiss: { color: theme.grey, fontSize: 16, padding: 4, marginLeft: 12 },
  ayahCard: { position: 'relative', borderRadius: 24, borderWidth: 1, borderColor: theme.cardBorder, padding: 16 },
  audioBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 20,
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,255,135,0.06)',
  },
  audioBtnPlaying: { backgroundColor: 'rgba(0,255,135,0.18)' },
  audioIcon: { color: theme.primary, fontSize: 15 },
  goldLine: { height: 1, backgroundColor: theme.primaryGlow, marginBottom: 24, marginHorizontal: -16 },
  arabicTextContainer: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8,
  },
  wordWrap: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 6, marginHorizontal: 0, marginVertical: 0 },
  wordWrapSelected: { backgroundColor: 'rgba(201,168,76,0.2)' },
  arabicWord: { fontFamily: 'Amiri', fontSize: 20, color: theme.white, lineHeight: 58, marginHorizontal: 2 },
  arabicWordSelected: { color: theme.primary },
  verseKeyRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: 24,
    marginBottom: 12, gap: 16,
  },
  surahNameGlyph: {
    fontFamily: 'SurahNames', fontSize: 30,
    color: theme.primary, includeFontPadding: false,
  },
  surahNameFallback: {
    fontFamily: 'Amiri', fontSize: 20, color: theme.primary,
  },
  verseNumberBadge: {
    alignItems: 'center', justifyContent: 'center',
  },
  verseNumberOuter: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.6)',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  verseNumberInner: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.05)',
  },
  verseNumberText: {
    color: theme.primary, fontSize: 13,
    fontWeight: 'bold', letterSpacing: 0.5,
  },
  translation: { color: theme.grey, fontSize: 13, textAlign: 'left', fontStyle: 'italic', lineHeight: 22 },
  memSection: {
    marginTop: 24, borderTopWidth: 1,
    borderTopColor: theme.cardBorder, paddingTop: 20,
    alignItems: 'center',
  },
  sealWrapper: { alignItems: 'center', gap: 8 },
  sealOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(201,168,76,0.3)',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sealOuterActive: {
    borderColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  sealInner: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.05)',
  },
  sealInnerActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: 'rgba(201,168,76,0.5)',
  },
  sealIcon: { fontSize: 24, color: 'rgba(201,168,76,0.4)' },
  sealIconActive: { color: theme.primary, fontSize: 26 },
  sealLabel: { color: theme.grey, fontSize: 12, letterSpacing: 1 },
  sealLabelActive: { color: theme.primary },
  memDetails: { alignItems: 'center', marginTop: 10 },
  reviewCountText: { color: theme.grey, fontSize: 11, marginTop: 2 },
  bottomBarWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    backgroundColor: 'rgba(8,8,16,0.97)',
    borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.1)',
  },
  anotherBtn: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8,
    marginBottom: 14, paddingVertical: 9, paddingHorizontal: 24,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)', borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.06)',
  },
  anotherIcon: { color: theme.primary, fontSize: 18 },
  anotherBtnText: { color: theme.primary, fontSize: 14, fontFamily: 'Amiri' },
  actionRow: {
    flexDirection: 'row', backgroundColor: '#0e0e1e',
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)', overflow: 'hidden',
  },
  actionBtn: {
    flex: 1, paddingVertical: 16, alignItems: 'center',
    justifyContent: 'center', borderRightWidth: 1,
    borderRightColor: 'rgba(201,168,76,0.1)',
  },
  lastActionBtn: { borderRightWidth: 0 },
  actionLabel: { color: theme.white, fontSize: 15, fontFamily: 'Amiri' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: '82%', padding: 20,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: theme.primary,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  closeCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e3a',
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: theme.greyLight, fontSize: 14 },
  modalTitle: { color: theme.primary, fontSize: 16, fontFamily: 'Amiri', flex: 1, textAlign: 'right', marginLeft: 12 },
  phraseCount: { color: theme.grey, fontSize: 13, textAlign: 'right', marginBottom: 16 },
  modalEmptyText: { color: theme.grey, textAlign: 'center', fontSize: 15, marginTop: 40 },
  divider: { height: 1, backgroundColor: 'rgba(201,168,76,0.2)', marginVertical: 16 },
  phraseCard: { backgroundColor: theme.backgroundCard, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.cardBorder },
  phraseCardText: { fontFamily: 'Amiri', fontSize: 24, color: theme.primary, textAlign: 'center', marginBottom: 12 },
  phraseCardStats: { color: theme.grey, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  phraseCardBtn: { backgroundColor: 'rgba(201,168,76,0.15)', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  phraseCardBtnText: { color: theme.primary, fontWeight: 'bold', fontSize: 15 },
  backToPhrasesBtn: { alignSelf: 'flex-start', marginBottom: 16, padding: 8 },
  backToPhrasesText: { color: theme.primary, fontSize: 16, fontFamily: 'Amiri' },
  
  // Level Progression Styles
  levelHeaderProgress: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  levelHeaderText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  completeLevelBtn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  completeLevelIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  completeLevelBtnText: {
    color: theme.background,
    fontWeight: 'bold',
  },
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 7, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.backgroundCard,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: theme.primary,
    padding: 28,
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontFamily: 'Amiri',
    fontSize: 28,
    color: theme.primary,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  celebrationSubtitle: {
    fontSize: 15,
    color: theme.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  celebrationStatsContainer: {
    backgroundColor: 'rgba(22, 51, 33, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  celebrationStatText: {
    color: theme.greyLight,
    fontSize: 13,
    textAlign: 'center',
  },
  celebrationActions: {
    width: '100%',
    gap: 12,
  },
  celebrationBtnPrimary: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  celebrationBtnTextPrimary: {
    color: theme.background,
    fontWeight: 'bold',
    fontSize: 15,
  },
  celebrationBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.cardBorder,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  celebrationBtnTextSecondary: {
    color: theme.greyLight,
    fontSize: 15,
  },
});
