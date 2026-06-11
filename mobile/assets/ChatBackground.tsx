// ChatBackground.tsx
// Drop-in animal-doodle wallpaper for React Native (Expo).
//
// HOW IT WORKS (the engineering bit):
// The PNGs are SEAMLESS TILES (1024x1024). Do NOT stretch them to fill the
// screen — instead repeat the tile with resizeMode="repeat". This keeps the
// doodles crisp at any screen size/density and uses almost no memory.
//
// FILES: put wallpaper_light_tile.png and wallpaper_dark_tile.png in
//   ./assets/  (or wherever you keep images)

import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';

const TILES = {
  light: require('./assets/wallpaper_light_tile.png'),
  dark: require('./assets/wallpaper_dark_tile.png'),
};

// Background colors must match the tile bg so the repeat seams are invisible
// even on the device's overscroll / safe-area edges.
const BG = {
  light: '#FFFFFF',
  dark: '#0B141A',
};

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Force a scheme; defaults to the system setting. */
  scheme?: 'light' | 'dark';
};

export default function ChatBackground({ children, style, scheme }: Props) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const mode = scheme ?? (system === 'dark' ? 'dark' : 'light');

  return (
    <View style={[styles.fill, { backgroundColor: BG[mode] }, style]}>
      <ImageBackground
        source={TILES[mode]}
        resizeMode="repeat"   // <-- the key: tile, don't stretch
        style={styles.fill}
      >
        {children}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

/* ----------------------------------------------------------------------
USAGE:

import ChatBackground from './ChatBackground';

export default function ChatScreen() {
  return (
    <ChatBackground>
      // ... your message list, input bar, etc.
    </ChatBackground>
  );
}
---------------------------------------------------------------------- */
