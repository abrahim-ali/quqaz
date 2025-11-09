import { useState } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogIn, Mail, Lock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import CustomModal from '@/components/CustomModal';
import SubmittingModal from '@/components/SubmittingModal';
import 'react-native-get-random-values';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { changePasswordByEmail } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    autoClose: false,
  });

  const showCustomModal = (title: string, message: string, autoClose = false) => {
    setModalConfig({ visible: true, title, message, autoClose });
  };

  const hideModal = () => {
    setModalConfig(prev => ({ ...prev, visible: false }));
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showCustomModal('خطأ', 'الرجاء إدخال البريد الإلكتروني وكلمة المرور', false);
      return;
    }

    setIsLoading(true);
    const success = await login(email.toLowerCase().trim(), password);
    setIsLoading(false);

    if (success) {
      router.replace('/(tabs)');
    } else {
      showCustomModal('خطأ', 'البريد الإلكتروني أو كلمة المرور غير صحيحة', false);
    }
  };

  const sendPasswordReset = async () => {
    if (isLoading) return;

    setIsSubmitting(true);
    const result = await changePasswordByEmail(resetEmail, currentPassword, newPassword, confirmPassword);
    setIsSubmitting(false);
    setShowResetPasswordModal(false)

    if (result.success) {
      showCustomModal('نجاح', result.message, true);
    } else {
      showCustomModal('خطأ', result.message, false);
    }
    
  };

  const quickLogin = (userEmail: string,userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Image
              source={require('@/assets/images/splash-icon.png')} // مسار الصورة المحلية
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>القوقز - ادارة الموظفين</Text>
          <Text style={styles.subtitle}>مرحباً بك، الرجاء تسجيل الدخول</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="البريد الإلكتروني"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity onPress={() => setShowResetPasswordModal(true)}>
              <Text style={styles.forgotPasswordText}>تغيير كلمة المرور؟</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <LogIn size={20} color="#fff" />
            <Text style={styles.loginButtonText}>
              {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickLogin}>
          <Text style={styles.quickLoginTitle}>📊 نظام ذكي يساعدك على تنظيم بيانات الموظفين، تتبع الحضور والغياب، إدارة الرواتب والإجازات، وتسهيل التواصل الإداري</Text>
          <TouchableOpacity
            style={styles.quickLoginButton}
            onPress={() => Linking.openURL('https://abudiab.com')}
          >
            <Text style={styles.quickLoginText}>برمجة وتصميم - أبو ذياب </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
      {/* نافذة إعادة تعيين كلمة المرور */}
      <Modal
        visible={showResetPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetModalContent}>
            <Text style={styles.resetModalTitle}>إعادة تعيين كلمة المرور</Text>
            <TextInput
              style={styles.inputEmail}
              placeholder="البريد الإلكتروني"
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.inputEmail}
              placeholder="كلمة المرور الحالية"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.inputEmail}
              placeholder="كلمة المرور الجديدة"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.inputEmail}
              placeholder="تأكيد كلمة المرور الجديدة"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            
            <View style={styles.resetModalButtons}>
              <TouchableOpacity
                style={[styles.resetButton, styles.cancelButton]}
                onPress={() => {
                  setShowResetPasswordModal(false);
                  setResetEmail('');
                }}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resetButton, styles.sendButton]}
                onPress={sendPasswordReset}
                disabled={isSending || !resetEmail.includes('@')}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>تأكيد</Text>
                )}
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
      <SubmittingModal
        visible={isSubmitting}
        message="جاري التعديل ..."
        // closable={true} // إذا أردت السماح بالإغلاق
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop:80,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'right',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    marginTop: 8,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600' as const,
  },
  quickLogin: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  quickLoginTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  quickLoginButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickLoginText: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  demoNote: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 8,
  },

  forgotPasswordText: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  resetModalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },

  resetModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },

  resetModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },

  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  cancelButton: {
    backgroundColor: '#f0f0f0',
  },

  sendButton: {
    backgroundColor: '#4A90E2',
  },

  cancelButtonText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 16,
  },
  inputEmail: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },

  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
