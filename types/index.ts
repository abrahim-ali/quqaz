export type UserRole = 'employee' | 'accountant' | 'general_accountant' | 'general_manager';

export type PaymentFrequency = 'weekly' | 'monthly';

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branch_id: string;
  password: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  branch_id: string;
  position: string;
  salary: number;
  payment_frequency: PaymentFrequency;
  hire_date: string;
  national_id: string;
  address: string;
  emergency_contact: string;
  emergency_phone: string;
  role: UserRole;
}
export interface AdvanceRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string | null;
  amount: number;
  role: UserRole;
  reason: string;
  repayment_period: string | null; // ✅ جديد
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid'; // ملاحظة: 'paid' مسموح
  approved_by?: string;
  approved_date?: string;
  notes?: string;
}

// === واجهة طلب الإجازة المعدّلة ===
export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string | null;
  start_date: string;
  end_date: string;
  days: number;
  role: UserRole;
  reason: string;
  type: 'custom'; // ✅ ثابت الآن (لا أنواع تقليدية)
  payment_type: 'paid' | 'half_paid' | 'unpaid'; // ✅ جديد
  deduction_amount?: number | null; // ✅ جديد
  salary_at_request?: number | null; // ✅ جديد
  request_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid'; // ✅ أضف 'paid' إذا كان مدعومًا
  approved_by?: string | null;
  approved_date?: string | null;
  notes?: string;
}

export interface Deduction {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string;
  amount: number;
  reason: string;
  date: string;
  type: 'absence' | 'late' | 'penalty' | 'other';
  created_by: string;
}

export interface Absence {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string;
  date: string;
  reason?: string;
  deduction_amount: number;
  created_by: string;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string;
  base_salary: number;
  advances: number;
  deductions: number;
  net_salary: number;
  payment_date: string;
  period: string;
  paid_at: string;
  payment_frequency: PaymentFrequency;
  paid_by: string;
  notes?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  date: string;
  read: boolean;
  action_type?: 'advance' | 'leave' | 'deduction' | 'payment' | 'absence';
  action_id?: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  subject: string;
  message: string;
  date: string;
  read: boolean;
}

export interface Reward {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id: string | null; // لأنها REFERENCES ... ON DELETE SET NULL
  amount: number;
  reason: string;
  date: string; // بتنسيق 'YYYY-MM-DD'
  created_by: string;
  notes: string | null;
}