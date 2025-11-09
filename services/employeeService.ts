import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const createEmployee = async (
  data: {
    name: string;
    email: string;
    phone: string;
    branch_id: string;
    position: string;
    salary: string; // سيتم تحويله إلى number
    payment_frequency: 'weekly' | 'monthly';
    national_id: string;
    address: string;
    emergency_contact: string;
    emergency_phone: string;
    password: string;
    role: UserRole;
  }
): Promise<{ success: boolean; message: string; employeeId?: string }> => {
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
    password,
    role,
  } = data;

  // === 1. التحقق من المدخلات الأساسية ===
  if (!name.trim() || !email.trim() || !password || !position || !salary) {
    return { success: false, message: 'الرجاء ملء الحقول المطلوبة' };
  }

  if (password.length < 6) {
    return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // === 2. تحقق من عدم وجود البريد في profiles أو employees ===
  const [profileRes, employeeRes] = await Promise.all([
    supabase.from('profiles').select('id').ilike('email', cleanEmail).maybeSingle(),
    supabase.from('employees').select('id').ilike('email', cleanEmail).maybeSingle(),
  ]);

  if (profileRes.error || employeeRes.error) {
    console.error('DB error:', profileRes.error, employeeRes.error);
    return { success: false, message: 'خطأ في قاعدة البيانات' };
  }

  if (profileRes.data || employeeRes.data) {
    return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
  }

  // === 3. إنشاء ID مشترك ===
  const userId = uuidv4();

  // === 4. تحويل الراتب إلى رقم ===
  const salaryNum = parseInt(salary, 10);
  if (isNaN(salaryNum) || salaryNum < 0) {
    return { success: false, message: 'الراتب يجب أن يكون رقمًا غير سالب' };
  }

  try {
    // === 5. إدراج في جدول profiles أولاً ===
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      name: cleanName,
      email: cleanEmail,
      password: password, // ⚠️ نص عادي (غير آمن للإنتاج)
      phone: phone.trim() || null,
      role: role,
      branch_id: branch_id || null,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      if (profileError.message.includes('duplicate key')) {
        return { success: false, message: 'البريد الإلكتروني مستخدم بالفعل' };
      }
      return { success: false, message: 'فشل إنشاء حساب المستخدم' };
    }

    // === 6. إدراج في جدول employees ===
    const { error: employeeError } = await supabase.from('employees').insert({
      id: userId, // نفس الـ ID
      name: cleanName,
      email: cleanEmail,
      phone: phone.trim() || null,
      branch_id: branch_id || null,
      position: position.trim(),
      salary: salaryNum,
      payment_frequency: payment_frequency,
      role: role, // مكرر، لكنه مطلوب في الجدول
      hire_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      national_id: national_id.trim() || null,
      address: address.trim() || null,
      emergency_contact: emergency_contact.trim() || null,
      emergency_phone: emergency_phone.trim() || null,
    });

    if (employeeError) {
      console.error('Employee creation error:', employeeError);
      // ⚠️ اختياري: حذف السجل من profiles إذا فشل employees (لتجنب التعارض)
      await supabase.from('profiles').delete().eq('id', userId);
      return { success: false, message: 'فشل إنشاء بيانات الموظف' };
    }

    return { success: true, message: 'تم إنشاء الموظف بنجاح', employeeId: userId };
  } catch (error) {
    console.error('Unexpected error in createEmployee:', error);
    return { success: false, message: 'حدث خطأ غير متوقع' };
  }
};