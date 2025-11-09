import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  User,
  Mail,
  Phone,
  DollarSign,
  X,
  Trash2,
  Edit,
  AlertTriangle,
  Calendar,
  Gift,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Employee, UserRole, PaymentFrequency } from '@/types';
import { supabase } from '@/lib/supabase';
import CustomModal from '@/components/CustomModal';
import SubmittingModal from '@/components/SubmittingModal';
import AdaptiveDatePicker from '@/components/AdaptiveDatePicker';
import { createEmployee } from '@/services/employeeService';
import {
  updateEmployee,
  EmployeeUpdateData,
  deleteEmployee,
} from '@/services/updateEmployee';

import { sendWhatsAppTemplateMessage } from '@/lib/whatsappService';

import { v4 as uuidv4 } from 'uuid';

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

import { Eye, EyeOff } from 'lucide-react-native'; 



type PasswordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

const PasswordInput = ({ value, onChangeText, placeholder = 'كلمة المرور *' }: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.inputPassword}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        placeholderTextColor={Colors.textLight}
        keyboardType="default"
        textContentType="password"
      />
      <TouchableOpacity
        accessibilityLabel={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        onPress={() => setShowPassword(prev => !prev)}
        style={styles.iconButton}
        activeOpacity={0.7}
      >
        {showPassword ? (
          <EyeOff width={20} height={20} color={Colors.textLight} />
        ) : (
          <Eye width={20} height={20} color={Colors.textLight} />
        )}
      </TouchableOpacity>
    </View>
  );
};

export default function EmployeesScreen() {
  const router = useRouter();
  const { user, isAccountant, isGeneralAccountant, isGeneralManager } = useAuth();

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deduction_amount, setdeduction_amount] = useState('');
  const [deductionReason, setDeductionReason] = useState('');
  const [deductionType, setDeductionType] = useState<'absence' | 'late' | 'penalty' | 'other'>('penalty');
  const [absenceDate, setAbsenceDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [absenceDeduction, setAbsenceDeduction] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardReason, setRewardReason] = useState('مكافأة أداء');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    autoClose: false,
  });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    branch_id: '',
    position: '',
    salary: '',
    payment_frequency: 'monthly' as PaymentFrequency,
    national_id: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    password: '',
    role: 'employee' as UserRole,
    hire_date: new Date().toISOString().split('T')[0],
  });

  // Data from Supabase
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; location: string }[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<string>('all');

  // Load data from Supabase
  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) {
      setIsSubmitting(true);
    }
    setRefreshing(isRefreshing);

    try {
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, location');
      if (branchesError) throw branchesError;
      setBranches(branchesData || []);

      const { data: employeesData, error: empError } = await supabase
        .from('employees')
        .select('*');
      if (empError) throw empError;

      const { data: advancesData, error: advError } = await supabase
        .from('advance_requests')
        .select('*');
      if (advError) throw advError;
      setAdvances(advancesData || []);

      const { data: leavesData, error: leavesError } = await supabase
        .from('leave_requests')
        .select('*');
      if (leavesError) throw leavesError;
      setLeaves(leavesData || []);

      const { data: deductionsData, error: dedError } = await supabase
        .from('deductions')
        .select('*');
      if (dedError) throw dedError;
      setDeductions(deductionsData || []);

      setEmployees(employeesData || []);
    } catch (error: any) {
      showCustomModal('خطأ', error.message || 'فشل تحميل البيانات', false);
    } finally {
      setIsSubmitting(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter employees based on role + activeTab
  const getFilteredEmployees = () => {
    return employees.filter((employee) => {
      if (employee.id === user?.id) return false;

      if (activeTab !== 'all' && employee.branch_id !== activeTab) {
        return false;
      }

      if (isAccountant) {
        return employee.branch_id === user?.branch_id && employee.role === 'employee';
      } else if (isGeneralAccountant) {
        return (employee.role === 'employee' || employee.role === 'accountant') && employee.branch_id !== null;
      } else if (isGeneralManager) {
        return true;
      }
      return false;
    });
  };

  const filteredEmployees = getFilteredEmployees().filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCustomModal = (title: string, message: string, autoClose = false) => {
    setModalConfig({ visible: true, title, message, autoClose });
  };
  const hideModal = () => {
    setModalConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleAddEmployee = async () => {
    setIsSubmitting(true);
    const result = await createEmployee(formData);
    setIsSubmitting(false);
    if (result.success) {
      setShowAddModal(false);
      if (formData?.phone) {
        await sendWhatsAppTemplateMessage({
          to: formData.phone, // الرقم من قاعدة البيانات
          parameters: [
            `الموظف: ${formData.name}\nالبريد: ${formData.email} كلمة المرور : ${formData.password}`,
            'الإدارة'
          ],
        });
      }
      showCustomModal(
        'تم الإنشاء بنجاح',
        `الموظف: ${formData.name}\nالبريد: ${formData.email}\nكلمة المرور المؤقتة: ${formData.password}\n(يرجى تغييرها عند أول تسجيل دخول)`,
        true
      );
      console.log('✅ تم إرسال الرسالة بنجاح');
      resetForm();
      await loadData();
    } else {
      showCustomModal('خطأ', result.message || 'فشل إنشاء الموظف', false);
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;
    setIsSubmitting(true);
    const data: EmployeeUpdateData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      branch_id: formData.branch_id || null,
      position: formData.position,
      salary: formData.salary,
      payment_frequency: formData.payment_frequency,
      national_id: formData.national_id,
      address: formData.address,
      emergency_contact: formData.emergency_contact,
      emergency_phone: formData.emergency_phone,
      role: formData.role,
    };
    const result = await updateEmployee(selectedEmployee.id, data);
    setIsSubmitting(false);
    if (result.success) {
      setShowEditModal(false);
      setSelectedEmployee(null);
      if (formData?.phone) {
        await sendWhatsAppTemplateMessage({
          to: formData.phone, // الرقم من قاعدة البيانات
          parameters: [
            result.message,
            'الإدارة'
          ],
        });
      }

      showCustomModal('نجح!', result.message, true);
      resetForm();
      await loadData();
    } else {
      showCustomModal('خطأ', result.message, false);
    }
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      branch_id: employee.branch_id || '',
      position: employee.position,
      salary: employee.salary.toString(),
      payment_frequency: employee.payment_frequency,
      national_id: employee.national_id,
      address: employee.address,
      emergency_contact: employee.emergency_contact,
      emergency_phone: employee.emergency_phone,
      password: '',
      role: employee.role as UserRole,
      hire_date: employee.hire_date,
    });
    setShowEditModal(true);
  };

  const handleAddDeduction = async () => {
    if (!selectedEmployee || !deduction_amount || !deductionReason) {
      showCustomModal('خطأ', 'الرجاء إدخال جميع البيانات المطلوبة', false);
      return;
    }
    const amount = parseFloat(deduction_amount);
    if (isNaN(amount) || amount <= 0) {
      showCustomModal('خطأ', 'الرجاء إدخال مبلغ صحيح', false);
      return;
    }

    setIsSubmitting(true);
    try {
      // جلب رقم الهاتف
      const { data: employeeData, error: phoneError } = await supabase
        .from('employees')
        .select('phone')
        .eq('id', selectedEmployee.id)
        .single();

      const deductionId = uuidv4();

      // إدخال الخصم
      const { error: deductionError } = await supabase.from('deductions').insert({
        id: deductionId,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.name,
        branch_id: selectedEmployee.branch_id,
        amount,
        reason: deductionReason,
        date: new Date().toISOString().split('T')[0],
        type: deductionType,
        created_by: user?.name || '',
      });
      if (deductionError) throw deductionError;

      // إشعار
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: selectedEmployee.id,
        title: 'خصم جديد',
        message: `تم إضافة خصم بمبلغ ${amount.toLocaleString('ar-EG')} دينار - ${deductionReason}`,
        type: 'warning',
        read: false,
        action_type: 'deduction',
        action_id: deductionId,
      });

      // إرسال واتساب (إذا وُجد رقم)
      if (employeeData?.phone) {
        await sendWhatsAppTemplateMessage({
          to: employeeData.phone,
          parameters: [
            `تم إضافة خصم بمبلغ ${amount.toLocaleString('ar-EG')} دينار - ${deductionReason}`,
            'الإدارة'
          ],
          templateName: 'confirmation2' // أو استخدم قالبًا خاصًا مثل 'deduction_alert'
        });
      }

      setdeduction_amount('');
      setDeductionReason('');
      setShowDeductionModal(false);
      showCustomModal('نجح!', 'تم إضافة الخصم بنجاح', true);
    } catch (error: any) {
      showCustomModal('خطأ', error.message || 'فشل إضافة الخصم.', false);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleAddAbsence = async () => {
    if (!selectedEmployee || !absenceDate) {
      showCustomModal('خطأ', 'الرجاء إدخال التاريخ', false);
      return;
    }

    const deduction = parseFloat(absenceDeduction) || 0;
    setIsSubmitting(true);

    try {
      // جلب رقم الهاتف
      const { data: employeeData, error: phoneError } = await supabase
        .from('employees')
        .select('phone')
        .eq('id', selectedEmployee.id)
        .single();

      const absenceId = uuidv4();

      // تسجيل الغياب
      const { error: absenceError } = await supabase.from('absences').insert({
        id: absenceId,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.name,
        branch_id: selectedEmployee.branch_id,
        date: absenceDate,
        reason: absenceReason,
        deduction_amount: deduction,
        created_by: user?.name || '',
      });
      if (absenceError) throw absenceError;

      let deductionId: string | null = null;
      if (deduction > 0) {
        deductionId = uuidv4();
        const { error: dedError } = await supabase.from('deductions').insert({
          id: deductionId,
          employee_id: selectedEmployee.id,
          employee_name: selectedEmployee.name,
          branch_id: selectedEmployee.branch_id,
          amount: deduction,
          reason: `خصم غياب - ${absenceDate}`,
          date: new Date().toISOString().split('T')[0],
          type: 'absence',
          created_by: user?.name || '',
        });
        if (dedError) throw dedError;
      }

      // إشعار
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: selectedEmployee.id,
        title: 'تسجيل غياب',
        message: `تم تسجيل غياب بتاريخ ${new Date(absenceDate).toLocaleDateString('ar-EG')}${
          deduction > 0 ? ` مع خصم ${deduction.toLocaleString('ar-EG')} دينار` : ''
        }`,
        type: 'danger',
        read: false,
        action_type: 'absence',
        action_id: absenceId,
      });

      // إرسال واتساب (إذا وُجد رقم)
      if (employeeData?.phone) {
        const messagePart1 = `تم تسجيل غياب بتاريخ ${new Date(absenceDate).toLocaleDateString('ar-EG')}`;
        const messagePart2 = deduction > 0
          ? `مع خصم ${deduction.toLocaleString('ar-EG')} دينار`
          : 'بدون خصم';

        await sendWhatsAppTemplateMessage({
          to: employeeData.phone,
          parameters: [messagePart1, messagePart2],
          templateName: 'confirmation2' // أو 'absence_notification'
        });
      }

      setAbsenceDate('');
      setAbsenceReason('');
      setAbsenceDeduction('');
      setShowAbsenceModal(false);
      showCustomModal('نجح!', 'تم تسجيل الغياب بنجاح', true);
    } catch (error: any) {
      showCustomModal('خطأ', error.message || 'فشل تسجيل الغياب.', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteModalVisible(true);
  };

  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setIsSubmitting(true);
    const result = await deleteEmployee(employeeToDelete.id);
    setIsSubmitting(false);
    if (result.success) {
      showCustomModal('نجح!', result.message, true);
      setDeleteModalVisible(false);
      setEmployeeToDelete(null);
      await loadData();
    } else {
      showCustomModal('خطأ', result.message || 'فشل حذف الموظف', false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      branch_id: '',
      position: '',
      salary: '',
      payment_frequency: 'monthly',
      national_id: '',
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      password: '',
      role: 'employee' as UserRole,
      hire_date: new Date().toISOString().split('T')[0],
    });
  };

  const handleApproveAdvance = async (advanceId: string, employee_id: string) => {
    const advance = advances.find((a) => a.id === advanceId);
    if (!advance) return;

    setIsSubmitting(true);
    try {
      // 1. جلب رقم الهاتف من جدول employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees') // ← غيّر هذا الاسم إذا كان جدولك مختلفًا (مثل 'profiles' أو 'users')
        .select('phone')
        .eq('id', employee_id)
        .single();

      if (employeeError || !employeeData?.phone) {
        throw new Error('لم يتم العثور على رقم هاتف الموظف');
      }

      const employeePhone = employeeData.phone;

      // 2. تحديث حالة السلفة
      const { error: updateError } = await supabase
        .from('advance_requests')
        .update({
          status: 'approved',
          approved_date: new Date().toISOString().split('T')[0],
          approved_by: user?.name,
        })
        .eq('id', advanceId);

      if (updateError) throw updateError;

      // 3. إدخال إشعار
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: employee_id,
        title: 'تمت الموافقة على السلفة',
        message: `تمت الموافقة على طلب السلفة بمبلغ ${advance.amount.toLocaleString('ar-EG')} دينار`,
        type: 'success',
        read: false,
        action_type: 'advance',
        action_id: advanceId,
      });

      // 4. إرسال رسالة واتساب (باستخدام الرقم المستخرج)
      await sendWhatsAppTemplateMessage({
        to: employeePhone, // الرقم من قاعدة البيانات
        parameters: [
          `تمت الموافقة على طلب السلفة بمبلغ ${advance.amount.toLocaleString('ar-EG')} دينار`,
          'الإدارة'
        ],
      });

      console.log('✅ تم إرسال الرسالة بنجاح');

      setShowRequestsModal(false);
      setIsSubmitting(false);
      showCustomModal('نجح!', 'تمت الموافقة على السلفة', true);
    } catch (error: any) {
      setIsSubmitting(false);
      showCustomModal('خطأ', error.message || 'فشل في الموافقة على السلفة.', false);
    }
  };

  const handleRejectAdvance = async (advanceId: string, employee_id: string) => {
    const advance = advances.find((a) => a.id === advanceId);
    if (!advance) return;
    setIsSubmitting(true);
    try {
      // 1. جلب رقم الهاتف من جدول employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees') // ← غيّر هذا الاسم إذا كان جدولك مختلفًا (مثل 'profiles' أو 'users')
        .select('phone')
        .eq('id', employee_id)
        .single();

      if (employeeError || !employeeData?.phone) {
        throw new Error('لم يتم العثور على رقم هاتف الموظف');
      }

      const employeePhone = employeeData.phone;

      const { error } = await supabase
        .from('advance_requests')
        .update({
          status: 'rejected',
          approved_date: new Date().toISOString().split('T')[0],
          approved_by: user?.name,
        })
        .eq('id', advanceId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: employee_id,
        title: 'تم رفض السلفة',
        message: `تم رفض طلب السلفة بمبلغ ${advance.amount.toLocaleString('ar-EG')} دينار`,
        type: 'danger',
        read: false,
        action_type: 'advance',
        action_id: advanceId,
      });

      // 4. إرسال رسالة واتساب (باستخدام الرقم المستخرج)
      await sendWhatsAppTemplateMessage({
        to: employeePhone, // الرقم من قاعدة البيانات
        parameters: [
          `تم رفض طلب السلفة بمبلغ ${advance.amount.toLocaleString('ar-EG')} دينار`,
          'الإدارة'
        ],
      });

      console.log('✅ تم إرسال الرسالة بنجاح');

      setShowRequestsModal(false);
      setIsSubmitting(false);
      showCustomModal('نجح!', 'تم رفض السلفة', true);
    } catch (error: any) {
      setIsSubmitting(false);
      showCustomModal('خطأ', error.message || 'فشل رفض السلفة.', false);
    }
  };

  const handleApproveLeave = async (leaveId: string, employee_id: string) => {
    const leave = leaves.find((l) => l.id === leaveId);
    if (!leave) return;

    setIsSubmitting(true);
    try {
      // 1. تحديث حالة طلب الإجازة
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_date: new Date().toISOString().split('T')[0],
          approved_by: user?.name,
        })
        .eq('id', leaveId);

      if (updateError) throw updateError;

      // 2. جلب رقم الهاتف من جدول employees
      const { data: employeeData, error: phoneError } = await supabase
        .from('employees')
        .select('phone')
        .eq('id', employee_id)
        .single();

      if (phoneError) {
        console.warn('خطأ في جلب رقم الهاتف:', phoneError.message);
      }

      // 3. تحويل deduction_amount إلى رقم (قد يكون null أو string)
      const deductionAmount = leave.deduction_amount
        ? parseFloat(leave.deduction_amount as unknown as string)
        : 0;

      // 4. إنشاء خصم في جدول deductions إذا كان المبلغ > 0
      if (deductionAmount > 0) {
        const deductionId = uuidv4();
        const { error: dedError } = await supabase.from('deductions').insert({
          id: deductionId,
          employee_id: employee_id,
          employee_name: leave.employee_name,
          branch_id: leave.branch_id,
          amount: Math.round(deductionAmount), // ✅ تحويل إلى عدد صحيح
          reason: `خصم إجازة - ${leave.days} يوم (${leave.payment_type === 'half_paid' ? 'نصف راتب' : 'غير مدفوعة'})`,
          date: new Date().toISOString().split('T')[0],
          type: 'other', // أو 'leave' إذا أضفته للـ constraint
          created_by: user?.name || '',
        });

        if (dedError) throw dedError;
      }

      // 5. تحديد نص نوع الإجازة بالعربية
      const paymentTypeMap: Record<string, string> = {
        paid: 'مدفوعة بالكامل',
        half_paid: 'بنصف راتب',
        unpaid: 'بدون راتب',
      };
      const paymentTypeText = paymentTypeMap[leave.payment_type] || leave.payment_type;

      // 6. إرسال رسالة واتساب (إذا وُجد رقم هاتف)
      if (employeeData?.phone) {
        const line1 = `تمت الموافقة على إجازتك لمدة ${leave.days} يوم`;
        const line2 = deductionAmount > 0
          ? `نوع الإجازة: ${paymentTypeText}، سيتم خصم ${deductionAmount.toLocaleString('ar-EG')} دينار`
          : `نوع الإجازة: ${paymentTypeText}`;

        await sendWhatsAppTemplateMessage({
          to: employeeData.phone,
          parameters: [line1, line2],
          templateName: 'confirmation2',
        });
      }

      // 7. إرسال إشعار داخل التطبيق
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: employee_id,
        title: 'تمت الموافقة على الإجازة',
        message: `تمت الموافقة على إجازتك لمدة ${leave.days} يوم (${paymentTypeText})${
          deductionAmount > 0 ? ` مع خصم ${deductionAmount.toLocaleString('ar-EG')} دينار` : ''
        }`,
        type: 'success',
        read: false,
        action_type: 'leave',
        action_id: leaveId,
      });

      // 8. تنظيف الواجهة
      setShowRequestsModal(false);
      showCustomModal('نجح!', 'تمت الموافقة على الإجازة', true);
    } catch (error: any) {
      console.error('خطأ في handleApproveLeave:', error);
      showCustomModal('خطأ', error.message || 'فشل في الموافقة على الإجازة.', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectLeave = async (leaveId: string, employee_id: string) => {
    const leave = leaves.find((l) => l.id === leaveId);
    if (!leave) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          approved_date: new Date().toISOString().split('T')[0],
          approved_by: user?.name,
        })
        .eq('id', leaveId);
      if (error) throw error;

      // 1. جلب رقم الهاتف من جدول employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees') // ← غيّر هذا الاسم إذا كان جدولك مختلفًا (مثل 'profiles' أو 'users')
        .select('phone')
        .eq('id', employee_id)
        .single();

      if (employeeError || !employeeData?.phone) {
        throw new Error('لم يتم العثور على رقم هاتف الموظف');
      }

      const employeePhone = employeeData.phone;

      // 4. إرسال رسالة واتساب (باستخدام الرقم المستخرج)
      await sendWhatsAppTemplateMessage({
        to: employeePhone, // الرقم من قاعدة البيانات
        parameters: [
          `تم رفض طلب الإجازة لمدة ${leave.days} يوم`,
          'الإدارة'
        ],
      });

      console.log('✅ تم إرسال الرسالة بنجاح');

      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: employee_id,
        title: 'تم رفض الإجازة',
        message: `تم رفض طلب الإجازة لمدة ${leave.days} يوم`,
        type: 'danger',
        read: false,
        action_type: 'leave',
        action_id: leaveId,
      });

      setShowRequestsModal(false);
      setIsSubmitting(false);
      showCustomModal('نجح!', 'تم رفض الإجازة', true);
    } catch (error: any) {
      setIsSubmitting(false);
      showCustomModal('خطأ', error.message || 'فشل رفض الإجازة.', false);
    }
  };

  const showEmployeeRequests = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowRequestsModal(true);
  };

  const employeeAdvances = selectedEmployee
    ? advances.filter((a) => a.employee_id === selectedEmployee.id && a.status === 'pending')
    : [];
  const employeeLeaves = selectedEmployee
    ? leaves.filter((l) => l.employee_id === selectedEmployee.id && l.status === 'pending')
    : [];

  const openAddModal = () => {
    let initialbranch_id = '';
    if (isAccountant) {
      initialbranch_id = user?.branch_id || branches[0]?.id || '';
    } else if (isGeneralAccountant || isGeneralManager) {
      initialbranch_id = branches[0]?.id || '';
    }
    setFormData((prev) => ({
      ...prev,
      branch_id: initialbranch_id,
    }));
    setShowAddModal(true);
  };

  const openRewardModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setRewardAmount('');
    setRewardReason('مكافأة أداء');
    setRewardModalVisible(true);
  };

  const saveReward = async () => {
    if (!selectedEmployee) return;
    const amount = parseFloat(rewardAmount);
    if (isNaN(amount) || amount <= 0) {
      showCustomModal('خطأ', 'الرجاء إدخال مبلغ صحيح', false);
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. جلب رقم الهاتف من جدول employees
      const { data: employeeData, error: phoneError } = await supabase
        .from('employees') // ← غيّر الاسم إذا كان جدولك مختلفًا
        .select('phone')
        .eq('id', selectedEmployee.id)
        .single();

      if (phoneError || !employeeData?.phone) {
        console.warn('لم يتم العثور على رقم هاتف الموظف:', selectedEmployee.id);
        // يمكنك اختيار: إيقاف العملية أو المتابعة دون واتساب
        // هنا سأتابع بدون إرسال واتساب إذا لم يوجد رقم
      }

      const rewardId = Math.random().toString(36).substring(2, 15);

      // 2. إدخال سجل المكافأة
      const { error: rewardError } = await supabase.from('rewards').insert({
        id: rewardId,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.name,
        branch_id: selectedEmployee.branch_id || null,
        amount: Math.round(amount),
        reason: rewardReason,
        date: new Date().toISOString().split('T')[0],
        created_by: user?.name || 'Admin',
        notes: null,
      });

      if (rewardError) throw rewardError;

      // 3. إدخال إشعار
      await supabase.from('notifications').insert({
        id: uuidv4(),
        user_id: selectedEmployee.id,
        title: 'تمت اضافة المكافأة',
        message: `تمت اضافة المكافأة وقدرها ${amount} دينار`,
        type: 'success',
        read: false,
        action_type: 'rewards',
        action_id: rewardId,
      });

      // 4. إرسال رسالة واتساب (إذا وُجد رقم الهاتف)
      if (employeeData?.phone) {
        await sendWhatsAppTemplateMessage({
          to: employeeData.phone,
          parameters: [
            `تمت إضافة مكافأة وقدرها ${amount.toLocaleString('ar-EG')} دينار`,
            'الإدارة'
          ],
          templateName: 'confirmation2' // أو اسم قالب مناسب للمكافآت
        });
      }

      // 5. نجاح العملية
      showCustomModal('تم', 'تمت إضافة المكافأة بنجاح', true);
      setRewardModalVisible(false);
      await loadData();
    } catch (error: any) {
      showCustomModal('خطأ', error.message || 'فشل حفظ المكافأة', false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const renderTabs = () => {
    const tabs = [];

    if (isGeneralManager) {
      tabs.push(
        <TouchableOpacity
          key="all"
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>الكل</Text>
        </TouchableOpacity>
      );
    }

    branches.forEach((branch) => {
      let shouldShow = false;
      if (isAccountant) {
        shouldShow = branch.id === user?.branch_id;
      } else if (isGeneralAccountant || isGeneralManager) {
        shouldShow = true;
      }

      if (shouldShow) {
        tabs.push(
          <TouchableOpacity
            key={branch.id}
            style={[styles.tab, activeTab === branch.id && styles.activeTab]}
            onPress={() => setActiveTab(branch.id)}
          >
            <Text style={[styles.tabText, activeTab === branch.id && styles.activeTabText]}>
              {branch.name}
            </Text>
          </TouchableOpacity>
        );
      }
    });

    return tabs;
  };


  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'إدارة الموظفين',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />

      
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {renderTabs()}
        </ScrollView>
      </View>

      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="بحث عن موظف..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textLight}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredEmployees.map((employee) => {
          const branch = branches.find((b) => b.id === employee.branch_id);
          const pendingRequests =
            advances.filter((a) => a.employee_id === employee.id && a.status === 'pending').length +
            leaves.filter((l) => l.employee_id === employee.id && l.status === 'pending').length;
          return (
            <TouchableOpacity
              key={employee.id}
              style={styles.employeeCard}
              onPress={() => showEmployeeRequests(employee)}
            >
              <View style={styles.employeeHeader}>
                <View style={styles.avatarSmall}>
                  <User size={24} color="#fff" />
                </View>
                <View style={styles.employeeInfo}>
                  <Text style={styles.employee_name}>{employee.name}</Text>
                
                  <Text style={styles.employeeBranch}> {employee.role === 'employee'
                      ? employee.position
                      : employee.role === 'accountant'
                      ? 'محاسب فرعي'
                      : employee.role === 'general_accountant'
                      ? 'محاسب عام'
                      : 'مدير عام'}  /  {branch?.name}</Text>
                </View>
                
              </View>
              <View style={styles.employeeDetails}>
                <View style={styles.detailRow}>
                  <Mail size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>{employee.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Phone size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>{employee.phone}</Text>
                </View>
                <View style={styles.detailRow}>
                  <DollarSign size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailText}>
                    {employee.salary.toLocaleString('ar-EG')} دينار (
                    {employee.payment_frequency === 'monthly' ? 'شهري' : 'أسبوعي'})
                  </Text>
                </View>
              </View>
              {pendingRequests > 0 && (
                <View style={styles.requestsBadge}>
                  <Text style={styles.requestsBadgeText}>{pendingRequests} طلبات معلقة</Text>
                </View>
              )}
              <View style={styles.employeeActions}>
                <TouchableOpacity
                  onPress={() => openRewardModal(employee)}
                  style={styles.actionIconButton}
                >
                  <Gift size={24} color="#004d2dff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => openEditModal(employee)}
                >
                  <Edit size={24} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => {
                    setSelectedEmployee(employee);
                    setShowDeductionModal(true);
                  }}
                >
                  <AlertTriangle size={24} color={Colors.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconButton}
                  onPress={() => {
                    setSelectedEmployee(employee);
                    setShowAbsenceModal(true);
                  }}
                >
                  <Calendar size={24} color={Colors.danger} />
                </TouchableOpacity>
                {isGeneralManager ? (
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={() => handleDeleteEmployee(employee)}
                  >
                    <Trash2 size={24} color={Colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add Employee Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>إضافة موظف جديد</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView>
              <TextInput
                style={styles.input}
                placeholder="الاسم *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={[
                  styles.input,
                  formData.email && !isValidEmail(formData.email) ? styles.inputError : null,
                ]}
                placeholder="البريد الإلكتروني *"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textLight}
              />
              {formData.email && !isValidEmail(formData.email) && (
                <Text style={{ color: '#e74c3c', marginTop: 6, fontSize: 14, textAlign: 'right' }}>
                  البريد الإلكتروني غير صحيح
                </Text>
              )}

              <PasswordInput
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="رقم الهاتف *"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
              />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>النوع *</Text>
                {isAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب فرعي
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralManager ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب فرعي
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'general_accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'general_accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'general_accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب عام
                      </Text>
                    </TouchableOpacity>
                    
                  </View>
                ) : null}
              </View>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>الفرع *</Text>
                {isAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity activeOpacity={1} style={[styles.pickerButton, styles.pickerButtonActive]}>
                      <Text style={[styles.pickerButtonText, styles.pickerButtonTextActive]}>
                        {branches.find((b) => b.id === user?.branch_id)?.name || 'فرعك'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralAccountant || isGeneralManager ? (
                  <View style={styles.pickerButtons}>
                    {branches.map((branch) => (
                      <TouchableOpacity
                        key={branch.id}
                        style={[
                          styles.pickerButton,
                          formData.branch_id === branch.id && styles.pickerButtonActive,
                        ]}
                        onPress={() => setFormData({ ...formData, branch_id: branch.id })}
                      >
                        <Text
                          style={[
                            styles.pickerButtonText,
                            formData.branch_id === branch.id && styles.pickerButtonTextActive,
                          ]}
                        >
                          {branch.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
              <TextInput
                style={styles.input}
                placeholder="المسمى الوظيفي *"
                value={formData.position}
                onChangeText={(text) => setFormData({ ...formData, position: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="الراتب *"
                value={formData.salary}
                onChangeText={(text) => setFormData({ ...formData, salary: text })}
                keyboardType="numeric"
                placeholderTextColor={Colors.textLight}
              />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>نوع الدفع</Text>
                <View style={styles.pickerButtons}>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      formData.payment_frequency === 'monthly' && styles.pickerButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, payment_frequency: 'monthly' })}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        formData.payment_frequency === 'monthly' && styles.pickerButtonTextActive,
                      ]}
                    >
                      شهري
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      formData.payment_frequency === 'weekly' && styles.pickerButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, payment_frequency: 'weekly' })}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        formData.payment_frequency === 'weekly' && styles.pickerButtonTextActive,
                      ]}
                    >
                      أسبوعي
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="رقم الهوية"
                value={formData.national_id}
                onChangeText={(text) => setFormData({ ...formData, national_id: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="العنوان"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="جهة الاتصال في حالات الطوارئ"
                value={formData.emergency_contact}
                onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="رقم هاتف الطوارئ"
                value={formData.emergency_phone}
                onChangeText={(text) => setFormData({ ...formData, emergency_phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleAddEmployee}>
                <Text style={styles.submitButtonText}>إضافة الموظف</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Requests Modal */}
      <Modal visible={showRequestsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRequestsModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>طلبات {selectedEmployee?.name}</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView>
              {employeeAdvances.length === 0 && employeeLeaves.length === 0 ? (
                <Text style={styles.noRequestsText}>لا توجد طلبات معلقة</Text>
              ) : (
                <>
                  {employeeAdvances.length > 0 && (
                    <>
                      <Text style={styles.requestsSectionTitle}>طلبات السلف</Text>
                      {employeeAdvances.map((advance) => (
                        <View key={advance.id} style={styles.requestItem}>
                          <Text style={styles.requestAmount}>
                            {advance.amount.toLocaleString('ar-EG')} دينار
                          </Text>
                          <Text style={styles.requestReason}>{advance.reason}</Text>
                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: Colors.success }]}
                              onPress={() => handleApproveAdvance(advance.id, advance.employee_id)}
                            >
                              <Text style={styles.actionButtonText}>موافقة</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: Colors.danger }]}
                              onPress={() => handleRejectAdvance(advance.id, advance.employee_id)}
                            >
                              <Text style={styles.actionButtonText}>رفض</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                  {employeeLeaves.length > 0 && (
                    <>
                      <Text style={styles.requestsSectionTitle}>طلبات الإجازات</Text>
                      {employeeLeaves.map((leave) => (
                        <View key={leave.id} style={styles.requestItem}>
                          <Text style={styles.requestAmount}>{leave.days} يوم</Text>
                          <Text style={styles.requestReason}>
                            من {new Date(leave.start_date).toLocaleDateString('ar-EG')} إلى{' '}
                            {new Date(leave.end_date).toLocaleDateString('ar-EG')}
                          </Text>
                          <Text style={styles.requestReason}>{leave.reason}</Text>
                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: Colors.success }]}
                              onPress={() => handleApproveLeave(leave.id, leave.employee_id)}
                            >
                              <Text style={styles.actionButtonText}>موافقة</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: Colors.danger }]}
                              onPress={() => handleRejectLeave(leave.id, leave.employee_id)}
                            >
                              <Text style={styles.actionButtonText}>رفض</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setSelectedEmployee(null);
                  resetForm();
                }}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تعديل بيانات الموظف</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView>
              <TextInput
                style={styles.input}
                placeholder="الاسم *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={[
                  styles.input,
                  formData.email && !isValidEmail(formData.email) ? styles.inputError : null,
                ]}
                placeholder="البريد الإلكتروني *"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textLight}
              />
              {formData.email && !isValidEmail(formData.email) && (
                <Text style={{ color: '#e74c3c', marginTop: 6, fontSize: 14, textAlign: 'right' }}>
                  البريد الإلكتروني غير صحيح
                </Text>
              )}

              <PasswordInput
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="رقم الهاتف *"
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
              />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>النوع *</Text>
                {isAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب فرعي
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralManager ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'employee' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'employee' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'employee' && styles.pickerButtonTextActive,
                        ]}
                      >
                        موظف
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب فرعي
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pickerButton,
                        formData.role === 'general_accountant' && styles.pickerButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: 'general_accountant' })}
                    >
                      <Text
                        style={[
                          styles.pickerButtonText,
                          formData.role === 'general_accountant' && styles.pickerButtonTextActive,
                        ]}
                      >
                        محاسب عام
                      </Text>
                    </TouchableOpacity>
                   
                  </View>
                ) : null}
              </View>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>الفرع *</Text>
                {isAccountant ? (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity activeOpacity={1} style={[styles.pickerButton, styles.pickerButtonActive]}>
                      <Text style={[styles.pickerButtonText, styles.pickerButtonTextActive]}>
                        {branches.find((b) => b.id === user?.branch_id)?.name || 'فرعك'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : isGeneralAccountant || isGeneralManager ? (
                  <View style={styles.pickerButtons}>
                    {branches.map((branch) => (
                      <TouchableOpacity
                        key={branch.id}
                        style={[
                          styles.pickerButton,
                          formData.branch_id === branch.id && styles.pickerButtonActive,
                        ]}
                        onPress={() => setFormData({ ...formData, branch_id: branch.id })}
                      >
                        <Text
                          style={[
                            styles.pickerButtonText,
                            formData.branch_id === branch.id && styles.pickerButtonTextActive,
                          ]}
                        >
                          {branch.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
              <TextInput
                style={styles.input}
                placeholder="المسمى الوظيفي"
                value={formData.position}
                onChangeText={(text) => setFormData({ ...formData, position: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="الراتب *"
                value={formData.salary}
                onChangeText={(text) => setFormData({ ...formData, salary: text })}
                keyboardType="numeric"
                placeholderTextColor={Colors.textLight}
              />
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>نوع الدفع</Text>
                <View style={styles.pickerButtons}>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      formData.payment_frequency === 'monthly' && styles.pickerButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, payment_frequency: 'monthly' })}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        formData.payment_frequency === 'monthly' && styles.pickerButtonTextActive,
                      ]}
                    >
                      شهري
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pickerButton,
                      formData.payment_frequency === 'weekly' && styles.pickerButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, payment_frequency: 'weekly' })}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        formData.payment_frequency === 'weekly' && styles.pickerButtonTextActive,
                      ]}
                    >
                      أسبوعي
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="رقم الهوية"
                value={formData.national_id}
                onChangeText={(text) => setFormData({ ...formData, national_id: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="العنوان"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="جهة الاتصال في حالات الطوارئ"
                value={formData.emergency_contact}
                onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                placeholderTextColor={Colors.textLight}
              />
              <TextInput
                style={styles.input}
                placeholder="رقم هاتف الطوارئ"
                value={formData.emergency_phone}
                onChangeText={(text) => setFormData({ ...formData, emergency_phone: text })}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.textLight}
              />
              <TouchableOpacity style={styles.submitButton} onPress={handleEditEmployee}>
                <Text style={styles.submitButtonText}>حفظ التعديلات</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Deduction Modal */}
      <Modal visible={showDeductionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDeductionModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>إضافة خصم</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.employee_nameInModal}>{selectedEmployee?.name}</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>نوع الخصم</Text>
              <View style={styles.pickerButtons}>
                {(['penalty', 'late', 'absence', 'other'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pickerButton, deductionType === type && styles.pickerButtonActive]}
                    onPress={() => setDeductionType(type)}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        deductionType === type && styles.pickerButtonTextActive,
                      ]}
                    >
                      {type === 'penalty'
                        ? 'اخطاء'
                        : type === 'late'
                        ? 'تأخير'
                        : type === 'absence'
                        ? 'غياب'
                        : 'أخرى'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="المبلغ"
              value={deduction_amount}
              onChangeText={setdeduction_amount}
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="السبب"
              value={deductionReason}
              onChangeText={setDeductionReason}
              multiline
              numberOfLines={4}
              placeholderTextColor={Colors.textLight}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleAddDeduction}>
              <Text style={styles.submitButtonText}>إضافة الخصم</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Absence Modal */}
      <Modal visible={showAbsenceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAbsenceModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>تسجيل غياب</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.employee_nameInModal}>{selectedEmployee?.name}</Text>
            <AdaptiveDatePicker
              value={absenceDate}
              onChange={setAbsenceDate}
              placeholder="تاريخ الغياب (YYYY-MM-DD)"
              style={styles.input}
            />
            <TextInput
              style={styles.input}
              placeholder="مبلغ الخصم (اختياري)"
              value={absenceDeduction}
              onChangeText={setAbsenceDeduction}
              keyboardType="numeric"
              placeholderTextColor={Colors.textLight}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="السبب (اختياري)"
              value={absenceReason}
              onChangeText={setAbsenceReason}
              multiline
              numberOfLines={3}
              placeholderTextColor={Colors.textLight}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleAddAbsence}>
              <Text style={styles.submitButtonText}>تسجيل الغياب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlayDellet}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>تأكيد الحذف</Text>
            <Text style={styles.deleteModalMessage}>
              هل أنت متأكد من حذف الموظف{' '}
              <Text style={{ fontWeight: 'bold' }}>{employeeToDelete?.name}</Text>؟
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteButton]}
                onPress={confirmDeleteEmployee}
              >
                <Text style={styles.deleteButtonText}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reward Modal */}
      <Modal
        visible={rewardModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRewardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>إضافة مكافأة</Text>
            <Text style={styles.modalSubtitle}>للموظف: {selectedEmployee?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder="المبلغ"
              value={rewardAmount}
              onChangeText={setRewardAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="السبب"
              value={rewardReason}
              onChangeText={setRewardReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#95a5a6' }]}
                onPress={() => setRewardModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#27ae60' }]}
                onPress={saveReward}
              >
                <Text style={styles.modalButtonText}>حفظ</Text>
              </TouchableOpacity>
            </View>
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
      <SubmittingModal visible={isSubmitting} message="جاري التحميل ..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 0,
  },
  tab: {
    height: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.text,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row-reverse',
    padding: 5,
    gap: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  employeeCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 5,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 4,
    gap: 10,
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  employeeInfo: {
    flex: 1,
  },
  employee_name: {
    fontSize: 16,
    textAlign: 'right',
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  employeePosition: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: 2,
  },
  employeeBranch: {
    fontSize: 12,
    textAlign: 'right',
    color: Colors.primary,
  },
  employeeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  employeeDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
  },
  requestsBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.warning,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  requestsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'right',
  },
  pickerContainer: {
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: 'right',
  },
  pickerButtons: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pickerButtonText: {
    fontSize: 14,
    color: Colors.text,
  },
  pickerButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noRequestsText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    paddingVertical: 40,
  },
  requestsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'right',
    marginTop: 16,
    marginBottom: 12,
  },
  requestItem: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  requestAmount: {
    fontSize: 18,
    textAlign: 'right',
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  requestReason: {
    fontSize: 14,
    textAlign: 'right',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  employee_nameInModal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalOverlayDellet: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  cancelButtonText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 40,
  },
  modalSubtitle: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  inputError: {
    borderColor: '#e74c3c',
    borderWidth: 1,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputPassword: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: Colors.text,
  },
  iconButton: {
    padding: 8,
  },

});