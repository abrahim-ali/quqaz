// contexts/DataProvider.tsx
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toCamelCase, toSnakeCase } from '@/utils/caseConverter';
import {
  Branch,
  Employee,
  AdvanceRequest,
  LeaveRequest,
  Deduction,
  Absence,
  SalaryPayment,
  Notification,
  Message,
  User,
  Reward,
} from '@/types';
import { useAuth } from './AuthContext';

export const [DataProvider, useData] = createContextHook(() => {
  const { user: authUser } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    console.log('Loading data for user:', authUser?.email);
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    try {
      const [
        branchesRes,
        employeesRes,
        advancesRes,
        leavesRes,
        deductionsRes,
        absencesRes,
        paymentsRes,
        notificationsRes,
        messagesRes,
        rewardsRes,
      ] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('employees').select('*'),
        supabase.from('advance_requests').select('*'),
        supabase.from('leave_requests').select('*'),
        supabase.from('deductions').select('*'),
        supabase.from('absences').select('*'),
        supabase.from('salary_payments').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('messages').select('*').or(`to.eq.${authUser.id},from.eq.${authUser.id}`),
        supabase.from('rewards').select('*'),
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (employeesRes.error) throw employeesRes.error;
      if (advancesRes.error) throw advancesRes.error;
      if (leavesRes.error) throw leavesRes.error;
      if (deductionsRes.error) throw deductionsRes.error;
      if (absencesRes.error) throw absencesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (notificationsRes.error) throw notificationsRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (rewardsRes.error) throw rewardsRes.error;

      setBranches(branchesRes.data as Branch[]);
      setEmployees(employeesRes.data as Employee[]);
      setAdvances(advancesRes.data as AdvanceRequest[]);
      setLeaves(leavesRes.data as LeaveRequest[]);
      setDeductions(deductionsRes.data as Deduction[]);
      setAbsences(absencesRes.data as Absence[]);
      setPayments(paymentsRes.data as SalaryPayment[]);
      setNotifications(notificationsRes.data as Notification[]);
      setMessages(messagesRes.data as Message[]);
      setRewards(rewardsRes.data as Reward[]);
    } catch (error) {
      console.error('Error loading data from Supabase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authUser]);

  // === وظائف التعديل ===

  const addEmployee = async (employee: Employee) => {
    const { error } = await supabase.from('employees').insert([employee]);
    if (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
    setEmployees([...employees, employee]);
  };

  const updateEmployee = async (id: string, updates: Partial<Employee>) => {
    const { error } = await supabase.from('employees').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
    setEmployees(employees.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
    setEmployees(employees.filter(e => e.id !== id));
  };

  const addAdvanceRequest = async (request: AdvanceRequest) => {
    const { error } = await supabase.from('advance_requests').insert([request]);
    if (error) {
      console.error('Error adding advance request:', error);
      throw error;
    }
    setAdvances([...advances, request]);
  };

  const updateAdvanceRequest = async (id: string, updates: Partial<AdvanceRequest>) => {
    const { error } = await supabase.from('advance_requests').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating advance request:', error);
      throw error;
    }
    const updated = advances.map(a => a.id === id ? { ...a, ...updates } : a);
    setAdvances(updated);
  };

  const addLeaveRequest = async (request: LeaveRequest) => {
    const { error } = await supabase.from('leave_requests').insert([request]);
    if (error) {
      console.error('Error adding leave request:', error);
      throw error;
    }
    setLeaves([...leaves, request]);
  };

  const updateLeaveRequest = async (id: string, updates: Partial<LeaveRequest>) => {
    const { error } = await supabase.from('leave_requests').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating leave request:', error);
      throw error;
    }
    setLeaves(leaves.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addDeduction = async (deduction: Deduction) => {
    const { error } = await supabase.from('deductions').insert([deduction]);
    if (error) {
      console.error('Error adding deduction:', error);
      throw error;
    }
    setDeductions([...deductions, deduction]);
  };

  const addAbsence = async (absence: Absence) => {
    const { error } = await supabase.from('absences').insert([absence]);
    if (error) {
      console.error('Error adding absence:', error);
      throw error;
    }
    setAbsences([...absences, absence]);
  };

  const addNotification = async (notification: Notification) => {
    const { error } = await supabase.from('notifications').insert([notification]);
    if (error) {
      console.error('Error adding notification:', error);
      throw error;
    }
    setNotifications([notification, ...notifications]);
  };

  const markNotificationRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };
  // في ملف السياق (مثل DataContext.tsx)
  const markAllNotificationsAsRead = async () => {
    if (!authUser) {
        return;
      }
    // 1. تحديث قاعدة البيانات
    const { error } = await supabase
      .from('notifications')
      .update({ read: true})
      .eq('user_id', authUser.id) // أو employee_id حسب تصميمك
      .eq('read', false);

    if (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }

    // 2. تحديث الحالة المحلية
    setNotifications(prev => 
      prev.map(n => n.read ? n : { ...n, read: true })
    );
  };

  const addMessage = async (message: Message) => {
    const { error } = await supabase.from('messages').insert([message]);
    if (error) {
      console.error('Error adding message:', error);
      throw error;
    }
    setMessages([message, ...messages]);
  };

  const getFilteredData = () => {
    if (!authUser) return { employees: [], advances: [], leaves: [], deductions: [], absences: [], payments: [] , notifications: [],rewards: []};

    if (authUser.role === 'general_manager') {
      // المدير العام يرى الجميع
      return { employees, advances, leaves, deductions, absences, payments, notifications,rewards };
    }

    if (authUser.role === 'general_accountant') {
      // المحاسب العام يرى:
      // - جميع الموظفين (employee)
      // - جميع محاسبي الفروع (accountant)
      // - لكن لا يرى نفسه ولا المدير العام (general_manager)
      const filteredEmployees = employees.filter(emp => 
        emp.id !== authUser.id && // استبعاد نفسه
        emp.role !== 'general_manager' // استبعاد المدير العام
      );

      // نفس الترشيح لبقية الجداول (لأنها مرتبطة بـ employee_id)
      const filteredAdvances = advances.filter(a => 
        a.employee_id !== authUser.id &&
        !employees.find(e => e.id === a.employee_id)?.role?.includes('general_manager')
      );

      const filteredLeaves = leaves.filter(l => 
        l.employee_id !== authUser.id &&
        !employees.find(e => e.id === l.employee_id)?.role?.includes('general_manager')
      );

      const filteredDeductions = deductions.filter(d => 
        d.employee_id !== authUser.id &&
        !employees.find(e => e.id === d.employee_id)?.role?.includes('general_manager')
      );

      const filteredAbsences = absences.filter(a => 
        a.employee_id !== authUser.id &&
        !employees.find(e => e.id === a.employee_id)?.role?.includes('general_manager')
      );

      const filteredPayments = payments.filter(p => 
        p.employee_id !== authUser.id &&
        !employees.find(e => e.id === p.employee_id)?.role?.includes('general_manager')
      );

      return {
        employees: filteredEmployees,
        advances: advances.filter(a => a.employee_id === authUser.id),
        leaves: leaves.filter(l => l.employee_id === authUser.id),
        rewards: rewards.filter(l => l.employee_id === authUser.id),
        deductions: filteredDeductions,
        absences: filteredAbsences,
        payments: filteredPayments,
        notifications: notifications.filter(l => l.id === authUser.id),
      };
    }


    if (authUser.role === 'accountant') {
      return {
        employees: employees.filter(e => 
          e.branch_id === authUser.branch_id &&   // نفس الفرع
          e.id !== authUser.id &&              // ليس نفسه
          e.role === 'employee'                // فقط الموظفين العاديين
        ),
        advances: advances.filter(a => a.employee_id === authUser.id),
        leaves: leaves.filter(l => l.employee_id === authUser.id),
        notifications: notifications.filter(n => n.id === authUser.id),
        rewards: rewards.filter(l => l.employee_id === authUser.id),
        deductions: deductions.filter(d => 
          d.branch_id === authUser.branch_id &&
          d.employee_id !== authUser.id &&
          employees.find(emp => emp.id === d.employee_id)?.role === 'employee'
        ),
        absences: absences.filter(a => 
          a.branch_id === authUser.branch_id &&
          a.employee_id !== authUser.id &&
          employees.find(emp => emp.id === a.employee_id)?.role === 'employee'
        ),
        payments: payments.filter(p => 
          p.branch_id === authUser.branch_id &&
          p.employee_id !== authUser.id &&
          employees.find(emp => emp.id === p.employee_id)?.role === 'employee'
        ),
        
      };
    }

    const employee = employees.find(e => e.email === authUser.email);
    if (employee) {
      return {
        employees: [employee],
        advances: advances.filter(a => a.employee_id === employee.id),
        leaves: leaves.filter(l => l.employee_id === employee.id),
        rewards: rewards.filter(l => l.employee_id === authUser.id),
        deductions: deductions.filter(d => d.employee_id === employee.id),
        absences: absences.filter(a => a.employee_id === employee.id),
        payments: payments.filter(p => p.employee_id === employee.id),
        notifications: notifications.filter(n => n.id === authUser.id),
      };
    }

    return { employees: [], advances: [], leaves: [], deductions: [], absences: [], payments: [], notifications: [],rewards: [] };
  };

  const calculateNetSalary = (employee_id: string): {
    net_salary: number;
    baseSalary: number;
    approvedAdvances: number;
    totalDeductions: number; // ← يشمل الخصومات اليدوية + خصومات الغياب
  } => {
    const employee = employees.find(e => e.id === employee_id);
    if (!employee) {
      return { net_salary: 0, baseSalary: 0, approvedAdvances: 0, totalDeductions: 0 };
    }

    const baseSalary = employee.salary || 0;

    // السلف المعتمدة
    const approvedAdvances = advances
      .filter(a => a.employee_id === employee_id && a.status === 'approved')
      .reduce((sum, a) => sum + a.amount, 0);

    // الخصومات اليدوية (من جدول deductions)
    const manualDeductions = deductions
      .filter(d => d.employee_id === employee_id)
      .reduce((sum, d) => sum + d.amount, 0);

    // خصومات الغياب (من جدول absences)
    const absenceDeductions = absences
      .filter(a => a.employee_id === employee_id)
      .reduce((sum, a) => sum + a.deduction_amount, 0);

    // ✅ الدمج: إجمالي الخصومات = يدوية + غياب
    const totalDeductions = manualDeductions + absenceDeductions;

    const net_salary = Math.max(0, baseSalary - approvedAdvances - totalDeductions);

    return {
      net_salary,
      baseSalary,
      approvedAdvances,
      totalDeductions, // استخدم هذا في الواجهة كـ "الخصومات"
    };
  };


  return {
    branches,
    employees,
    advances,
    leaves,
    deductions,
    absences,
    payments,
    rewards,
    notifications,
    messages,
    isLoading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addAdvanceRequest,
    updateAdvanceRequest,
    addLeaveRequest,
    updateLeaveRequest,
    addDeduction,
    addAbsence,
    addNotification,
    markNotificationRead,
    markAllNotificationsAsRead,
    addMessage,
    getFilteredData,
    calculateNetSalary,
  };
});