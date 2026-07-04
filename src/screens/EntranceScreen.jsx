import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, runOnJS, Easing
} from 'react-native-reanimated';
import theme from '../theme';
import { setupDatabases } from '../db/queries';
import { useAppStore } from '../store/AppStore';

const { width, height } = Dimensions.get('window');

export default function EntranceScreen({ navigation }) {
  const { initStore, ready } = useAppStore();
  const [waitingForStore, setWaitingForStore] = useState(false);
  const opacity = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);
  const videoOpacity = useSharedValue(0); // Start the video completely hidden
  
  const videoSource = require('../../assets/green-swirl.mp4');

  const player = useVideoPlayer(videoSource, p => {
    p.loop = true;
    p.play();
  });

  // Listen for the video to actually start playing before showing it
  useEffect(() => {
    const subscription = player.addListener('playingChange', (isPlaying) => {
      // Some versions of expo-video return an object payload, others a boolean. 
      // This check safely handles both.
      const playing = typeof isPlaying === 'object' ? isPlaying.isPlaying : isPlaying;
      
      if (playing) {
        // Fade the video in smoothly behind the Bismillah
        videoOpacity.value = withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, []);

  useEffect(() => {
    setupDatabases().then(() => initStore());
  }, []);

  useEffect(() => {
    if (waitingForStore && ready) {
      handleTransition();
    }
  }, [ready, waitingForStore]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));
  const animatedVideoStyle = useAnimatedStyle(() => ({ opacity: videoOpacity.value }));

  const handleTransition = () => {
    opacity.value = withTiming(0, { duration: 600 }, (fin) => {
      if (fin) runOnJS(navigation.replace)('Dashboard');
    });
  };

  const handlePress = () => {
    if (!ready) {
      setWaitingForStore(true);
      return;
    }
    handleTransition();
  };

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Wrap the video in an Animated.View to handle the fade-in */}
      <Animated.View style={[styles.videoWrapper, animatedVideoStyle]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(5,10,7,0.4)', '#050A07']}
          locations={[0, 0.7, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.titleWrap}>
          <Text style={styles.bismillah}>{'\uFDFD'}</Text>
        </View>
        <Animated.Text style={[styles.tapHint, pulseStyle]}>
          المس الشاشة للبدء
        </Animated.Text>
      </View>

      {waitingForStore && !ready && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.bismillah}>{'\uFDFD'}</Text>
        </View>
      )}

      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={handlePress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050A07', justifyContent: 'center', alignItems: 'center' },
  videoWrapper: {
    width: '85%',
    height: '65%',
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.primaryGlow,
    position: 'absolute',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    pointerEvents: 'none',
  },
  titleWrap: { alignItems: 'center' },
  bismillah: {
    fontFamily: 'Amiri',
    fontSize: 34,
    margin: 5,
    color: theme.primary,
    textShadowColor: theme.primaryGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    includeFontPadding: false,
  },
  tapHint: {
    position: 'absolute',
    bottom: 50,
    color: theme.greyLight,
    fontSize: 13,
    letterSpacing: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5,10,7,0.7)',
    zIndex: 10,
  },
});
