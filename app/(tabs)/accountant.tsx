import { Image, Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  FileText,
  TrendingUp,
  Clock,
  LogOut,
  Gift,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Redirect } from 'expo-router';
import { Bell, CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

// دالة لحساب الراتب الصافي (تشمل deductions + absences + rewards)
const calculateNetSalary = (employee: any, advances: any[], deductions: any[], absences: any[], rewards: any[]) => {
  const totalAdvances = advances
    .filter(a => a.employee_id === employee.id && a.status === 'approved')
    .reduce((sum, a) => sum + a.amount, 0);

  const totalDeductions = deductions
    .filter(d => d.employee_id === employee.id)
    .reduce((sum, d) => sum + d.amount, 0);

  const totalAbsenceDeductions = absences
    .filter(a => a.employee_id === employee.id)
    .reduce((sum, a) => sum + a.deduction_amount, 0);

  const totalRewards = rewards
    .filter(r => r.employee_id === employee.id)
    .reduce((sum, r) => sum + r.amount, 0);

  const net_salary = employee.salary - totalAdvances - totalDeductions - totalAbsenceDeductions + totalRewards;
  return { net_salary, totalAdvances, totalDeductions, totalAbsenceDeductions, totalRewards };
};

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


export default function AccountantHomeScreen() {
  const { user, isLoading, isAccountant, isGeneralAccountant, isGeneralManager, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  

  const [employees, setEmployees] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // دالة مساعدة: الحصول على أول وآخر يوم في شهر معين
  const getMonthRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0); // آخر يوم في الشهر

    // تحويل إلى تنسيق YYYY-MM-DD للتوافق مع Supabase (بدون وقت)
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return {
      start: formatDate(start),
      end: formatDate(end),
    };
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      // تحديد الشهر الحالي (يمكنك تغييره لاحقًا لدعم اختيار شهر)
      const now = new Date();
      const { start: monthStart, end: monthEnd } = getMonthRange(now);

      // جلب الفروع
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location');
      if (branchesError) throw branchesError;
      setBranches(branchesData || []);

      // جلب الموظفين (نفس التصفية السابقة)
      let employeesQuery = supabase.from('employees').select('*');
      if (isAccountant) {
        employeesQuery = employeesQuery
          .eq('branch_id', user.branch_id)
          .eq('role', 'employee');
      } else if (isGeneralAccountant) {
        employeesQuery = employeesQuery
          .in('role', ['accountant', 'employee']);
      }
      const { data: employeesData, error: empError } = await employeesQuery;
      if (empError) throw empError;
      setEmployees(employeesData || []);

      // === جلب البيانات مع تصفية الشهر ===

      // السلف (request_date)
      let advancesQuery = supabase
        .from('advance_requests')
        .select('*')
        .gte('request_date', monthStart)
        .lte('request_date', monthEnd);
      if (isAccountant && user.branch_id) {
        advancesQuery = advancesQuery.eq('branch_id', user.branch_id);
      }
      const { data: advancesData, error: advError } = await advancesQuery;
      if (advError) throw advError;
      setAdvances(advancesData || []);

      // الإجازات (request_date)
      let leavesQuery = supabase
        .from('leave_requests')
        .select('*')
        .gte('request_date', monthStart)
        .lte('request_date', monthEnd);
      if (isAccountant && user.branch_id) {
        leavesQuery = leavesQuery.eq('branch_id', user.branch_id);
      }
      const { data: leavesData, error: leavesError } = await leavesQuery;
      if (leavesError) throw leavesError;
      setLeaves(leavesData || []);

      // الخصومات (date)
      let deductionsQuery = supabase
        .from('deductions')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (isAccountant && user.branch_id) {
        deductionsQuery = deductionsQuery.eq('branch_id', user.branch_id);
      }
      const { data: deductionsData, error: dedError } = await deductionsQuery;
      if (dedError) throw dedError;
      setDeductions(deductionsData || []);

      // الغيابات (date)
      let absencesQuery = supabase
        .from('absences')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (isAccountant && user.branch_id) {
        absencesQuery = absencesQuery.eq('branch_id', user.branch_id);
      }
      const { data: absencesData, error: absError } = await absencesQuery;
      if (absError) throw absError;
      setAbsences(absencesData || []);

      // دفعات الرواتب (payment_date)
      let paymentsQuery = supabase
        .from('salary_payments')
        .select('*')
        .gte('payment_date', monthStart)
        .lte('payment_date', monthEnd);
      if (isAccountant && user.branch_id) {
        paymentsQuery = paymentsQuery.eq('branch_id', user.branch_id);
      }
      const { data: paymentsData, error: payError } = await paymentsQuery;
      if (payError) throw payError;
      setPayments(paymentsData || []);

      // المكافآت (date)
      let rewardsQuery = supabase
        .from('rewards')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd);
      if (isAccountant && user.branch_id) {
        rewardsQuery = rewardsQuery.eq('branch_id', user.branch_id);
      }
      const { data: rewardsData, error: rewardsError } = await rewardsQuery;
      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
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

  useEffect(() => {
    if (!isLoading && user) {
      fetchData();
      fetchNotifications();
    }
  }, [user, isLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchNotifications(); 
    setRefreshing(false);
  };

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

  const handleLogout = () => setShowLogoutModal(true);


  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const isAccountantOrGeneral = isAccountant || isGeneralAccountant || isGeneralManager;
  if (!user || !isAccountantOrGeneral) {
    return <Redirect href="/" />;
  }

  const visibleEmployees = employees;
  const pendingAdvances = advances.filter(a => a.status === 'pending');
  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const totalBaseSalaries = visibleEmployees.reduce((sum, e) => sum + e.salary, 0);

  // حساب الرواتب الصافية (مع الخصومات من كلا الجدولين والمكافآت)
  const totalNetSalaries = visibleEmployees.reduce((total, emp) => {
    const { net_salary } = calculateNetSalary(emp, advances, deductions, absences, rewards);
    return total + net_salary;
  }, 0);

  const now = new Date();
  const thisMonthPayments = payments.filter(p => {
    const paymentDate = new Date(p.payment_date);
    return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
  });
  const totalPaidThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.net_salary, 0);
  const totalRewardsThisMonth = rewards
    .filter(r => {
      const rewardDate = new Date(r.date);
      return rewardDate.getMonth() === now.getMonth() && rewardDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + r.amount, 0);

  const totalAllDeductions = 
    deductions.reduce((sum, d) => sum + d.amount, 0) +
    absences.reduce((sum, a) => sum + a.deduction_amount, 0);

  const userBranch = branches.find(b => b.id === user.branch_id);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'لوحة التحكم',
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        <SalaryCountdownAlert employee={employees} payments={payments} />
        <View style={styles.welcomeCard}>
          <Image
            source={require('@/assets/images/splash-icon.png')}
            style={styles.iconImage}
            resizeMode="contain"
          />
          <Text style={styles.accountantName}>
            <Text style={styles.welcomeText}>مرحباً</Text> {user.name}
          </Text>
          <Text style={styles.accountantRole}>
            {isGeneralManager
              ? 'المدير العام'
              : isGeneralAccountant
              ? 'المحاسب العام'
              : `محاسب ${userBranch?.name || 'الفرع'}`}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: Colors.primary }]}>
            <Users size={28} color="#fff" />
            <Text style={styles.statValue}>{visibleEmployees.length}</Text>
            <Text style={styles.statLabel}>الموظفين</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.success }]}>
            <DollarSign size={28} color="#fff" />
            <Text style={styles.statValue}>{totalNetSalaries.toLocaleString('ar-EG')}</Text>
            <Text style={styles.statLabel}>إجمالي الرواتب الصافية</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.warning }]}>
            <AlertCircle size={28} color="#fff" />
            <Text style={styles.statValue}>{pendingAdvances.length}</Text>
            <Text style={styles.statLabel}>سلف معلقة</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors.primaryLight }]}>
            <Clock size={28} color="#fff" />
            <Text style={styles.statValue}>{pendingLeaves.length}</Text>
            <Text style={styles.statLabel}>إجازات معلقة</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <TrendingUp size={24} color={Colors.primary} />
            <Text style={styles.summaryTitle}>ملخص هذا الشهر</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد الدفعات:</Text>
            <Text style={styles.summaryValue}>{thisMonthPayments.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المدفوع:</Text>
            <Text style={styles.summaryValue}>{totalPaidThisMonth.toLocaleString('ar-EG')} دينار</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>الرواتب الأساسية:</Text>
            <Text style={styles.summaryValue}>{totalBaseSalaries.toLocaleString('ar-EG')} دينار</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي الخصومات:</Text>
            <Text style={styles.summaryValue}>
              {totalAllDeductions.toLocaleString('ar-EG')} دينار
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي السلف المعتمدة:</Text>
            <Text style={styles.summaryValue}>
              {advances.filter(a => a.status === 'approved').reduce((sum, a) => sum + a.amount, 0).toLocaleString('ar-EG')} دينار
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي المكافآت:</Text>
            <Text style={styles.summaryValue}>
              {totalRewardsThisMonth.toLocaleString('ar-EG')} دينار
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد الغيابات:</Text>
            <Text style={styles.summaryValue}>{absences.length}</Text>
          </View>
        </View>

        {pendingAdvances.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <AlertCircle size={24} color={Colors.warning} />
              <Text style={styles.alertTitle}>طلبات سلف تحتاج موافقة</Text>
            </View>
            {pendingAdvances.slice(0, 3).map(advance => (
              <View key={advance.id} style={styles.alertItem}>
                <Text style={styles.alertItemName}>{advance.employee_name}</Text>
                <Text style={styles.alertItemAmount}>{advance.amount.toLocaleString('ar-EG')} دينار</Text>
              </View>
            ))}
            {pendingAdvances.length > 3 && (
              <Text style={styles.alertMore}>و {pendingAdvances.length - 3} طلبات أخرى...</Text>
            )}
          </View>
        )}

        {pendingLeaves.length > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <Clock size={24} color={Colors.primaryLight} />
              <Text style={styles.alertTitle}>طلبات إجازات تحتاج موافقة</Text>
            </View>
            {pendingLeaves.slice(0, 3).map(leave => (
              <View key={leave.id} style={styles.alertItem}>
                <Text style={styles.alertItemName}>{leave.employee_name}</Text>
                <Text style={styles.alertItemAmount}>{leave.days} يوم</Text>
              </View>
            ))}
            {pendingLeaves.length > 3 && (
              <Text style={styles.alertMore}>و {pendingLeaves.length - 3} طلبات أخرى...</Text>
            )}
          </View>
        )}

        {(isGeneralAccountant || isGeneralManager) && (
          <View style={styles.branchesCard}>
            <Text style={styles.branchesTitle}>الفروع</Text>
            {branches.map(branch => {
              const branchEmployees = employees.filter(e => e.branch_id === branch.id);
              const branchAccountants = branchEmployees.filter(e => e.role === 'accountant');
              const branchRegular = branchEmployees.filter(e => e.role === 'employee');
              return (
                <View key={branch.id} style={styles.branchItem}>
                  <View>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    <Text style={styles.branchLocation}>{branch.location}</Text>
                    <Text style={styles.branchSubtext}>
                      {branchRegular.length} موظف، {branchAccountants.length} محاسب
                    </Text>
                  </View>
                  <View style={styles.branchStats}>
                    <Users size={16} color={Colors.primary} />
                    <Text style={styles.branchEmployeeCount}>{branchEmployees.length}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal تسجيل الخروج */}
      <Modal
        visible={showLogoutModal}
        transparent
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
                style={[styles.button, styles.logoutButton]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notificationModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: 50,
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  accountantName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  accountantRole: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  iconImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
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
  summaryCard: {
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
  summaryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  alertCard: {
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
  alertHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  alertItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  alertItemName: {
    fontSize: 14,
    color: Colors.text,
  },
  alertItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  alertMore: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  branchesCard: {
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
  branchesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  branchItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  branchLocation: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  branchSubtext: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 2,
  },
  branchStats: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  branchEmployeeCount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  logoutButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationButton: {
    marginRight: 20,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  cancelText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
});