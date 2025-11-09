import { View, Text, StyleSheet, ScrollView, RefreshControl} from 'react-native';
import { Stack } from 'expo-router';
import { User, Mail, Phone, MapPin, Calendar, CreditCard } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase'; // ← اعتماد مباشر على Supabase
import { useState, useEffect } from 'react';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user?.id) {
      setError('لم يتم العثور على معرف المستخدم');
      setLoading(false);
      return;
    }

    try {
      // جلب بيانات الموظف
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', user.id)
        .single();

      if (empError) throw empError;

      // جلب بيانات الفرع إن وُجد
      let branchData = null;
      if (empData.branch_id) {
        const { data: brData, error: brError } = await supabase
          .from('branches')
          .select('name, location')
          .eq('id', empData.branch_id)
          .single();

        if (!brError) branchData = brData;
      }

      setEmployee(empData);
      setBranch(branchData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError('فشل تحميل بيانات الملف الشخصي. يرجى المحاولة لاحقًا.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  // حالة التحميل
  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'الملف الشخصي' }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  // حالة الخطأ
  if (error || !employee) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'الملف الشخصي' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'لم يتم العثور على بيانات الموظف'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'الملف الشخصي',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* رأس الملف */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#fff" />
          </View>
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.position}>{employee.position}</Text>
        </View>

        {/* معلومات الاتصال */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات الاتصال</Text>
          <InfoRow icon={<Mail size={20} color={Colors.primary} />} label="البريد الإلكتروني" value={employee.email} />
          <InfoRow icon={<Phone size={20} color={Colors.primary} />} label="رقم الهاتف" value={employee.phone || 'غير متوفر'} />
          <InfoRow icon={<MapPin size={20} color={Colors.primary} />} label="العنوان" value={employee.address || 'غير متوفر'} />
        </View>

        {/* معلومات العمل */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات العمل</Text>
          <InfoRow
            icon={<MapPin size={20} color={Colors.primary} />}
            label="الفرع"
            value={branch ? `${branch.name} / ${branch.location}` : 'غير محدد'}
          />
          <InfoRow
            icon={<Calendar size={20} color={Colors.primary} />}
            label="تاريخ التعيين"
            value={
              employee.hire_date
                ? new Date(employee.hire_date).toLocaleDateString('ar-EG', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'غير متوفر'
            }
          />
          <InfoRow
            icon={<CreditCard size={20} color={Colors.primary} />}
            label="رقم الهوية"
            value={employee.national_id || 'غير متوفر'}
          />
        </View>

        {/* جهة الاتصال في الطوارئ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جهة الاتصال في حالات الطوارئ</Text>
          <InfoRow
            icon={<User size={20} color={Colors.primary} />}
            label="الاسم"
            value={employee.emergency_contact || 'غير متوفر'}
          />
          <InfoRow
            icon={<Phone size={20} color={Colors.primary} />}
            label="رقم الهاتف"
            value={employee.emergency_phone || 'غير متوفر'}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// مكون مساعد لسطر المعلومات
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <View style={styles.infoRow}>
    {icon}
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    writingDirection: 'rtl',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  position: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginBottom: 16,
    writingDirection: 'rtl',
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  infoValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});