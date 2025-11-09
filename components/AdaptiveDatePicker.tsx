// components/AdaptiveDatePicker.tsx
import { Platform, View, TouchableOpacity, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, useEffect } from 'react';
import Colors from '@/constants/colors';

interface AdaptiveDatePickerProps {
  value: string; // بصيغة YYYY-MM-DD
  onChange: (date: string) => void;
  placeholder?: string;
  style?: any;
}

export default function AdaptiveDatePicker({
  value,
  onChange,
  placeholder = 'اختر التاريخ',
  style,
}: AdaptiveDatePickerProps) {
  const [show, setShow] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>('');

  // تنسيق العرض بالعربية (ميلادي)
  useEffect(() => {
    if (value) {
      try {
        const formatted = new Date(value).toLocaleDateString('ar-EG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        setDisplayValue(formatted);
      } catch {
        setDisplayValue(value);
      }
    } else {
      setDisplayValue('');
    }
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...style,
          fontFamily: 'system-ui',
          padding: 12,
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 8,
          backgroundColor: Colors.background,
          color: value ? Colors.text : Colors.textLight,
          direction: 'ltr', // مهم لـ input date
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        style={style}
        onPress={() => setShow(true)}
      >
        <Text style={{ color: value ? Colors.text : Colors.textLight }}>
          {displayValue || placeholder}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShow(false);
            if (selectedDate) {
              const formatted = selectedDate.toISOString().split('T')[0];
              onChange(formatted);
            }
          }}
          locale="en-US"
        />
      )}
    </>
  );
}