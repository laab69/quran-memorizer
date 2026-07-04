// import React, { useEffect, useState, useCallback } from 'react';
// import { ScrollView, View, Text, StyleSheet } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useVideoPlayer, VideoView } from 'expo-video';
// import Animated, {
//   useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing
// } from 'react-native-reanimated';
// import { useFocusEffect } from '@react-navigation/native';
// import theme from '../theme';
// import DashboardCard from '../components/DashboardCard';
// import MemorizationBar from '../components/MemorizationBar';
// import { useAppStore } from '../store/AppStore';

// function AnimatedCard({ children, index }) {
//   const opacity = useSharedValue(0);
//   const translateY = useSharedValue(30);
//   useEffect(() => {
//     const delay = index * 100;
//     opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
//     translateY.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }));
//   }, []);
//   const style = useAnimatedStyle(() => ({
//     opacity: opacity.value,
//     transform: [{ translateY: translateY.value }],
//   }));
//   return <Animated.View style={style}>{children}</Animated.View>;
// }

// export default function DashboardScreen({ navigation }) {
//   const { store } = useAppStore();
//   const videoSource = require('../../assets/green-swirl.mp4');
//   const player = useVideoPlayer(videoSource, p => {
//     p.loop = true;
//     p.play();
//   });

//   const now = new Date();
//   const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic-nu-latn', {
//     weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
//   });

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <View style={styles.topLeftVideo}>
//         <VideoView
//           player={player}
//           style={styles.video}
//           nativeControls={false}
//           contentFit="cover"
//         />
//       </View>
//       <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
//         <View style={styles.header}>
//           <Text style={styles.bismillah}>{"\uFDFD"}</Text>
//           <Text style={styles.dateText}>{dateStr}</Text>
//         </View>

//         <AnimatedCard index={0}>
//           <DashboardCard
//             title="خريطة الحفظ"
//             onPress={() => navigation.navigate('MemorizationMap')}
//           >
//             <MemorizationBar memorizedIds={Array.from(store.memorizedSet)} />
//           </DashboardCard>
//         </AnimatedCard>

//         <AnimatedCard index={1}>
//           <DashboardCard
//             title="آية عشوائية"
//             subtitle="اختر نطاقاً وابدأ"
//             onPress={() => navigation.navigate('SurahList', { mode: 'random' })}
//           />
//         </AnimatedCard>

//         <AnimatedCard index={2}>
//           <DashboardCard
//             title="اختر آية"
//             subtitle="حدد الآية التي تريد مراجعتها"
//             onPress={() => navigation.navigate('SurahList', { mode: 'choose' })}
//           />
//         </AnimatedCard>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safeArea: { flex: 1, backgroundColor: theme.background },
//   topLeftVideo: {
//     position: 'absolute',
//     top: 28,
//     left: 4,
//     width: 128,
//     height: 128,
//     overflow: 'hidden',
//     zIndex: 100,
//   },
//   video: {
//     ...StyleSheet.absoluteFillObject,
//   },
//   container: { flex: 1, backgroundColor: theme.background },
//   contentContainer: { padding: 20, paddingTop: 50 },
//   header: {
//     alignItems: 'flex-end',
//     marginBottom: 30,
//     paddingBottom: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: theme.cardBorder,
//   },
//   bismillah: {
//     fontFamily: 'Amiri',
//     fontSize: 20,
//     color: theme.primary,
//     textShadowColor: theme.primaryGlow,
//     textShadowOffset: { width: 0, height: 0 },
//     textShadowRadius: 20,
//     includeFontPadding: false,
//   },
//   appName: {
//     fontFamily: 'Amiri',
//     fontSize: 32,
//     color: theme.primary,
//     textShadowColor: 'rgba(201,168,76,0.3)',
//     textShadowOffset: { width: 0, height: 0 },
//     textShadowRadius: 8,
//   },
//   dateText: {
//     color: theme.grey,
//     fontSize: 12,
//     marginTop: 4,
//   },
// });
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import DashboardCard from '../components/DashboardCard';
import MemorizationBar from '../components/MemorizationBar';
import { useAppStore } from '../store/AppStore';
import theme from '../theme';

function AnimatedCard({ children, index }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  
  useEffect(() => {
    const delay = index * 100;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) }));
  }, []);
  
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  
  return <Animated.View style={style}>{children}</Animated.View>;
}

export default function DashboardScreen({ navigation }) {
  const { store, resetStore } = useAppStore();
  const [showResetModal, setShowResetModal] = useState(false);

const handleReset = async () => {
  setShowResetModal(false);
  await resetStore();
};
  // 1. Setup shared value for video fade-in (starts at 0)
  const videoOpacity = useSharedValue(0);
  const videoSource = require('../../assets/green-swirl.mp4');
  
  const player = useVideoPlayer(videoSource, p => {
    p.loop = true;
    p.play();
  });

  // 2. Listen for the video to start playing before showing it
  useEffect(() => {
    const subscription = player.addListener('playingChange', (isPlaying) => {
      const playing = typeof isPlaying === 'object' ? isPlaying.isPlaying : isPlaying;
      
      if (playing) {
        // Fade in smoothly over 500ms
        videoOpacity.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const animatedVideoStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));

  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-SA-u-ca-islamic-nu-latn', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

 return (
  <SafeAreaView style={styles.safeArea}>
    <Modal transparent animationType="fade" visible={showResetModal} onRequestClose={() => setShowResetModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconWrap}>
            <Text style={styles.modalIcon}>✕</Text>
          </View>
          <Text style={styles.modalTitle}>إعادة تعيين الحفظ</Text>
          <Text style={styles.modalSubtitle}>سيتم حذف جميع الآيات المحفوظة وسجل المراجعات. لا يمكن التراجع عن هذا الإجراء.</Text>
          <TouchableOpacity style={styles.modalBtnDanger} onPress={handleReset}>
            <Text style={styles.modalBtnDangerText}>نعم، إعادة التعيين</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowResetModal(false)}>
            <Text style={styles.modalBtnCancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.bismillah}>{"\uFDFD"}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>
      <AnimatedCard index={0}>
        <DashboardCard title="خريطة الحفظ" onPress={() => navigation.navigate('MemorizationMap')}>
          <MemorizationBar memorizedIds={Array.from(store.memorizedSet)} />
        </DashboardCard>
      </AnimatedCard>
      <AnimatedCard index={1}>
        <DashboardCard title="آية عشوائية" subtitle="اختر نطاقاً وابدأ" onPress={() => navigation.navigate('SurahList', { mode: 'random' })} />
      </AnimatedCard>
      <AnimatedCard index={2}>
        <DashboardCard title="اختر آية" subtitle="حدد الآية التي تريد مراجعتها" onPress={() => navigation.navigate('SurahList', { mode: 'choose' })} />
      </AnimatedCard>
    </ScrollView>

    <Animated.View style={[styles.topLeftVideo, animatedVideoStyle]}>
      <VideoView player={player} style={styles.video} nativeControls={false} contentFit="cover" />
    </Animated.View>
    <TouchableOpacity style={styles.topLeftVideoTouchable} onPress={() => setShowResetModal(true)} activeOpacity={0.8} />

  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  topLeftVideoTouchable: {
  position: 'absolute',
  top: 28,
  left: 4,
  width: 128,
  height: 128,
  zIndex: 101,
  elevation: 101,
},
topLeftVideo: {
    position: 'absolute',
    top: 28,
    left: 4,
    width: 128,
    height: 128,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 100,  // 👈 this is the Android fix
    backgroundColor: theme.background,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  container: { flex: 1, backgroundColor: theme.background },
  contentContainer: { padding: 20, paddingTop: 50 },
  header: {
    alignItems: 'flex-end',
    marginBottom: 30,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
  },
  bismillah: {
    fontFamily: 'Amiri',
    fontSize: 20,
    color: theme.primary,
    textShadowColor: theme.primaryGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    includeFontPadding: false,
  },
  appName: {
    fontFamily: 'Amiri',
    fontSize: 32,
    color: theme.primary,
    textShadowColor: 'rgba(201,168,76,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  dateText: {
    color: theme.grey,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
modalCard: { backgroundColor: theme.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: theme.cardBorder, padding: 28, width: '100%', alignItems: 'center' },
modalIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(231,76,60,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
modalIcon: { color: '#e74c3c', fontSize: 20 },
modalTitle: { fontFamily: 'Amiri', color: theme.white, fontSize: 20, marginBottom: 10, textAlign: 'center' },
modalSubtitle: { color: theme.grey, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
modalBtnDanger: { width: '100%', padding: 14, borderRadius: 10, backgroundColor: 'rgba(231,76,60,0.15)', alignItems: 'center', marginBottom: 10 },
modalBtnDangerText: { color: '#e74c3c', fontSize: 15, fontWeight: '500' },
modalBtnCancel: { width: '100%', padding: 14, borderRadius: 10, backgroundColor: theme.backgroundCard, borderWidth: 1, borderColor: theme.cardBorder, alignItems: 'center' },
modalBtnCancelText: { color: theme.white, fontSize: 15 },
});
