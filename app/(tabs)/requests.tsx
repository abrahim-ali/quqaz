import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Plus, DollarSign, Calendar, X, RotateCcw, Filter, Eye } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import SubmittingModal from '@/components/SubmittingModal';
import AdaptiveDatePicker from '@/components/AdaptiveDatePicker';
import CustomModal from '@/components/CustomModal';
import { v4 as uuidv4 } from 'uuid';

// أنواع الطلبات
interface AdvanceRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string | null;
  amount: number;
  role: string;
  reason: string;
  repayment_period: number;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by?: string;
  approved_date?: string;
  notes?: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string | null;
  start_date: string;
  end_date: string;
  days: number;
  role: string;
  reason: string;
  type: 'custom';
  payment_type: 'paid' | 'half_paid' | 'unpaid';
  deduction_amount?: number | null;
  salary_at_request?: number | null;
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approved_by?: string | null;
  approved_date?: string | null;
  notes?: string;
}

export default function RequestsScreen() {
  // ============ الحالة ============
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAllRequestsModal, setShowAllRequestsModal] = useState(false);

  // السلفة
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [repaymentValue, setRepaymentValue] = useState('');

  // الإجازة
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [paymentType, setPaymentType] = useState<'paid' | 'half_paid' | 'unpaid'>('paid');

  // البيانات
  const [allAdvances, setAllAdvances] = useState<AdvanceRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [employeeSalary, setEmployeeSalary] = useState<number>(0);
  const [paymentFrequency, setPaymentFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [allEmployeesMap, setAllEmployeesMap] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const { user: authUser } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    autoClose: false,
  });

  // ============ دوال المساعدة ============
  const showCustomModal = (title: string, message: string, autoClose = false) => {
    setModalConfig({ visible: true, title, message, autoClose });
  };

  const hideModal = () => {
    setModalConfig(prev => ({ ...prev, visible: false }));
  };

  // ============ جلب البيانات ============
  const fetchAllRequests = async () => {
    if (!authUser?.id) return;

    try {
      const { data: advancesData, error: advancesError } = await supabase
        .from('advance_requests')
        .select('*')
        .eq('employee_id', authUser.id)
        .order('request_date', { ascending: false });

      if (advancesError) throw advancesError;
      setAllAdvances(advancesData || []);

      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', authUser.id)
        .order('request_date', { ascending: false });

      if (leavesError) throw leavesError;
      setAllLeaves(leavesData || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      showCustomModal('خطأ', 'فشل تحميل الطلبات', false);
    }
  };

  const fetchEmployeeData = async () => {
    if (!authUser?.id) return;
    const { data, error } = await supabase
      .from('employees')
      .select('salary, payment_frequency')
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.warn('Could not fetch employee data:', error.message);
      setEmployeeSalary(0);
      setPaymentFrequency('monthly');
    } else {
      setEmployeeSalary(data.salary || 0);
      setPaymentFrequency(data.payment_frequency || 'monthly');
    }
  };

  const fetchAllEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name');

    if (!error && data) {
      const empMap: Record<string, string> = {};
      data.forEach((emp: any) => {
        empMap[emp.id] = emp.name;
      });
      setAllEmployeesMap(empMap);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAllRequests(), fetchEmployeeData(), fetchAllEmployees()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchAllRequests();
    fetchAllEmployees();
  }, [authUser?.id]);

  // ============ فلترة الطلبات ============
  const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const filterRequests = <T extends { request_date: string }>(requests: T[]): T[] => {
    const now = new Date();
    return requests.filter(req => {
      const reqDate = new Date(req.request_date);
      if (paymentFrequency === 'weekly') {
        const startOfWeek = getStartOfWeek(now);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return reqDate >= startOfWeek && reqDate <= endOfWeek;
      } else {
        return (
          reqDate.getFullYear() === now.getFullYear() &&
          reqDate.getMonth() === now.getMonth()
        );
      }
    });
  };

  const filteredAdvances = filterRequests(allAdvances);
  const filteredLeaves = filterRequests(allLeaves);

  // ============ إرسال طلب السلفة ============
  const handleAddAdvance = async () => {
    if (!authUser) {
      showCustomModal('خطأ', 'لم يتم تحميل بيانات المستخدم', false);
      return;
    }
    if (!advanceAmount || !advanceReason || !repaymentValue) {
      showCustomModal('خطأ', 'الرجاء إدخال جميع البيانات', false);
      return;
    }

    const amount = parseFloat(advanceAmount);
    const repaymentNum = parseInt(repaymentValue);

    if (isNaN(amount) || amount <= 0) {
      showCustomModal('خطأ', 'الرجاء إدخال مبلغ صحيح', false);
      return;
    }

    if (isNaN(repaymentNum) || repaymentNum <= 0) {
      const unit = paymentFrequency === 'weekly' ? 'الأسابيع' : 'الشهور';
      showCustomModal('خطأ', `الرجاء إدخال عدد صحيح من ${unit}`, false);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('advance_requests').insert({
        id: uuidv4(),
        employee_id: authUser.id,
        employee_name: authUser.name,
        branch_id: authUser.branch_id || null,
        role: authUser.role,
        amount,
        reason: advanceReason,
        repayment_period: repaymentNum,
        request_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      });

      if (error) throw error;

      setAdvanceAmount('');
      setAdvanceReason('');
      setRepaymentValue('');
      setShowAdvanceModal(false);
      await fetchAllRequests();
      showCustomModal('تم الإرسال', 'طلب السلفة قيد المراجعة', true);
    } catch (error) {
      console.error('Error submitting advance:', error);
      showCustomModal('خطأ', 'فشل إرسال الطلب. حاول لاحقًا.', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ إرسال طلب الإجازة ============
  const handleAddLeave = async () => {
    if (!authUser) {
      showCustomModal('خطأ', 'لم يتم تحميل بيانات المستخدم', false);
      return;
    }
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      showCustomModal('خطأ', 'الرجاء إدخال جميع البيانات', false);
      return;
    }

    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (end < start) {
      showCustomModal('خطأ', 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية', false);
      return;
    }

    const timeDiff = end.getTime() - start.getTime();
    const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    const dailySalary = employeeSalary > 0 ? employeeSalary / 30 : 0;
    let deductionAmount = 0;

    if (paymentType === 'half_paid') {
      deductionAmount = parseFloat((dailySalary * days * 0.5).toFixed(2));
    } else if (paymentType === 'unpaid') {
      deductionAmount = parseFloat((dailySalary * days).toFixed(2));
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('leave_requests').insert({
        id: uuidv4(),
        employee_id: authUser.id,
        employee_name: authUser.name,
        branch_id: authUser.branch_id || null,
        role: authUser.role,
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        days,
        reason: leaveReason,
        type: 'custom',
        payment_type: paymentType,
        deduction_amount: deductionAmount || null,
        salary_at_request: employeeSalary || null,
        request_date: new Date().toISOString().split('T')[0],
        status: 'pending',
      });

      if (error) throw error;

      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      setShowLeaveModal(false);
      await fetchAllRequests();
      showCustomModal('تم الإرسال', 'طلب الإجازة قيد المراجعة', true);
    } catch (error) {
      console.error('Error submitting leave:', error);
      showCustomModal('خطأ', 'فشل إرسال الطلب. حاول لاحقًا.', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============ دوال العرض ============
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.danger;
      case 'paid': return Colors.primary;
      default: return Colors.warning;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'موافق عليه';
      case 'rejected': return 'مرفوض';
      case 'paid': return 'مدفوع';
      default: return 'قيد المراجعة';
    }
  };

  const getApprovalText = (status: string, approvedById?: string | null) => {
    if (status === 'approved' && approvedById) {
      return `تمت الموافقة من قبل: ${approvedById || '---'}`;
    } else if (status === 'rejected' && approvedById) {
      return `تم الرفض من قبل: ${approvedById || '---'}`;
    }
    return '';
  };

  const getPaymentTypeText = (type: string) => {
    switch (type) {
      case 'paid': return 'مدفوعة بالكامل';
      case 'half_paid': return 'نصف راتب';
      case 'unpaid': return 'بدون راتب';
      default: return 'غير معروف';
    }
  };

  const getRepaymentLabel = () => {
    return paymentFrequency === 'weekly' ? 'مدة السداد (بالأسابيع)' : 'مدة السداد (بالشهور)';
  };


  // ============ عرض بطاقة طلب ============
  const renderRequestCard = (request: AdvanceRequest | LeaveRequest, isAdvance: boolean) => {
    const isPending = request.status === 'pending';

    // لطلبات الإجازة فقط
    const leaveRequest = isAdvance ? null : request as LeaveRequest;
    const advanceRequest = isAdvance ? request as AdvanceRequest : null;

    return (
      <View key={request.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
            <Text style={styles.statusText}>{getStatusText(request.status)}</Text>
          </View>
          {isAdvance && (
            <Text style={styles.amountText}>
              {advanceRequest!.amount.toLocaleString('ar-EG')}{' '}
              <Text style={styles.currency}>دينار</Text>
            </Text>
          )}
        </View>
        <Text style={styles.submitterText}>مقدّم من: {request.employee_name}</Text>
        
        {isAdvance ? (
          <>
            <Text style={styles.reasonText}>{advanceRequest!.reason}</Text>
            {advanceRequest!.repayment_period && (
              <Text style={styles.repaymentText}>
                مدة السداد: {advanceRequest!.repayment_period}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.daysText}>{leaveRequest!.days} يوم إجازة</Text>
            <Text style={styles.datesText}>
              من {new Date(leaveRequest!.start_date).toLocaleDateString('ar-EG')} إلى{' '}
              {new Date(leaveRequest!.end_date).toLocaleDateString('ar-EG')}
            </Text>
            <Text style={styles.paymentText}>
              النوع المالي:{' '}
              <Text style={styles.paymentType}>
                {getPaymentTypeText(leaveRequest!.payment_type)}
              </Text>
            </Text>
            {leaveRequest!.deduction_amount != null && leaveRequest!.deduction_amount > 0 && (
              <Text style={styles.deductionText}>
                الخصم التقريبي: {leaveRequest!.deduction_amount.toLocaleString('ar-EG')} دينار
              </Text>
            )}
            <Text style={styles.reasonText}>{leaveRequest!.reason}</Text>
          </>
        )}

        <Text style={styles.dateText}>
          {new Date(request.request_date).toLocaleDateString('ar-EG')}
        </Text>

        {!isPending && request.approved_by && (
          <Text
            style={[
              styles.approvalText,
              request.status === 'approved' ? styles.approvedText : styles.rejectedText,
            ]}
          >
            {getApprovalText(request.status, request.approved_by)}
          </Text>
        )}

        {request.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>ملاحظات:</Text>
            <Text style={styles.notesContent}>{request.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'الطلبات',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '800', fontSize: 20 },
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
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.primary }]}
            onPress={() => setShowAdvanceModal(true)}
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.actionButtonText}>طلب سلفة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.success }]}
            onPress={() => setShowLeaveModal(true)}
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.actionButtonText}>طلب إجازة</Text>
          </TouchableOpacity>
        </View>

        {/* مؤشر الفلترة */}
        <View style={styles.filterInfo}>
          <Filter size={16} color={Colors.textLight} />
          <Text style={styles.filterText}>
            {paymentFrequency === 'weekly' ? 'عرض طلبات هذا الأسبوع' : 'عرض طلبات هذا الشهر'}
          </Text>
          <TouchableOpacity onPress={() => setShowAllRequestsModal(true)}>
            <Text style={styles.showAllText}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {/* طلبات السلف */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>طلبات السلف</Text>
            <TouchableOpacity onPress={onRefresh}>
              <RotateCcw size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          {filteredAdvances.length === 0 ? (
            <View style={styles.emptyState}>
              <DollarSign size={56} color={Colors.textLight} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {paymentFrequency === 'weekly' ? 'لا توجد سلف هذا الأسبوع' : 'لا توجد سلف هذا الشهر'}
              </Text>
            </View>
          ) : (
            filteredAdvances.map(advance => renderRequestCard(advance, true))
          )}
        </View>

        {/* طلبات الإجازات */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>طلبات الإجازات</Text>
            <TouchableOpacity onPress={onRefresh}>
              <RotateCcw size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </View>
          {filteredLeaves.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={56} color={Colors.textLight} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {paymentFrequency === 'weekly' ? 'لا توجد إجازات هذا الأسبوع' : 'لا توجد إجازات هذا الشهر'}
              </Text>
            </View>
          ) : (
            filteredLeaves.map(leave => renderRequestCard(leave, false))
          )}
        </View>
      </ScrollView>

      {/* Modal عرض جميع الطلبات */}
      <Modal visible={showAllRequestsModal} transparent animationType="slide">
        <View style={styles.allRequestsOverlay}>
          <View style={styles.allRequestsContent}>
            <View style={styles.allRequestsHeader}>
              <Text style={styles.allRequestsTitle}>جميع الطلبات</Text>
              <TouchableOpacity onPress={() => setShowAllRequestsModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.allRequestsScroll}>
              <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>طلبات السلف</Text>
              {allAdvances.length === 0 ? (
                <Text style={styles.emptyTextInModal}>لا توجد طلبات سلف</Text>
              ) : (
                allAdvances.map(advance => renderRequestCard(advance, true))
              )}

              <Text style={[styles.sectionTitle, { marginBottom: 16, marginTop: 24 }]}>طلبات الإجازات</Text>
              {allLeaves.length === 0 ? (
                <Text style={styles.emptyTextInModal}>لا توجد طلبات إجازات</Text>
              ) : (
                allLeaves.map(leave => renderRequestCard(leave, false))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal طلب السلفة */}
      <Modal visible={showAdvanceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAdvanceModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>طلب سلفة جديدة</Text>
              <View style={{ width: 24 }} />
            </View>

            <TextInput
              style={styles.input}
              placeholder="المبلغ (دينار)"
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            <TextInput
              style={styles.input}
              placeholder={getRepaymentLabel()}
              value={repaymentValue}
              onChangeText={setRepaymentValue}
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="السبب"
              value={advanceReason}
              onChangeText={setAdvanceReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddAdvance} disabled={isSubmitting}>
              <Text style={styles.submitButtonText}>إرسال الطلب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal طلب الإجازة */}
      <Modal visible={showLeaveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLeaveModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>طلب إجازة جديدة</Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={styles.label}>نوع الدفع</Text>
            <View style={styles.paymentTypeButtons}>
              {(['paid', 'half_paid', 'unpaid'] as const).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.paymentTypeButton,
                    paymentType === type && styles.paymentTypeButtonActive,
                  ]}
                  onPress={() => setPaymentType(type)}
                >
                  <Text
                    style={[
                      styles.paymentTypeButtonText,
                      paymentType === type && styles.paymentTypeButtonTextActive,
                    ]}
                  >
                    {type === 'paid' ? 'مدفوعة' : type === 'half_paid' ? 'نصف راتب' : 'بدون راتب'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>تواريخ الإجازة</Text>
            <AdaptiveDatePicker
              value={leaveStartDate}
              onChange={setLeaveStartDate}
              placeholder="تاريخ البداية"
              style={styles.input}
            />

            <AdaptiveDatePicker
              value={leaveEndDate}
              onChange={setLeaveEndDate}
              placeholder="تاريخ النهاية"
              style={styles.input}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="السبب"
              value={leaveReason}
              onChangeText={setLeaveReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={Colors.textLight}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddLeave} disabled={isSubmitting}>
              <Text style={styles.submitButtonText}>إرسال الطلب</Text>
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
      <SubmittingModal visible={isSubmitting} message="جاري معالجة الطلب..." />
    </View>
  );
}

// ============ الأنماط ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scrollContent: {
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row-reverse',
    gap: 14,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  filterInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  showAllText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    marginTop: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    elevation: 2,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  currency: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  submitterText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
  },
  reasonText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 10,
    textAlign: 'right',
  },
  repaymentText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
    marginBottom: 10,
    textAlign: 'right',
  },
  dateText: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'right',
  },
  approvalText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    padding: 6,
    borderRadius: 8,
    textAlign: 'right',
  },
  approvedText: {
    backgroundColor: 'rgba(46, 196, 108, 0.15)',
    color: Colors.success,
    textAlign: 'right',
  },
  rejectedText: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: Colors.danger,
    textAlign: 'right',
  },
  daysText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  datesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
    textAlign: 'right',
  },
  paymentText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'right',
  },
  paymentType: {
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'right',
  },
  deductionText: {
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'right',
  },
  notesBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  notesContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 110,
  },
  paymentTypeButtons: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  paymentTypeButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentTypeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paymentTypeButtonText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  paymentTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  // أنماط نافذة "عرض الكل"
  allRequestsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  allRequestsContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  allRequestsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  allRequestsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  allRequestsScroll: {
    maxHeight: '75%',
    padding: 16,
  },
  emptyTextInModal: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 20,
  },
});