// import { useState } from 'react';
// import { View, Text, TouchableOpacity, Modal, Image } from 'react-native';
// import { useRouter, usePathname } from 'expo-router';
// import {
//   Music,
//   Menu,
//   X,
//   Home,
//   CalendarDays,
//   CreditCard,
//   LogOut,
// } from 'lucide-react-native';
// import { useAuth } from '../context/AuthContext';

// type StudentOption = { id: string; name: string; instrument: string };

// type Props = {
//   students: StudentOption[];
//   selectedId: string;
//   onSelect: (id: string) => void;
// };

// function getInitials(name: string) {
//   const parts = name.trim().split(' ');
//   const first = parts[0]?.[0] ?? '';
//   const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
//   return (first + last).toUpperCase();
// }

// const menuLinks = [
//   { path: '/', label: 'Início', icon: Home },
//   { path: '/lessons', label: 'Aulas', icon: CalendarDays },
//   { path: '/payments', label: 'Pagamentos', icon: CreditCard },
// ];

// export function DashboardHeader({ students, selectedId, onSelect }: Props) {
//   const { user, signOut } = useAuth();
//   const router = useRouter();
//   const pathname = usePathname();
//   const [pickerOpen, setPickerOpen] = useState(false);
//   const [menuOpen, setMenuOpen] = useState(false);

//   const selected = students.find((s) => s.id === selectedId);

//   function go(path: string) {
//     setMenuOpen(false);
//     router.push(path as any);
//   }

//   return (
//     <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-[#F5F1EA]">
//       <View className="flex-row items-center gap-1.5">
//         {/* <Music size={18} color="#1A1A1A" /> */}
//         <Image
//           source={logo}
//           style={{ width: 28, height: 28 }}
//           resizeMode="contain"
//         />

//         {/* <Text
//           className="text-lg"
//           style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
//         >
//           Pianíssima
//         </Text> */}
//       </View>

//       <TouchableOpacity
//         className="flex-row items-center bg-white rounded-full px-4 py-2 gap-1"
//         onPress={() => setPickerOpen(true)}
//       >
//         <Text className="font-medium">{selected?.name}</Text>
//         <Text className="text-gray-400">▾</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         className="w-10 h-10 rounded-full bg-white items-center justify-center"
//         onPress={() => setMenuOpen(true)}
//       >
//         <Menu size={18} color="#1A1A1A" />
//       </TouchableOpacity>

//       {/* Seletor de aluno */}
//       <Modal visible={pickerOpen} transparent animationType="fade">
//         <TouchableOpacity
//           className="flex-1 bg-black/30 justify-center px-6"
//           activeOpacity={1}
//           onPress={() => setPickerOpen(false)}
//         >
//           <View className="bg-white rounded-2xl p-2">
//             {students.map((s) => (
//               <TouchableOpacity
//                 key={s.id}
//                 className="px-4 py-3 rounded-xl"
//                 onPress={() => {
//                   onSelect(s.id);
//                   setPickerOpen(false);
//                 }}
//               >
//                 <Text className="font-medium">{s.name}</Text>
//                 <Text className="text-gray-500 text-sm">{s.instrument}</Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </TouchableOpacity>
//       </Modal>

//       {/* Sidebar (drawer da direita) */}
//       <Modal visible={menuOpen} transparent animationType="fade">
//         <View className="flex-1">
//           <TouchableOpacity
//             className="absolute inset-0 bg-black/40"
//             activeOpacity={1}
//             onPress={() => setMenuOpen(false)}
//           />

//           <View
//             className="absolute right-0 top-0 bottom-0 bg-white"
//             style={{ width: 288 }}
//           >
//             {/* Header escuro com avatar */}
//             <View className="bg-[#1A1A1A] px-5 pt-14 pb-6">
//               <View className="flex-row items-center justify-between mb-6">
//                 <View className="flex-row items-center gap-1.5">
//                   {/* <Music size={16} color="#B08D57" /> */}
//                   {/* <Text
//                     className="text-white text-base"
//                     style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
//                   >
//                     Pianíssima
//                   </Text> */}
//                 </View>
//                 <TouchableOpacity onPress={() => setMenuOpen(false)}>
//                   <X size={18} color="rgba(255,255,255,0.7)" />
//                 </TouchableOpacity>
//               </View>

//               <View className="flex-row items-center gap-3">
//                 {user?.avatarUrl ? (
//                   <Image
//                     source={{ uri: user.avatarUrl }}
//                     className="w-11 h-11 rounded-full"
//                   />
//                 ) : (
//                   <View className="w-11 h-11 rounded-full bg-[#B08D57] items-center justify-center">
//                     <Text className="text-white font-bold">
//                       {getInitials(user?.name ?? '?')}
//                     </Text>
//                   </View>
//                 )}
//                 <View>
//                   <Text className="text-white font-semibold text-base">
//                     {user?.name}
//                   </Text>
//                   {user?.email && (
//                     <Text className="text-white/50 text-xs mt-0.5">
//                       {user.email}
//                     </Text>
//                   )}
//                 </View>
//               </View>
//             </View>

//             {/* Navegação */}
//             <View className="flex-1 p-3">
//               {menuLinks.map((item) => {
//                 const active =
//                   item.path === '/'
//                     ? pathname === '/'
//                     : pathname.startsWith(item.path);
//                 const Icon = item.icon;
//                 return (
//                   <TouchableOpacity
//                     key={item.path}
//                     onPress={() => go(item.path)}
//                     className={`flex-row items-center gap-3 px-3 py-3 rounded-xl ${
//                       active ? 'bg-[#F3EADD]' : ''
//                     }`}
//                   >
//                     <Icon size={18} color={active ? '#B08D57' : '#1A1A1A'} />
//                     <Text
//                       className={`text-sm font-medium ${
//                         active ? 'text-[#B08D57]' : 'text-[#1A1A1A]'
//                       }`}
//                     >
//                       {item.label}
//                     </Text>
//                   </TouchableOpacity>
//                 );
//               })}
//             </View>

//             {/* Sair */}
//             <View className="p-3 border-t border-gray-100">
//               <TouchableOpacity
//                 className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
//                 onPress={() => {
//                   setMenuOpen(false);
//                   signOut();
//                 }}
//               >
//                 <LogOut size={18} color="#DC2626" />
//                 <Text className="text-sm font-medium text-red-600">Sair</Text>
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }
