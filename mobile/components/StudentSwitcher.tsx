import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useStudent } from '../context/StudentContext';
import { formatInstrument } from '../lib/instrument';
import { usePathname } from 'expo-router';

export function StudentSwitcher() {
  const { students, selectedStudentId, setSelectedStudentId } = useStudent();
  const pathname = usePathname(); // <-- NOVO

  // Invisível quando há apenas 1 aluno OU na tab de pagamentos
  if (students.length <= 1 || pathname === '/payments') return null;

  return (
    <View
      className="bg-[#F5F1EA]"
      style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 pt-1 pb-3"
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
              {/* Avatar com inicial */}
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

              {/* Nome */}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: active ? '#fff' : '#1A1A1A',
                }}
              >
                {student.name}
              </Text>

              {/* Instrumento */}
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
    </View>
  );
}
