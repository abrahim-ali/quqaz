import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  DollarSign,
  Calendar,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  LogOut,
  Gift,
  User,
  Bell,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

// دالة لحساب موعد الدفع القادم
const getNextPaymentDate = (employee: any, payments: any[]): Date | null => {
  const hireDate = employee.hire_date ? new Date(employee.hire_date) : null;
  if (!hireDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (employee.payment_frequency === 'monthly') {
    const lastPayment = payments
      .filter((p: any) => p.employee_id === employee.id)
      .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

    if (lastPayment) {
      const lastDate = new Date(lastPayment.payment_date);
      return new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, lastDate.getDate());
    } else {
      const dayOfMonth = hireDate.getDate();
      let year = today.getFullYear();
      let month = today.getMonth();
      if (today.getDate() >= dayOfMonth) {
        month += 1;
      }
      return new Date(year, month, dayOfMonth);
    }
  } else {
    // أسبوعي
    const lastPayment = payments
      .filter((p: any) => p.employee_id === employee.id)
      .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

    if (lastPayment) {
      const lastDate = new Date(lastPayment.payment_date);
      return new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      return new Date(hireDate);
    }
  }
};

const SalaryCountdownAlert = ({ employee, payments }: { employee: any; payments: any[] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextPaymentDate = getNextPaymentDate(employee, payments);

  if (!nextPaymentDate) return null;

  const timeDiff = nextPaymentDate.getTime() - today.getTime();
  const daysUntilPayment = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysUntilPayment < 0 || daysUntilPayment > 3) return null;

  let message = '';
  if (daysUntilPayment === 0) {
    message = 'اليوم هو موعد صرف الراتب!';
  } else {
    message = `باقي ${daysUntilPayment} ${daysUntilPayment === 1 ? 'يوم' : 'أيام'} على صرف الراتب`;
  }

  return (
    <View style={styles.alertContainer}>
      <Text style={styles.alertText}>{message}</Text>
    </View>
  );
};

export default function EmployeeHomeScreen() {
  const { user, logout, isEmployee } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // States for data
  const [employee, setEmployee] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    const unread = data?.filter((n: any) => !n.read).length || 0;
    setUnreadCount(unread);
  };

  const fetchEmployeeData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // جلب بيانات الموظف
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', user.id)
        .single();

      if (empError || !empData) {
        console.error('Employee not found or error:', empError);
        setEmployee(null);
        return;
      }

      setEmployee(empData);

      // جلب السلف
      const { data: advData } = await supabase
        .from('advance_requests')
        .select('*')
        .eq('employee_id', user.id)
        .order('request_date', { ascending: false });

      // جلب الإجازات
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', user.id)
        .order('request_date', { ascending: false });

      // جلب الخصومات
      const { data: dedData } = await supabase
        .from('deductions')
        .select('*')
        .eq('employee_id', user.id)
        .order('date', { ascending: false });

      // جلب المكافآت
      const { data: rewData } = await supabase
        .from('rewards')
        .select('*')
        .eq('employee_id', user.id)
        .order('date', { ascending: false });

      // جلب دفعات الرواتب
      const { data: payData } = await supabase
        .from('salary_payments')
        .select('*')
        .eq('employee_id', user.id)
        .order('payment_date', { ascending: false });

      // معالجة الخصومات والغيابات بأمان
      const deductionsList = dedData || [];
      const absenceList = deductionsList.filter(d => d.type === 'absence');

      // تحديث الحالة
      setAdvances(advData || []);
      setLeaves(leaveData || []);
      setDeductions(deductionsList);
      setRewards(rewData || []);
      setPayments(payData || []);
      setAbsences(absenceList);
    } catch (error) {
      console.error('Unexpected error in fetchEmployeeData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchNotifications();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployeeData();
    await fetchNotifications(); 
    setRefreshing(false);
  };

  const handleLogout = () => setShowLogoutModal(true);

  const markAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    const unreadIds = notifications
      .filter((n: any) => !n.read)
      .map((n: any) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('Failed to mark notifications as read:', error);
    } else {
      // تحديث الحالة محليًا
      setNotifications(prev =>
        prev.map(n => (unreadIds.includes(n.id) ? { ...n, read: true } : n))
      );
      setUnreadCount(0);
    }
  };

  const openNotificationsModal = () => {
    setShowNotificationsModal(true);
    // عند فتح النافذة، نُحدّث الإشعارات إلى "مقروءة"
    markAllAsRead();
  };

  if (!user || !isEmployee) {
    return <Redirect href="/accountant" />;
  }

  if (loading || !employee) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>جاري تحميل بيانات الموظف...</Text>
      </View>
    );
  }

  // حسابات مالية
  const pendingAdvances = advances.filter(a => a.status === 'pending');
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const totalAbsences = absences.length;

  const approvedAdvances = advances.filter(a => a.status === 'approved');
  const totalApprovedAdvances = approvedAdvances.reduce((sum, a) => sum + a.amount, 0);

  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const totalRewards = rewards.reduce((sum, r) => sum + r.amount, 0);

  const net_salary = employee.salary + totalRewards - totalApprovedAdvances - totalDeductions;

  const lastPayment = payments[0]; // آخر راتب مستلم

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'الرئيسية',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => (
            <TouchableOpacity
              onPress={openNotificationsModal}
              style={{ marginRight: 16 }}
            >
              <View>
                <Bell size={24} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <SalaryCountdownAlert employee={employee} payments={payments} />

        <View style={styles.welcomeCard}>
          {/* الجزء الأيسر: الآيفون */}
          <View style={styles.avatarContainer}>
            <User size={48} color="#fff" />
          </View>

          {/* الجزء الأيمن: النصوص */}
          <View style={styles.textContainer}>
            <Text style={styles.welcomeText}>مرحباً،</Text>
            <Text style={styles.employeeName}>{employee.name}</Text>
            <Text style={styles.employeePosition}>{employee.position}</Text>
          </View>
        </View>

        {/* بطاقة الراتب */}
        <View style={styles.salaryCard}>
          <View style={styles.salaryHeader}>
            <DollarSign size={32} color="#fff" />
            <Text style={styles.salaryLabel}>الراتب</Text>
          </View>
          <View style={styles.salaryBreakdown}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryRowLabel}>الراتب الأساسي:</Text>
              <Text style={styles.salaryRowValue}>{employee.salary.toLocaleString('ar-EG')} دينار</Text>
            </View>
            {totalRewards > 0 && (
              <View style={styles.salaryRow}>
                <Text style={styles.salaryRowLabel}>المكافآت:</Text>
                <Text style={[styles.salaryRowValue, { color: '#34d399' }]}>+{totalRewards.toLocaleString('ar-EG')} دينار</Text>
              </View>
            )}
            {totalApprovedAdvances > 0 && (
              <View style={styles.salaryRow}>
                <Text style={styles.salaryRowLabel}>السلف:</Text>
                <Text style={[styles.salaryRowValue, { color: '#fbbf24' }]}>-{totalApprovedAdvances.toLocaleString('ar-EG')} دينار</Text>
              </View>
            )}
            {totalDeductions > 0 && (
              <View style={styles.salaryRow}>
                <Text style={styles.salaryRowLabel}>الخصومات:</Text>
                <Text style={[styles.salaryRowValue, { color: '#fca5a5' }]}>-{totalDeductions.toLocaleString('ar-EG')} دينار</Text>
              </View>
            )}
            <View style={[styles.salaryRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', marginTop: 8, paddingTop: 8 }]}>
              <Text style={[styles.salaryRowLabel, { fontWeight: '700' }]}>الصافي:</Text>
              <Text style={[styles.salaryRowValue, { fontSize: 24, fontWeight: '700' }]}>{net_salary.toLocaleString('ar-EG')} دينار</Text>
            </View>
          </View>
          <View style={styles.salaryFrequency}>
            <Clock size={16} color="#fff" />
            <Text style={styles.salaryFrequencyText}>
              {employee.payment_frequency === 'monthly' ? 'شهري' : 'أسبوعي'}
            </Text>
          </View>
        </View>

        {/* الإحصائيات */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: Colors.warning }]}>
            <AlertCircle size={24} color="#fff" />
            <Text style={styles.statValue}>{pendingAdvances.length}</Text>
            <Text style={styles.statLabel}>سلف معلقة</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.primaryLight }]}>
            <Calendar size={24} color="#fff" />
            <Text style={styles.statValue}>{pendingLeaves.length}</Text>
            <Text style={styles.statLabel}>إجازات معلقة</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#34d399' }]}>
            <Gift size={24} color="#fff" />
            <Text style={styles.statValue}>{totalRewards.toLocaleString('ar-EG')}</Text>
            <Text style={styles.statLabel}>المكافآت</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.danger }]}>
            <TrendingUp size={24} color="#fff" />
            <Text style={styles.statValue}>{totalDeductions.toLocaleString('ar-EG')}</Text>
            <Text style={styles.statLabel}>الخصومات</Text>
          </View>
        </View>

        {/* آخر راتب مستلم */}
        {lastPayment && (
          <View style={styles.lastPaymentCard}>
            <View style={styles.lastPaymentHeader}>
              <CheckCircle size={24} color={Colors.success} />
              <Text style={styles.lastPaymentTitle}>آخر راتب مستلم</Text>
            </View>
            <View style={styles.lastPaymentDetails}>
              <View style={styles.lastPaymentRow}>
                <Text style={styles.lastPaymentLabel}>المبلغ الصافي:</Text>
                <Text style={styles.lastPaymentValue}>
                  {lastPayment.net_salary.toLocaleString('ar-EG')} دينار
                </Text>
              </View>
              <View style={styles.lastPaymentRow}>
                <Text style={styles.lastPaymentLabel}>التاريخ:</Text>
                <Text style={styles.lastPaymentValue}>
                  {new Date(lastPayment.payment_date).toLocaleDateString('ar-EG')}
                </Text>
              </View>
              <View style={styles.lastPaymentRow}>
                <Text style={styles.lastPaymentLabel}>الفترة:</Text>
                <Text style={styles.lastPaymentValue}>{lastPayment.period}</Text>
              </View>
            </View>
          </View>
        )}

        {/* المكافآت */}
        {rewards.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>المكافآت</Text>
            {rewards.map(reward => (
              <View key={reward.id} style={styles.rewardItem}>
                <View style={styles.rewardHeader}>
                  <Text style={styles.rewardAmount}>+{reward.amount.toLocaleString('ar-EG')} دينار</Text>
                  <Text style={styles.rewardDate}>
                    {new Date(reward.date).toLocaleDateString('ar-EG')}
                  </Text>
                </View>
                <Text style={styles.rewardReason}>{reward.reason}</Text>
              </View>
            ))}
            <View style={styles.totalRewardsRow}>
              <Text style={styles.totalRewardsLabel}>إجمالي المكافآت:</Text>
              <Text style={styles.totalRewardsValue}>
                +{totalRewards.toLocaleString('ar-EG')} دينار
              </Text>
            </View>
          </View>
        )}

        {/* الخصومات */}
        {deductions.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>الخصومات</Text>
            {deductions.map(deduction => (
              <View key={deduction.id} style={styles.deductionItem}>
                <View style={styles.deductionHeader}>
                  <Text style={styles.deduction_amount}>-{deduction.amount.toLocaleString('ar-EG')} دينار</Text>
                  <Text style={styles.deductionType}>
                    {deduction.type === 'penalty' ? 'جزاء' : 
                     deduction.type === 'late' ? 'تأخير' : 
                     deduction.type === 'absence' ? 'غياب' : 'أخرى'}
                  </Text>
                </View>
                <Text style={styles.deductionReason}>{deduction.reason}</Text>
                <Text style={styles.deductionDate}>
                  {new Date(deduction.date).toLocaleDateString('ar-EG')}
                </Text>
              </View>
            ))}
            <View style={styles.totalDeductionsRow}>
              <Text style={styles.totalDeductionsLabel}>إجمالي الخصومات:</Text>
              <Text style={styles.totalDeductionsValue}>
                {totalDeductions.toLocaleString('ar-EG')} دينار
              </Text>
            </View>
          </View>
        )}

        {/* الغيابات */}
        {absences.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>الغيابات</Text>
            {absences.map(absence => (
              <View key={absence.id} style={styles.absenceItem}>
                <View style={styles.absenceHeader}>
                  <Text style={styles.absenceDate}>
                    {new Date(absence.date).toLocaleDateString('ar-EG')}
                  </Text>
                  {absence.deduction_amount > 0 && (
                    <Text style={styles.absenceDeduction}>
                      خصم: {absence.deduction_amount.toLocaleString('ar-EG')} دينار
                    </Text>
                  )}
                </View>
                {absence.reason && (
                  <Text style={styles.absenceReason}>{absence.reason}</Text>
                )}
              </View>
            ))}
            <View style={styles.totalAbsencesRow}>
              <Text style={styles.totalAbsencesLabel}>إجمالي الغيابات:</Text>
              <Text style={styles.totalAbsencesValue}>{totalAbsences} يوم</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Logout */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>تسجيل الخروج</Text>
            <Text style={styles.modalMessage}>هل أنت متأكد من تسجيل الخروج؟</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={async () => {
                  await logout();
                  router.replace('/login');
                  setShowLogoutModal(false);
                }}
              >
                <Text style={styles.logoutText}>تسجيل الخروج</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal الإشعارات */}
      <Modal
        visible={showNotificationsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.notificationsOverlay}>
          <View style={styles.notificationsContainer}>
            <View style={styles.notificationsHeader}>
              <Text style={styles.notificationsTitle}>الإشعارات</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Text style={styles.closeButtonText}>إغلاق</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.notificationsList}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotifications}>
                  <Text style={styles.emptyText}>لا توجد إشعارات</Text>
                </View>
              ) : (
                notifications.map((notif) => (
                  <View
                    key={notif.id}
                    style={[
                      styles.notificationItem,
                      !notif.read && styles.unreadNotification,
                    ]}
                  >
                    <View style={styles.notificationIcon}>
                      {notif.type === 'success' && <CheckCircle size={20} color="#34d399" />}
                      {notif.type === 'warning' && <AlertCircle size={20} color="#fbbf24" />}
                      {notif.type === 'danger' && <AlertCircle size={20} color="#f87171" />}
                      {notif.type === 'info' && <Bell size={20} color="#94a3b8" />}
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>{notif.title}</Text>
                      <Text style={styles.notificationMessage}>{notif.message}</Text>
                      <Text style={styles.notificationDate}>
                        {new Date(notif.date).toLocaleString('ar-EG')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ✅ تحديث الأنماط لدعم المكافآت
const styles = StyleSheet.create({
  // ... (الأنماط السابقة كما هي)
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 10,
    marginBottom: 15,
    flexDirection: 'row', // ✅ جعل العناصر أفقية
    justifyContent: 'space-between',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16, // مسافة بين الآيفون والنصوص
  },
  textContainer: {
    flexDirection: 'column',
    
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  employeeName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  employeePosition: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  
  salaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  salaryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  salaryLabel: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  salaryBreakdown: {
    width: '100%',
    marginBottom: 12,
  },
  salaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  salaryRowLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  salaryRowValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  salaryFrequency: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  salaryFrequencyText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
  },
  lastPaymentCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  lastPaymentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  lastPaymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  lastPaymentDetails: {
    gap: 12,
  },
  lastPaymentRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastPaymentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  lastPaymentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'right',
  },
  rewardItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rewardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rewardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34d399',
  },
  rewardDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  rewardReason: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  totalRewardsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#34d399',
  },
  totalRewardsLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  totalRewardsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34d399',
  },
  deductionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deductionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deduction_amount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger,
  },
  deductionType: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deductionReason: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  deductionDate: {
    fontSize: 12,
    color: Colors.textLight,
  },
  totalDeductionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: Colors.danger,
  },
  totalDeductionsLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  totalDeductionsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.danger,
  },
  absenceItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  absenceHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  absenceDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  absenceDeduction: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  absenceReason: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  totalAbsencesRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: Colors.textSecondary,
  },
  totalAbsencesLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  totalAbsencesValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  confirmButton: {
    backgroundColor: Colors.danger,
  },
  cancelText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  alertContainer: {
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  alertText: {
    color: '#2e7d32',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    includeFontPadding: false,
  },
  notificationsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  notificationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.primary,
  },
  notificationsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end', // ← هذا مهم
    marginBottom: 0,
  },
  notificationsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 400, // ← هذا هو المفتاح لحل المشكلة على أندرويد
    padding: 16,
    marginBottom: 0,
    
  },
  notificationsList: {
    flex: 1,
  },
  emptyNotifications: {
    alignItems: 'center',
    paddingVertical: 40,
    
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'right',
  },
  notificationItem: {
    flexDirection: 'row-reverse',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: '#fff',
  },
  unreadNotification: {
    backgroundColor: '#f0f9ff',
    borderRightWidth: 3,
    borderRightColor: Colors.primary,
  },
  notificationIcon: {
    marginLeft: 12,
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'right',
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
    textAlign: 'right',
  },
  notificationDate: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'right',
  },
});