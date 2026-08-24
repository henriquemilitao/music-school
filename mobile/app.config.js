module.exports = {
  expo: {
    name: 'Pianíssima',
    slug: 'mobile',
    version: '1.0.0',
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
        foregroundImage: './assets/icon.png',
        backgroundColor: '#F7F4EE',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.henrique.pianissima',
      googleServicesFile: './google-services.json',
    },
    web: {
      favicon: './assets/icon.png',
    },

    // 👇 O LUGAR CORRETO PARA O FIREBASE LER O ÍCONE
    notification: {
      icon: './assets/notification_icon.png',
      color: '#B08D57',
    },

    plugins: [
      'expo-router',
      'expo-font',
      '@react-native-community/datetimepicker',
      'expo-notifications', // Volta a ser apenas uma string
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'eb8bbade-2329-4c46-8050-97c3f8170c57',
      },
    },
  },
};
