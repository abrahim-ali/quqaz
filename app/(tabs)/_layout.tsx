import { Tabs } from 'expo-router';
import { Home, Users, FileText, Bell, User,Fingerprint } from 'lucide-react-native';
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';


export default function TabLayout() {
  const { user, isLoading, isEmployee, isAccountant, isGeneralAccountant ,isGeneralManager} = useAuth();
  // لا تعرض شيئًا حتى يتم تحميل حالة المستخدم
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // إذا لم يكن هناك مستخدم (غير مسجل دخوله)، أعد التوجيه إلى /login
  if (!user) {
    // يمكنك استخدام router.replace('/login') هنا، لكن في التبويبات، من الأفضل التأكد من الحماية في _layout
    return null;
  }

  // الآن قرر التخطيط بناءً على الدور
  const isAccountantOrGeneral = isAccountant || isGeneralAccountant ;
 
  if (isEmployee) {
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            height: 60,
            padding: 'auto',
            paddingTop: 4,
            paddingBottom: 0,
          },
        }}
      >
        {/* تبويبات الموظف */}
        <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <Home size={30} color={color} /> }} />
        <Tabs.Screen name="requests" options={{ title: 'الطلبات', tabBarIcon: ({ color }) => <FileText size={30} color={color} /> }} />
        <Tabs.Screen name="attendance" options={{ title: 'تسجيل الحضور', tabBarIcon: ({ color }) => <Fingerprint size={30} color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'الملف الشخصي', tabBarIcon: ({ color }) => <User size={30} color={color} /> }} />
        
        {/* إخفاء تبويبات المحاسب */}
        <Tabs.Screen name="notifications" options={{ href: null }}/>
        <Tabs.Screen name="accountant" options={{ href: null }} />
        <Tabs.Screen name="employees" options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="attendancescreen" options={{ href: null }} />
        <Tabs.Screen name="payments" options={{ href: null }} />
      </Tabs>
    );
  }

  if (isAccountantOrGeneral){
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            height: 60,
            padding: 'auto',
            paddingTop: 4,
            paddingBottom: 0,
          },
        }}
      >
        {/* تبويبات المحاسب */}
        <Tabs.Screen name="accountant" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <Home size={30} color={color} /> }} />
        <Tabs.Screen name="employees" options={{ title: 'الموظفين', tabBarIcon: ({ color }) => <Users size={30} color={color} /> }} />
        <Tabs.Screen name="payments" options={{ title: 'الرواتب', tabBarIcon: ({ color }) => <FileText size={30} color={color} /> }} />
        <Tabs.Screen name="requests" options={{ title: 'الطلبات', tabBarIcon: ({ color }) => <FileText size={30} color={color} /> }} />
        <Tabs.Screen name="attendance" options={{ title: 'تسجيل الحضور', tabBarIcon: ({ color }) => <Fingerprint size={30} color={color} /> }} />
        
        
        {/* إخفاء تبويبات الموظف */}
        <Tabs.Screen name="profile"  options={{ href: null }} />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="attendancescreen" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    );
  }

  if (isGeneralManager){
    return (
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            height: 60,
            padding: 'auto',
            paddingTop: 4,
            paddingBottom: 0,
          },
        }}
      >
        {/* تبويبات المحاسب */}
        <Tabs.Screen name="accountant" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <Home size={30} color={color} /> }} />
        <Tabs.Screen name="employees" options={{ title: 'الموظفين', tabBarIcon: ({ color }) => <Users size={30} color={color} /> }} />
        <Tabs.Screen name="payments" options={{ title: 'الرواتب', tabBarIcon: ({ color }) => <FileText size={30} color={color} /> }} />
        <Tabs.Screen name="attendancescreen" options={{ title: 'الحضور', tabBarIcon: ({ color }) => <Fingerprint size={30} color={color} /> }} />
        <Tabs.Screen name="reports" options={{ title: 'التقارير', tabBarIcon: ({ color }) => <FileText size={30} color={color} /> }} />
        
        
        {/* إخفاء تبويبات الموظف */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="attendance" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="requests" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  // افتراضي: عالج حالة غير متوقعة
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}