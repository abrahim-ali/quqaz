// contexts/AuthContext.tsx
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { User, UserRole } from '@/types';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // === تحميل الجلسة المحفوظة عند التشغيل ===
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_session');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Failed to restore session', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // === تسجيل الدخول ===
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, branch_id')
        .eq('email', email.trim().toLowerCase())
        .eq('password', password)
        .maybeSingle();

      if (error || !data) return false;

      const validRole = ['employee', 'accountant', 'general_accountant', 'general_manager'].includes(data.role)
        ? data.role as UserRole
        : 'employee';

      const userProfile: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        role: validRole,
        branch_id: data.branch_id ?? '',
      };

      setUser(userProfile);
      await AsyncStorage.setItem('user_session', JSON.stringify(userProfile));
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  // === تسجيل الخروج ===
  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('user_session');
  };

  // === دالة مساعدة لتسجيل المحاولات الفاشلة ===
  const recordFailedAttempt = async (key: string, currentCount: number, firstAttempt: number) => {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ count: currentCount + 1, firstAttempt })
    );
  };

  // === تغيير كلمة المرور عبر البريد (بدون جلسة نشطة) ===
  const changePasswordByEmail = async (
    email: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const RATE_LIMIT_KEY = `pwd_reset_attempts_${cleanEmail}`;
    const MAX_ATTEMPTS = 3;
    const BLOCK_DURATION = 5 * 60 * 1000; // 5 دقائق

    // تحقق من الحظر المؤقت
    const attemptDataStr = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    const attemptData = attemptDataStr ? JSON.parse(attemptDataStr) : null;

    if (attemptData) {
      if (now - attemptData.firstAttempt < BLOCK_DURATION) {
        if (attemptData.count >= MAX_ATTEMPTS) {
          const remaining = Math.ceil((BLOCK_DURATION - (now - attemptData.firstAttempt)) / 60000);
          return {
            success: false,
            message: `تم حظر هذا البريد مؤقتًا. حاول بعد ${remaining} دقيقة.`,
          };
        }
      } else {
        // انتهت مدة الحظر، امسح السجل
        await AsyncStorage.removeItem(RATE_LIMIT_KEY);
      }
    }

    // التحقق من المدخلات
    if (!cleanEmail || !currentPassword || !newPassword || !confirmPassword) {
      await recordFailedAttempt(RATE_LIMIT_KEY, attemptData?.count || 0, attemptData?.firstAttempt || now);
      return { success: false, message: 'يرجى ملء جميع الحقول' };
    }

    if (newPassword !== confirmPassword) {
      await recordFailedAttempt(RATE_LIMIT_KEY, attemptData?.count || 0, attemptData?.firstAttempt || now);
      return { success: false, message: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' };
    }

    if (newPassword.length < 6) {
      await recordFailedAttempt(RATE_LIMIT_KEY, attemptData?.count || 0, attemptData?.firstAttempt || now);
      return { success: false, message: 'كلمة المرور الجديدة قصيرة جدًا (6 أحرف على الأقل)' };
    }

    try {
      // التحقق من صحة البريد وكلمة المرور الحالية
      const { data: profile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .eq('password', currentPassword)
        .maybeSingle();

      if (checkError) {
        console.error('DB error:', checkError);
        return { success: false, message: 'خطأ في قاعدة البيانات' };
      }

      if (!profile) {
        await recordFailedAttempt(RATE_LIMIT_KEY, attemptData?.count || 0, attemptData?.firstAttempt || now);
        return { success: false, message: 'البريد أو كلمة المرور الحالية غير صحيحة' };
      }

      // تحديث كلمة المرور
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ password: newPassword })
        .eq('email', cleanEmail);

      if (updateError) {
        console.error('Update error:', updateError);
        return { success: false, message: 'فشل تحديث كلمة المرور' };
      }

      // نجاح → امسح سجل المحاولات
      await AsyncStorage.removeItem(RATE_LIMIT_KEY);
      return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
    } catch (error) {
      console.error('Unexpected error:', error);
      return { success: false, message: 'حدث خطأ غير متوقع' };
    }
  };

  return {
    user,
    isLoading,
    login,
    logout,
    changePasswordByEmail,
    isEmployee: user?.role === 'employee',
    isAccountant: user?.role === 'accountant',
    isGeneralAccountant: user?.role === 'general_accountant',
    isGeneralManager: user?.role === 'general_manager',
  };
});