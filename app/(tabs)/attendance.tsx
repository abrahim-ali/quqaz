import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Stack } from 'expo-router';

// ✅ دالة للحصول على تاريخ محلي بصيغة YYYY-MM-DD
const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // شهر يبدأ من 0
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// إنشاء أيام الشهر الحالي
const getDaysInMonth = (year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // الأحد = 0

  const days = [];

  // الأيام البيضاء قبل بداية الشهر
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }

  // أيام الشهر
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      dayNumber: day,
      iso: getLocalISODate(date), // ← محلي، ليس UTC
      jsDate: date,
      dayName: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][date.getDay()],
    });
  }

  return days;
};

const AttendanceGrid3Columns = () => {
  const [days, setDays] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});
  const { user } = useAuth();

  const today = new Date();
  const todayISO = getLocalISODate(today); // ← محلي
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const employeeId = user?.id;

  const loadAttendance = useCallback(async (showLoading = true) => {
    const monthDays = getDaysInMonth(currentYear, currentMonth);
    setDays(monthDays);

    if (showLoading) setLoading(true);
    setRefreshing(true);

    try {
      if (!employeeId) {
        setAttendanceMap({});
        return;
      }

      const validDates = monthDays
        .filter((d) => d !== null)
        .map((d) => d.iso);

      // ✅ تصفية حسب الموظف
      const { data, error } = await supabase
        .from('attendance')
        .select('date, status, check_in, check_out')
        .eq('employee_id', employeeId)
        .in('date', validDates);

      if (error && error.code !== 'PGRST116') {
        console.error('Fetch error:', error);
        Alert.alert('خطأ', 'فشل تحميل سجل الحضور');
        return;
      }

      const map: Record<string, any> = {};
      data?.forEach((rec: any) => {
        map[rec.date] = rec;
      });
      setAttendanceMap(map);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, currentYear, currentMonth]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const onRefresh = () => {
    loadAttendance(false);
  };

  const handleAttendanceAction = async (dateIso: string, type: 'check_in' | 'check_out') => {
    if (!employeeId || dateIso !== todayISO) return;

    setProcessing((prev) => ({ ...prev, [dateIso]: true }));

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !enrolled) {
        Alert.alert('غير مدعوم', 'الجهاز لا يدعم البصمة.');
        setProcessing((prev) => ({ ...prev, [dateIso]: false }));
        return;
      }

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `ضع بصمتك لتسجيل ${type === 'check_in' ? 'الحضور' : 'الانصراف'}`,
      });

      if (authResult.success) {
        const now = new Date().toISOString(); // وقت التسجيل (يُخزن كـ timestamp)
        const updateData: any = { status: 'present' };
        if (type === 'check_in') updateData.check_in = now;
        else updateData.check_out = now;

        const { error } = await supabase
          .from('attendance')
          .upsert(
            {
              employee_id: employeeId,
              date: dateIso, // ← تاريخ محلي YYYY-MM-DD
              ...updateData,
            },
            { onConflict: 'employee_id,date' }
          );

        if (error) {
          console.error('Upsert error:', error);
          Alert.alert('خطأ', `فشل تسجيل ${type === 'check_in' ? 'الحضور' : 'الانصراف'}`);
        } else {
          setAttendanceMap((prev) => ({
            ...prev,
            [dateIso]: {
              ...prev[dateIso],
              ...updateData,
              date: dateIso,
            },
          }));
        }
      }
    } catch (err) {
      console.error('Biometric error:', err);
      Alert.alert('خطأ', 'حدث خطأ أثناء استخدام البصمة');
    } finally {
      setProcessing((prev) => ({ ...prev, [dateIso]: false }));
    }
  };

  const isPastDay = (jsDate: Date) => {
    const d = new Date(jsDate);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d < now;
  };

  const isFutureDay = (jsDate: Date) => {
    const d = new Date(jsDate);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d > now;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'حاضر';
      case 'absent': return 'غائب';
      case 'late': return 'متأخر';
      case 'vacation': return 'عطلة';
      case 'on_leave': return 'إجازة';
      default: return '—';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#2e7d32';
      case 'absent': return '#d32f2f';
      case 'vacation': return '#00612cff';
      case 'late': return '#f57f17';
      case 'on_leave': return '#0288d1';
      default: return '#999';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e88e5" />
        <Text style={{ marginTop: 10, textAlign: 'center' }}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'تسجيل الحضور',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        <Text style={styles.title}>
          {new Date(currentYear, currentMonth).toLocaleDateString('ar-EG', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <View style={styles.grid}>
          {days.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.cell} />;
            }

            const { iso, dayNumber, jsDate, dayName } = day;
            const record = attendanceMap[iso] || { status: '', check_in: null, check_out: null };
            const isToday = iso === todayISO;
            const isPast = isPastDay(jsDate);
            const hasCheckIn = !!record.check_in;
            const hasCheckOut = !!record.check_out;

            let bgColor = '#f9f9f9';
            if (isToday) bgColor = '#e3f2fd';
            else if (record.status === 'present') bgColor = '#e8f5e8';
            else if (record.status === 'absent') bgColor = '#ffeaea';

            return (
              <View key={iso} style={[styles.cell, { backgroundColor: bgColor }]}>
                <View style={styles.header}>
                  <Text style={styles.dayNumber}>{dayNumber}</Text>
                  <Text style={styles.dayName}>{dayName}</Text>
                </View>

                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(record.status) },
                  ]}
                >
                  {getStatusLabel(record.status)}
                </Text>

                <View style={styles.timeRow}>
                  <Text style={styles.timeValue}>
                    {record.check_in
                      ? new Date(record.check_in).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                  <Text style={styles.timeLabel}>يبدأ:</Text>
                </View>

                <View style={styles.timeRow}>
                  <Text style={styles.timeValue}>
                    {record.check_out
                      ? new Date(record.check_out).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                  <Text style={styles.timeLabel}>انصراف:</Text>
                </View>

                {/* أزرار التسجيل - فقط لليوم الحالي */}
                {isToday && (
                  <View style={styles.buttonContainer}>
                    {!hasCheckIn ? (
                      <TouchableOpacity
                        style={[styles.button, styles.checkInButton]}
                        onPress={() => handleAttendanceAction(iso, 'check_in')}
                        disabled={processing[iso]}
                      >
                        {processing[iso] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.buttonText}>تسجيل الحضور</Text>
                        )}
                      </TouchableOpacity>
                    ) : !hasCheckOut ? (
                      <TouchableOpacity
                        style={[styles.button, styles.checkOutButton]}
                        onPress={() => handleAttendanceAction(iso, 'check_out')}
                        disabled={processing[iso]}
                      >
                        {processing[iso] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.buttonText}>تسجيل الانصراف</Text>
                        )}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {isPast && !isToday && <View style={styles.overlay} />}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    width: '31%',
    minHeight: 160,
    marginBottom: 16,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  dayName: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 2,
  },
  timeLabel: {
    fontSize: 12,
    color: '#777',
  },
  timeValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonContainer: {
    marginTop: 6,
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInButton: {
    backgroundColor: '#4CAF50',
  },
  checkOutButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
  },
});

export default AttendanceGrid3Columns;