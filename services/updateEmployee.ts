// src/services/employeeService.ts
import { supabase } from '@/lib/supabase';
import { Employee } from '@/types';

export type UserRole = 'employee' | 'accountant' | 'general_accountant' | 'general_manager';

export type EmployeeUpdateData = {
  name: string;
  email: string;
  phone: string;
  branch_id: string | null;
  position: string;
  salary: string;
  payment_frequency: 'weekly' | 'monthly';
  national_id: string;
  address: string;
  emergency_contact: string;
  emergency_phone: string;
  role: UserRole;
  password: string;
};

export const updateEmployee = async (
  employeeId: string,
  data: EmployeeUpdateData
): Promise<{ success: boolean; message: string }> => {
  const {
    name,
    email,
    phone,
    branch_id,
    position,
    salary,
    payment_frequency,
    national_id,
    address,
    emergency_contact,
    emergency_phone,
    role,
    password,
  } = data;

  // 1. التحقق من الحقول الأساسية
  if (!name.trim() || !email.trim() || !position.trim() || !salary) {
    return { success: false, message: 'الاسم، البريد، الوظيفة، والراتب مطلوبة' };
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  // 2. التحقق من الراتب
  const salaryNum = parseInt(salary, 10);
  if (isNaN(salaryNum) || salaryNum < 0) {
    return { success: false, message: 'الراتب يجب أن يكون رقمًا غير سالب' };
  }

  // 3. جلب البريد الحالي
  const { data: currentData, error: fetchError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', employeeId)
    .single();

  if (fetchError || !currentData) {
    return { success: false, message: 'لم يتم العثور على الموظف' };
  }

  // 4. إذا تغيّر البريد، تحقق من عدم وجوده
  if (cleanEmail !== currentData.email.toLowerCase()) {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .neq('id', employeeId)
      .maybeSingle();

    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('email', cleanEmail)
      .neq('id', employeeId)
      .maybeSingle();

    if (existingProfile || existingEmployee) {
      return { success: false, message: 'البريد الإلكتروني مستخدم من قبل موظف آخر' };
    }
  }

  // 5. تحديث جدول profiles
  const profileUpdate: any = {
    name: cleanName,
    email: cleanEmail,
    phone: phone ? phone.trim() : null,
    role: role,
    password:password,
    branch_id: branch_id || null,
  };

  if (password !== undefined) {
    if (password.length < 6) {
      return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    }
    profileUpdate.password = password;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', employeeId);

  if (profileError) {
    console.error('Profile update error:', profileError);
    return { success: false, message: 'فشل تحديث بيانات الحساب' };
  }

  // 6. تحديث جدول employees
  const { error: employeeError } = await supabase
    .from('employees')
    .update({
      name: cleanName,
      email: cleanEmail,
      phone: phone ? phone.trim() : null,
      branch_id: branch_id || null,
      position: position.trim(),
      salary: salaryNum,
      payment_frequency: payment_frequency,
      role: role,
      national_id: national_id ? national_id.trim() : null,
      address: address ? address.trim() : null,
      emergency_contact: emergency_contact ? emergency_contact.trim() : null,
      emergency_phone: emergency_phone ? emergency_phone.trim() : null,
    })
    .eq('id', employeeId);

  if (employeeError) {
    console.error('Employee update error:', employeeError);
    return { success: false, message: 'فشل تحديث بيانات الموظف' };
  }

  return { success: true, message: 'تم تحديث بياناتك بنجاح' };
};

// ... (باقي الكود أعلاه)

/**
 * حذف موظف من جدولي profiles و employees
 */
export const deleteEmployee = async (employeeId: string): Promise<{ success: boolean; message: string }> => {
  if (!employeeId) {
    return { success: false, message: 'معرف الموظف مطلوب' };
  }

  try {
    // 1. حذف من جدول employees أولاً (لأنه يعتمد على profiles في بعض الأنظمة، لكن في حالتك لا مشكلة)
    const { error: employeeError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (employeeError) {
      console.error('فشل حذف من employees:', employeeError);
      return { success: false, message: 'فشل حذف بيانات الموظف' };
    }

    // 2. حذف من جدول profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', employeeId);

    if (profileError) {
      console.error('فشل حذف من profiles:', profileError);
      // ⚠️ ملاحظة: إذا فشل حذف profiles بعد نجاح employees، قد يبقى سجل "يتيم"
      // لكن في حالتك، لا يوجد foreign key من employees إلى profiles، لذا لا مشكلة كبيرة
      return { success: false, message: 'فشل حذف حساب المستخدم' };
    }

    return { success: true, message: 'تم حذف الموظف بنجاح' };
  } catch (error) {
    console.error('خطأ غير متوقع في deleteEmployee:', error);
    return { success: false, message: 'حدث خطأ غير متوقع أثناء الحذف' };
  }
};


// src/services/employeeService.ts

export const fetchEmployees = async (): Promise<{ data: Employee[]; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Fetch employees error:', error);
      return { data: [], error: 'فشل تحميل الموظفين' };
    }

    return { data: data || [], error: null };
  } catch (err) {
    console.error('Unexpected fetch error:', err);
    return { data: [], error: 'حدث خطأ غير متوقع' };
  }
};