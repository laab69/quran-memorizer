import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { getOverdueVerseIds } from '../db/queries';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

const { width } = Dimensions.get('window');

function ActiveBadgeOuter() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.6, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseOuter, outerStyle]} />;
}

export default function LevelMapScreen({ navigation }) {
  const { activeSession, clearSession } = useAppStore();
  const [overdueSet, setOverdueSet] = useState(() => new Set());

  // Refresh which verses are due for review every time this screen gains
  // focus (e.g. after finishing a review session), so the "due" badges on
  // completed levels stay accurate without needing to remount the screen.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      getOverdueVerseIds().then(ids => {
        if (isActive) setOverdueSet(new Set(ids));
      });
      return () => { isActive = false; };
    }, [])
  );

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>لا توجد جلسة مستويات نشطة حالياً</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.actionBtnText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { levels_data, current_level_index, completed_level_indices } = activeSession;
  const totalLevels = levels_data.length;
  const completedCount = completed_level_indices.length;
  const progressPercent = Math.min((completedCount / totalLevels) * 100, 100);

  const handleResetSession = () => {
    Alert.alert(
      'إنهاء مسار المستويات',
      'هل أنت متأكد من رغبتك في حذف مسار المستويات الحالي والبدء من جديد؟ لن يتم حذف تقدم حفظ الآيات العام.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، حذف المسار',
          style: 'destructive',
          onPress: async () => {
            await clearSession();
            navigation.navigate('SurahList', { mode: 'random' });
          }
        }
      ]
    );
  };

  const handleStartLevel = (levelIndex, level) => {
    const isCompleted = completed_level_indices.includes(levelIndex);
    const isUnlocked = levelIndex <= current_level_index || isCompleted;

    if (!isUnlocked) {
      Alert.alert('المستوى مغلق', 'يرجى إكمال المستويات السابقة للوصول إلى هذا المستوى.');
      return;
    }

    navigation.navigate('AyahScreen', {
      mode: 'level',
      selectedVerseIds: level.verseIds,
      levelIndex,
    });
  };

  // Helper to extract Hizb number based on Rubu index
  const getHizbLabel = (rubNum) => {
    const hizb = Math.floor((rubNum - 1) / 4) + 1;
    const quarter = ((rubNum - 1) % 4) + 1;
    let quarterLabel = '';
    if (quarter === 1) quarterLabel = 'الربع الأول';
    else if (quarter === 2) quarterLabel = 'الربع الثاني (النصف)';
    else if (quarter === 3) quarterLabel = 'الربع الثالث';
    else quarterLabel = 'الربع الرابع (الحزب كامل)';
    
    return `${quarterLabel} - الحزب ${hizb}`;
  };

  const renderLevelItem = ({ item: level, index }) => {
    const isCompleted = completed_level_indices.includes(index);
    const isActive = index === current_level_index;
    const isUnlocked = index <= current_level_index || isCompleted;
    // Only completed levels need a "come back and review" prompt -- the
    // active level already surfaces its own overdue verses automatically.
    const hasDueReview = isCompleted && level.verseIds && level.verseIds.some(id => overdueSet.has(id));

    // Connecting line colors
    const showTopLine = index > 0;
    const showBottomLine = index < totalLevels - 1;
    const isTopLineGreen = index <= current_level_index;
    const isBottomLineGreen = index < current_level_index;

    return (
      <View style={styles.levelRow}>
        {/* Visual Connector Path Area */}
        <View style={styles.badgeColumn}>
          {showTopLine && (
            <View
              style={[
                styles.connectorLine,
                styles.connectorLineTop,
                isTopLineGreen && styles.connectorLineGreen
              ]}
            />
          )}
          {showBottomLine && (
            <View
              style={[
                styles.connectorLine,
                styles.connectorLineBottom,
                isBottomLineGreen && styles.connectorLineGreen
              ]}
            />
          )}

          {/* Circular Node */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleStartLevel(index, level)}
            style={[
              styles.nodeOuter,
              isCompleted && styles.nodeCompleted,
              isActive && styles.nodeActive,
              !isUnlocked && styles.nodeLocked
            ]}
          >
            {isActive && <ActiveBadgeOuter />}
            <View
              style={[
                styles.nodeInner,
                isCompleted && styles.nodeInnerCompleted,
                isActive && styles.nodeInnerActive,
                !isUnlocked && styles.nodeInnerLocked
              ]}
            >
              {isCompleted ? (
                <Text style={styles.checkIcon}>✓</Text>
              ) : !isUnlocked ? (
                <Text style={styles.lockIcon}>🔒</Text>
              ) : (
                <Text style={styles.levelNumberText}>{index + 1}</Text>
              )}
            </View>
            {hasDueReview && (
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeIcon}>🔔</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Level Details Card Area */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleStartLevel(index, level)}
          style={[
            styles.levelCard,
            isActive && styles.levelCardActive,
            !isUnlocked && styles.levelCardLocked
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.levelCardTitle, isUnlocked && styles.textWhite]} numberOfLines={1}>
              المستوى {index + 1}
            </Text>
            <Text style={styles.hizbLabel} numberOfLines={1}>{getHizbLabel(level.rub_number)}</Text>
          </View>

          <Text style={styles.verseRangeText} numberOfLines={1}>
            الآيات: {level.first_verse_key} إلى {level.last_verse_key}
          </Text>

          {level.text_uthmani && (
            <Text
              style={[
                styles.ayahPreviewText,
                !isUnlocked && styles.textMuted
              ]}
              numberOfLines={1}
            >
              {level.text_uthmani.split(' ').slice(0, 5).join(' ')} ...
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#050A07" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.backBtn}>
          <Text style={styles.backText}>{"\u2039"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>خريطة المستويات</Text>
        <TouchableOpacity onPress={handleResetSession} style={styles.resetBtn}>
          <Text style={styles.resetBtnText} numberOfLines={1}>إعادة تعيين</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={levels_data}
        keyExtractor={(_, index) => index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        renderItem={renderLevelItem}
        ListHeaderComponent={
          <View style={styles.dashboardCard}>
            <Text style={styles.dashboardTitle} numberOfLines={1}>مسار التحدي العشوائي</Text>
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, { flexShrink: 1 }]} numberOfLines={1}>
                المستوى {Math.min(current_level_index + 1, totalLevels)} من {totalLevels}
              </Text>
              <Text style={styles.percentText} numberOfLines={1}>{Math.round(progressPercent)}% مكتمل</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: theme.greyLight, fontSize: 16, textAlign: 'center', marginBottom: 20 },
  actionBtn: { backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: theme.background, fontWeight: 'bold', fontSize: 15 },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: { color: theme.primary, fontSize: 26, lineHeight: 30, includeFontPadding: false, marginTop: -2 },
  headerTitle: { fontFamily: 'Amiri', color: theme.primary, fontSize: 22 },
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.error,
  },
  resetBtnText: { color: theme.error, fontSize: 13, fontWeight: '500' },

  scrollContainer: { padding: 16, paddingBottom: 60 },
  
  dashboardCard: {
    backgroundColor: theme.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 20,
    marginBottom: 24,
  },
  dashboardTitle: { fontFamily: 'Amiri', fontSize: 18, color: theme.primary, textAlign: 'right', marginBottom: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressText: { color: theme.white, fontSize: 14 },
  percentText: { color: theme.primary, fontSize: 13, fontWeight: 'bold' },
  progressBarBg: { height: 6, backgroundColor: theme.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 3 },

  timelineContainer: { position: 'relative' },
  levelRow: { flexDirection: 'row', marginBottom: 16, minHeight: 110 },
  
  badgeColumn: { width: 56, alignItems: 'center', position: 'relative', justifyContent: 'center' },
  connectorLine: { position: 'absolute', width: 4, left: 26, backgroundColor: theme.cardBorder },
  connectorLineTop: { top: 0, bottom: '50%' },
  connectorLineBottom: { top: '50%', bottom: 0 },
  connectorLineGreen: { backgroundColor: theme.primary },

  nodeOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
    elevation: 3,
  },
  nodeCompleted: { borderWidth: 2, borderColor: theme.primary, backgroundColor: 'rgba(0, 255, 135, 0.1)' },
  nodeActive: { borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.background },
  nodeLocked: { borderWidth: 2, borderColor: theme.cardBorder, backgroundColor: theme.backgroundCard },
  dueBadge: {
    position: 'absolute', top: -4, right: -4, zIndex: 3,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: theme.background,
    borderWidth: 1.5, borderColor: theme.error,
    justifyContent: 'center', alignItems: 'center',
  },
  dueBadgeIcon: { fontSize: 10 },

  pulseOuter: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.primaryGlow,
    zIndex: -1,
  },
  
  nodeInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeInnerCompleted: { backgroundColor: 'transparent' },
  nodeInnerActive: { backgroundColor: 'rgba(0, 255, 135, 0.2)' },
  nodeInnerLocked: { backgroundColor: 'transparent' },

  checkIcon: { color: theme.primary, fontSize: 18, fontWeight: 'bold' },
  lockIcon: { fontSize: 14 },
  levelNumberText: { color: theme.primary, fontSize: 14, fontWeight: 'bold' },

  levelCard: {
    flex: 1,
    backgroundColor: theme.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 14,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  levelCardActive: { borderColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  levelCardLocked: { opacity: 0.5 },
  
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  levelCardTitle: { fontSize: 15, fontWeight: 'bold', color: theme.greyLight, textAlign: 'right' },
  textWhite: { color: theme.white },
  hizbLabel: { fontSize: 11, color: theme.primary, fontWeight: '500', flexShrink: 1, marginLeft: 8 },
  
  verseRangeText: { color: theme.greyLight, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  ayahPreviewText: { fontFamily: 'Amiri', color: theme.white, fontSize: 14, textAlign: 'right', marginTop: 4 },
  textMuted: { color: theme.grey },
});
