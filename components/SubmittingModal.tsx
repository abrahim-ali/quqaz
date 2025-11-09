// components/SubmittingModal.tsx
import React from 'react';
import { Modal, View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SubmittingModalProps {
  visible: boolean;
  message?: string; // النص المخصص
  onClose?: () => void; // دالة لإغلاق يدوي (اختياري)
  closable?: boolean; // هل يُسمح بالإغلاق؟ (افتراضي: false)
}

const SubmittingModal: React.FC<SubmittingModalProps> = ({
  visible,
  message = 'جاري المعالجة...',
  onClose,
  closable = false,
}) => {
  const handleClose = () => {
    if (closable && onClose) {
      onClose();
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {closable && (
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}

          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    width: '80%',
    maxWidth: 320,
    padding: 28,
    backgroundColor: 'white',
    borderRadius: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10, // للأندرويد
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  message: {
    marginTop: 18,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SubmittingModal;