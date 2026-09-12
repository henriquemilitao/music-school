const APP_VARIANT = process.env.APP_VARIANT || 'development';

module.exports = {
  expo: {
    name:
      APP_VARIANT === 'development'
        ? 'Pianíssima (Dev)'
        : APP_VARIANT === 'preview'
          ? 'Pianíssima (Preview)'
          : 'Pianíssima',
    slug: 'mobile',
    version: '1.0.0',
    scheme:
      APP_VARIANT === 'development'
        ? 'pianissimadev'
        : APP_VARIANT === 'preview'
          ? 'pianissimapreview'
          : 'pianissima',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,

    // Configurações do EAS Update
    updates: {
      url: 'https://u.expo.dev/a6d3384d-04f9-45ab-9ee8-d9c1258633f0',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier:
        APP_VARIANT === 'development'
          ? 'com.henrique_militao.pianissima.dev'
          : APP_VARIANT === 'preview'
            ? 'com.henrique_militao.pianissima.preview'
            : 'com.henrique_militao.pianissima',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package:
        APP_VARIANT === 'development'
          ? 'com.henrique_militao.pianissima.dev'
          : APP_VARIANT === 'preview'
            ? 'com.henrique_militao.pianissima.preview'
            : 'com.henrique_militao.pianissima',
      googleServicesFile: './google-services.json',
    },
    web: {
      favicon: './assets/icon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      '@react-native-community/datetimepicker',
      'expo-notifications',
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'a6d3384d-04f9-45ab-9ee8-d9c1258633f0',
      },
    },
  },
};
