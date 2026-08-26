module.exports = {
  expo: {
    name: 'Pianíssima',
    slug: 'mobile',
    version: '1.0.0',
    scheme: 'pianissima', // NOVO — necessário pro deep link pianissima://set-password funcionar
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.henrique_militao.pianissima',
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
