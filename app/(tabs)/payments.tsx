// app/(tabs)/payments.tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { DollarSign, Calendar, CheckCircle, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import AdaptiveDatePicker from '@/components/AdaptiveDatePicker';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import SubmittingModal from '@/components/SubmittingModal';
import { calculateNetSalaryForEmployee } from '@/utils/salaryCalculator';
import { v4 as uuidv4 } from 'uuid';

// أنواع البيانات
type Employee = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  branch_id: string;
  position: string;
  salary: number;
  payment_frequency: 'weekly' | 'monthly';
  role: string;
  hire_date: string;
};

type Advance = {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  repayment_period?: number;
  repayment_type?: 'weekly' | 'monthly';
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'partially_paid';
  paid_amount: number;
};

type Deduction = {
  id: string;
  employee_id: string;
  amount: number;
  date: string;
  branch_id?: string;
};

type Absence = {
  id: string;
  employee_id: string;
  date: string;
  deduction_amount: number;
  branch_id?: string;
};

type Reward = {
  id: string;
  employee_id: string;
  amount: number;
  date: string;
};

type Payment = {
  id: string;
  employee_id: string;
  employee_name: string;
  base_salary: number;
  advances: number;
  deductions: number;
  net_salary: number;
  payment_date: string;
  period: string;
  payment_frequency: 'weekly' | 'monthly';
  paid_by: string;
  notes?: string;
  branch_id?: string;
};

export default function PaymentsScreen() {
  const { user: authUser } = useAuth();

  // الحالة
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    autoClose: false,
  });

  // دوال المساعدة
  const showCustomModal = (title: string, message: string, autoClose = false) => {
    setModalConfig({ visible: true, title, message, autoClose });
  };

  const hideModal = () => {
    setModalConfig(prev => ({ ...prev, visible: false }));
  };

  // جلب البيانات من Supabase
  const fetchData = useCallback(async () => {
    try {
      const [empRes, advRes, dedRes, absRes, rewRes, payRes] = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('advance_requests').select('*').order('request_date', { ascending: false }),
        supabase.from('deductions').select('*').order('date', { ascending: false }),
        supabase.from('absences').select('*').order('date', { ascending: false }),
        supabase.from('rewards').select('*').order('date', { ascending: false }),
        supabase.from('salary_payments').select('*').order('payment_date', { ascending: false }),
      ]);

      if (empRes.error) throw empRes.error;
      if (advRes.error) throw advRes.error;
      if (dedRes.error) throw dedRes.error;
      if (absRes.error) throw absRes.error;
      if (rewRes.error) throw rewRes.error;
      if (payRes.error) throw payRes.error;

      setEmployees(empRes.data as Employee[]);
      setAdvances(advRes.data.map(a => ({
        ...a,
        repayment_period: typeof a.repayment_period === 'string' 
          ? parseInt(a.repayment_period, 10) || 1 
          : (a.repayment_period || 1),
        repayment_type: a.repayment_type || 'monthly',
        paid_amount: a.paid_amount || 0,
      })) as Advance[]);
      setDeductions(dedRes.data as Deduction[]);
      setAbsences(absRes.data as Absence[]);
      setRewards(rewRes.data as Reward[]);
      setPayments(payRes.data as Payment[]);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      showCustomModal('خطأ', 'فشل تحميل البيانات', false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // التحديث عند السحب لأسفل
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [fetchData]);

  // التحميل الأولي
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // دالة التصفية حسب الدور
  const getFilteredData = () => {
    if (!authUser) {
      return { employees: [], advances: [], deductions: [], absences: [], rewards: [], payments: [] };
    }

    if (authUser.role === 'general_manager') {
      return { employees, advances, deductions, absences, rewards, payments };
    }

    if (authUser.role === 'general_accountant') {
      const filteredEmployees = employees.filter(emp =>
        emp.id !== authUser.id &&
        emp.role !== 'general_manager'
      );

      const employeeRoles = new Map(employees.map(emp => [emp.id, emp.role]));

      const filterByEmployeeRole = (items: any[]) =>
        items.filter(item =>
          item.employee_id !== authUser.id &&
          employeeRoles.get(item.employee_id) !== 'general_manager'
        );

      return {
        employees: filteredEmployees,
        advances: advances.filter(a => a.employee_id === authUser.id),
        rewards: rewards.filter(r => r.employee_id === authUser.id),
        deductions: filterByEmployeeRole(deductions),
        absences: filterByEmployeeRole(absences),
        payments: filterByEmployeeRole(payments),
      };
    }

    if (authUser.role === 'accountant') {
      const filteredEmployees = employees.filter(e =>
        e.branch_id === authUser.branch_id &&
        e.id !== authUser.id &&
        e.role === 'employee'
      );

      const employeeIds = new Set(filteredEmployees.map(e => e.id));

      return {
        employees: filteredEmployees,
        advances: advances.filter(a => a.employee_id === authUser.id),
        rewards: rewards.filter(r => r.employee_id === authUser.id),
        deductions: deductions.filter(d =>
          d.employee_id !== authUser.id &&
          employeeIds.has(d.employee_id)
        ),
        absences: absences.filter(a =>
          a.employee_id !== authUser.id &&
          employeeIds.has(a.employee_id)
        ),
        payments: payments.filter(p =>
          p.employee_id !== authUser.id &&
          employeeIds.has(p.employee_id)
        ),
      };
    }

    // موظف عادي
    const employee = employees.find(e => e.email === authUser.email);
    if (employee) {
      return {
        employees: [employee],
        advances: advances.filter(a => a.employee_id === employee.id),
        rewards: rewards.filter(r => r.employee_id === employee.id),
        deductions: deductions.filter(d => d.employee_id === employee.id),
        absences: absences.filter(a => a.employee_id === employee.id),
        payments: payments.filter(p => p.employee_id === employee.id),
      };
    }

    return { employees: [], advances: [], deductions: [], absences: [], rewards: [], payments: [] };
  };

  // دوال الدفع
  const getEmployeeLastPayment = (employee_id: string) => {
    return payments
      .filter(p => p.employee_id === employee_id)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0] || null;
  };

  const handlePaySalary = (employee_id: string) => {
    const employee = employees.find(e => e.id === employee_id);
    if (!employee) return;
    setSelectedEmployeeId(employee_id);
    setShowPaymentModal(true);
  };

  const confirmPayment = async () => {
    try {
      const employee = employees.find(e => e.id === selectedEmployeeId);
      if (!employee) {
        showCustomModal('خطأ', 'لم يتم العثور على الموظف', false);
        return;
      }

      const employeePayments = payments.filter(p => p.employee_id === employee.id);
      const lastPayment = employeePayments
        .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];
      const lastPaymentDate = lastPayment ? lastPayment.payment_date : null;
      const currentDate = new Date().toISOString().split('T')[0];

      const { net_salary, approvedAdvances, totalDeductions, advanceDetails } = calculateNetSalaryForEmployee(
        employee,
        advances,
        deductions,
        absences,
        rewards,
        lastPaymentDate,
        currentDate
      );

      if (net_salary < 0) {
        showCustomModal('خطأ', 'الراتب الصافي لا يمكن أن يكون سالبًا', false);
        return;
      }

      setIsSubmitting(true);

      const period = new Date(currentDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

      const payment = {
        id: uuidv4(),
        employee_id: employee.id,
        employee_name: employee.name,
        branch_id: employee.branch_id,
        base_salary: Math.round(employee.salary || 0),
        advances: Math.round(approvedAdvances),
        deductions: Math.round(totalDeductions),
        net_salary: Math.round(net_salary),
        payment_date: currentDate,
        period,
        payment_frequency: employee.payment_frequency,
        paid_by: authUser?.name || 'Admin',
        notes: paymentNotes?.trim() || undefined,
      };

      const { error: paymentError } = await supabase
        .from('salary_payments')
        .insert([payment]);

      if (paymentError) throw paymentError;

      // تحديث السلف جزئيًا
      for (const detail of advanceDetails || []) {
        const newPaid = Math.min(detail.current_paid + detail.due_amount, detail.total_amount);
        const newStatus = newPaid >= detail.total_amount ? 'paid' : 'partially_paid';

        const { error: updateError } = await supabase
          .from('advance_requests')
          .update({
            paid_amount: newPaid,
            status: newStatus,
          })
          .eq('id', detail.id);

        if (updateError) {
          console.error('فشل تحديث السلفة:', detail.id, updateError);
        }
      }

      // إرسال إشعار
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: employee.id,
        title: 'تم صرف الراتب',
        message: `تم صرف راتبك بمبلغ ${net_salary.toLocaleString('ar-EG')} دينار`,
        type: 'success',
        date: new Date().toISOString(),
        read: false,
        action_type: 'payment',
        action_id: payment.id,
      });

      showCustomModal('نجح!', 'تم صرف الراتب بنجاح', true);
      await fetchData(); // تحديث البيانات فورًا بعد الدفع
    } catch (error: any) {
      console.error('Payment error:', error);
      showCustomModal('خطأ', error.message || 'فشل صرف الراتب.', false);
    } finally {
      setShowPaymentModal(false);
      setPaymentNotes('');
      setIsSubmitting(false);
    }
  };

  // إذا كان لا يزال يتم التحميل
  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <Text>جاري التحميل...</Text>
      </View>
    );
  }

  const filteredData = getFilteredData();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'إدارة الرواتب',
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
        {/* ملخص */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>ملخص الرواتب</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي الرواتب الشهرية:</Text>
            <Text style={styles.summaryValue}>
              {filteredData.employees
                .filter(e => e.payment_frequency === 'monthly')
                .reduce((sum, e) => sum + e.salary, 0)
                .toLocaleString('ar-EG')}{' '}
              دينار
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>إجمالي الرواتب الأسبوعية:</Text>
            <Text style={styles.summaryValue}>
              {filteredData.employees
                .filter(e => e.payment_frequency === 'weekly')
                .reduce((sum, e) => sum + e.salary, 0)
                .toLocaleString('ar-EG')}{' '}
              دينار
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد الموظفين:</Text>
            <Text style={styles.summaryValue}>{filteredData.employees.length}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>الموظفين</Text>

        {filteredData.employees.map(employee => {
          const lastPayment = getEmployeeLastPayment(employee.id);
          const lastPaymentDate = lastPayment ? lastPayment.payment_date : null;
          const result = calculateNetSalaryForEmployee(
            employee,
            advances, // ← البيانات الأصلية للحساب الدقيق
            deductions,
            absences,
            rewards,
            lastPaymentDate
          );

          // حساب موعد الدفع القادم
          const today = new Date();
          let nextPaymentDate: Date | null = null;
          const hireDate = employee.hire_date ? new Date(employee.hire_date) : null;

          if (employee.payment_frequency === 'monthly') {
            const lastPay = payments
              .filter(p => p.employee_id === employee.id)
              .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];
            if (lastPay) {
              const ld = new Date(lastPay.payment_date);
              nextPaymentDate = new Date(ld.getFullYear(), ld.getMonth() + 1, ld.getDate());
            } else if (hireDate) {
              const day = hireDate.getDate();
              let y = today.getFullYear();
              let m = today.getMonth();
              if (today.getDate() > day) m += 1;
              nextPaymentDate = new Date(y, m, day);
            }
          } else {
            const lastPay = payments
              .filter(p => p.employee_id === employee.id)
              .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];
            if (lastPay) {
              const ld = new Date(lastPay.payment_date);
              nextPaymentDate = new Date(ld.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else if (hireDate) {
              nextPaymentDate = new Date(hireDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            }
          }

          const showPayButton = nextPaymentDate
            ? Math.abs(today.getTime() - nextPaymentDate.getTime()) / (1000 * 60 * 60 * 24) <= 1
            : false;

          return (
            <View key={employee.id} style={styles.employeeCard}>
              <View style={styles.employeeHeader}>
                <View>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  <Text style={styles.employeePosition}>{employee.position}</Text>
                </View>
                <View style={styles.salaryBadge}>
                  <Text style={styles.salaryAmount}>
                    {employee.salary.toLocaleString('ar-EG')}
                  </Text>
                  <Text style={styles.salaryFrequency}>
                    {employee.payment_frequency === 'monthly' ? 'شهري' : 'أسبوعي'}
                  </Text>
                </View>
              </View>

              <View style={styles.advancesInfo}>
                {result.approvedAdvances > 0 && (
                  <Text style={styles.advancesText}>
                    سلف مستحقة: {result.approvedAdvances.toLocaleString('ar-EG')} دينار
                  </Text>
                )}
                {result.totalDeductions > 0 && (
                  <Text style={styles.deductionsText}>
                    خصومات: {result.totalDeductions.toLocaleString('ar-EG')} دينار
                  </Text>
                )}
                {result.totalRewards > 0 && (
                  <Text style={styles.deductionsText}>
                    مكافآت: {result.totalRewards.toLocaleString('ar-EG')} دينار
                  </Text>
                )}
                <Text style={styles.netSalaryText}>
                  الصافي: {result.net_salary.toLocaleString('ar-EG')} دينار
                </Text>
              </View>

              {lastPayment && (
                <View style={styles.lastPaymentInfo}>
                  <CheckCircle size={16} color={Colors.success} />
                  <Text style={styles.lastPaymentText}>
                    آخر دفعة: {new Date(lastPayment.payment_date).toLocaleDateString('ar-EG')} ({lastPayment.period})
                  </Text>
                </View>
              )}

              {showPayButton && (
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => handlePaySalary(employee.id)}
                >
                  <DollarSign size={20} color="#fff" />
                  <Text style={styles.payButtonText}>صرف الراتب</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* سجل الدفعات */}
        <Text style={styles.sectionTitle}>سجل الدفعات</Text>
        {filteredData.payments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Calendar size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>لا توجد دفعات مسجلة</Text>
          </View>
        ) : (
          filteredData.payments.map(payment => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentEmployeeName}>{payment.employee_name}</Text>
                <Text style={styles.paymentAmount}>
                  {payment.net_salary.toLocaleString('ar-EG')} دينار
                </Text>
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentDetailText}>الفترة: {payment.period}</Text>
                <Text style={styles.paymentDetailText}>
                  التاريخ: {new Date(payment.payment_date).toLocaleDateString('ar-EG')}
                </Text>
                <Text style={styles.paymentDetailText}>
                  الراتب الأساسي: {payment.base_salary.toLocaleString('ar-EG')} دينار
                </Text>
                {payment.advances > 0 && (
                  <Text style={styles.paymentDetailText}>
                    السلف: -{payment.advances.toLocaleString('ar-EG')} دينار
                  </Text>
                )}
                {payment.deductions > 0 && (
                  <Text style={styles.paymentDetailText}>
                    الخصومات: -{payment.deductions.toLocaleString('ar-EG')} دينار
                  </Text>
                )}
                {payment.notes && (
                  <Text style={styles.paymentNotes}>ملاحظات: {payment.notes}</Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal الدفع */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تأكيد صرف الراتب</Text>
              <View style={{ width: 24 }} />
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: Colors.background }]}
              value={new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}
              editable={false}
              placeholder="الفترة"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="ملاحظات"
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              multiline
              numberOfLines={3}
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity style={styles.confirmButton} onPress={confirmPayment}>
              <Text style={styles.confirmButtonText}>تأكيد الدفع</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        autoClose={modalConfig.autoClose}
        onClose={hideModal}
      />
      <SubmittingModal visible={isSubmitting} message="جاري الدفع ..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  employeeCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  employeePosition: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  salaryBadge: { alignItems: 'flex-end' },
  salaryAmount: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  salaryFrequency: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  advancesInfo: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  advancesText: { fontSize: 14,textAlign: 'right', color: Colors.warning, marginBottom: 4 },
  deductionsText: { fontSize: 14,textAlign: 'right', color: Colors.danger, marginBottom: 4 },
  netSalaryText: { fontSize: 14,textAlign: 'right', fontWeight: '600', color: Colors.text },
  lastPaymentInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 12 },
  lastPaymentText: { fontSize: 12, color: Colors.textSecondary },
  payButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: { fontSize: 16, color: Colors.textLight, marginTop: 12 },
  paymentCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentEmployeeName: { fontSize: 16, fontWeight: '600',textAlign: 'right', color: Colors.text },
  paymentAmount: { fontSize: 18, fontWeight: '700',textAlign: 'right', color: Colors.success },
  paymentDetails: { gap: 6 },
  paymentDetailText: { fontSize: 14,textAlign: 'right', color: Colors.textSecondary },
  paymentNotes: { fontSize: 14,textAlign: 'right', color: Colors.text, marginTop: 8, fontStyle: 'italic' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'right',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  confirmButton: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});