// components/CustomModal.tsx
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean; // اختياري: إغلاق تلقائي بعد 2 ثانية
}

export default function CustomModal({
  visible,
  title,
  message,
  onClose,
  autoClose = false,
}: CustomModalProps) {
  // إذا طلب إغلاق تلقائي، نستخدم setTimeout
  if (autoClose && visible) {
    setTimeout(() => {
      onClose();
    }, 2000);
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {!autoClose && (
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>موافق</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});