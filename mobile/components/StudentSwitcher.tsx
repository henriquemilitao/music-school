import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  useDerivedValue,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useStudent } from '../context/StudentContext';
import { formatInstrument } from '../lib/instrument';
import { usePathname } from 'expo-router';

const SWITCHER_HEIGHT = 56; // altura aproximada do conteúdo (ajuste conforme seu design)
const ROUTES_WITH_SWITCHER = ['/', '/lessons'];

export function StudentSwitcher() {
  const { students, selectedStudentId, setSelectedStudentId } = useStudent();
  const pathname = usePathname();

  const visible =
    students.length > 1 && ROUTES_WITH_SWITCHER.includes(pathname);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: 400,
    });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.value * SWITCHER_HEIGHT,
    opacity: progress.value,
    overflow: 'hidden',
  }));

  // Se não há mais de 1 aluno, nunca faz sentido mostrar (economiza render)
  if (students.length <= 1) return null;

  return (
    <Animated.View
      className="bg-[#F5F1EA]"
      style={[
        { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
        animatedStyle,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 pt-3 pb-3"
        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
      >
        {students.map((student) => {
          const active = student.id === selectedStudentId;
          const instrument = formatInstrument(student.instrument);
          return (
            <TouchableOpacity
              key={student.id}
              onPress={() => setSelectedStudentId(student.id)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? '#B08D57' : '#FFFFFF',
                borderWidth: 1,
                borderColor: active ? '#B08D57' : 'rgba(0,0,0,0.08)',
                shadowColor: '#000',
                shadowOpacity: active ? 0 : 0.04,
                shadowRadius: 4,
                elevation: active ? 0 : 1,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active
                    ? 'rgba(255,255,255,0.25)'
                    : '#F3EADD',
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: active ? '#fff' : '#B08D57',
                  }}
                >
                  {student.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: active ? '#fff' : '#1A1A1A',
                }}
              >
                {student.name}
              </Text>

              {instrument ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: active ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                  }}
                >
                  {instrument}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
