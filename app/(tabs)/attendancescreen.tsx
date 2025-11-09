// screens/AttendanceScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import Colors from '@/constants/colors';
import { Stack, useRouter } from 'expo-router';

const AttendanceScreen = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // تبويبات الفروع
  const [activeTab, setActiveTab] = useState<'all' | 'byBranch'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setRefreshing(isRefreshing);
    try {
      const [
        empRes,
        branchRes,
        attRes,
      ] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('branches').select('id, name'),
        supabase.from('attendance').select('*'),
      ]);

      if (empRes.error) throw empRes.error;
      if (branchRes.error) throw branchRes.error;

      const empData = empRes.data || [];
      const branchData = branchRes.data || [];
      const attData = attRes.data || [];

      setBranchesList(branchData.map((b: any) => ({ id: b.id, name: b.name || `فرع ${b.id}` })));
      setEmployees(empData);
      setAttendanceRecords(attData);
    } catch (error: any) {
      console.error('Load error:', error);
      Alert.alert('خطأ', error.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-EG');
  };

  const getDateString = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // عرض جميع سجلات الحضور في اليوم المحدد
  const attendanceData = attendanceRecords
    .filter(att => {
      if (att.date !== getDateString(selectedDate)) return false;
      const emp = employees.find(e => e.id === att.employee_id);
      if (!emp) return false;
      const inBranch = activeTab === 'all' || emp.branch_id === selectedBranchId;
      return inBranch;
    })
    .map(att => {
      const emp = employees.find(e => e.id === att.employee_id)!;
      return {
        employee_id: att.employee_id,
        employee_name: emp.name || 'غير معروف',
        branch_name: emp.branch_id
          ? branchesList.find(b => b.id === emp.branch_id)?.name || 'بدون فرع'
          : 'بدون فرع',
        position: emp.position || 'غير محدد',
        status: att.status || '—',
        check_in: att.check_in || null,
        check_out: att.check_out || null,
        date: att.date,
      };
    })
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  // الموظفون الذين لم يُسجَّل لهم حضور في هذا اليوم (لإظهارهم كـ "غائب")
  const absentEmployees = employees
    .filter(emp => {
      const inBranch = activeTab === 'all' || emp.branch_id === selectedBranchId;
      const hasRecord = attendanceRecords.some(
        att => att.employee_id === emp.id && att.date === getDateString(selectedDate)
      );
      return inBranch && !hasRecord;
    })
    .map(emp => ({
      employee_id: emp.id,
      employee_name: emp.name || 'غير معروف',
      branch_name: emp.branch_id
        ? branchesList.find(b => b.id === emp.branch_id)?.name || 'بدون فرع'
        : 'بدون فرع',
      position: emp.position || 'غير محدد',
      status: '—',
      check_in: null,
      check_out: null,
      date: getDateString(selectedDate),
    }))
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  // دمج الحاضرين + الغائبين
  const fullAttendanceData = [...attendanceData, ...absentEmployees];

  const handleCheckIn = async (employeeId: string, employeeName: string) => {
    const today = getDateString(selectedDate);
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            employee_id: employeeId,
            date: today,
            check_in: now,
            status: 'present',
          },
          { onConflict: 'employee_id,date' }
        );

      if (error) throw error;
      Alert.alert('تم', `تم تسجيل حضور ${employeeName}`);
      loadData();
    } catch (err: any) {
      console.error('Check-in error:', err);
      Alert.alert('خطأ', 'فشل تسجيل الحضور');
    }
  };

  const handleCheckOut = async (employeeId: string, employeeName: string) => {
    const today = getDateString(selectedDate);
    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            employee_id: employeeId,
            date: today,
            check_out: now,
            status: 'present',
          },
          { onConflict: 'employee_id,date' }
        );

      if (error) throw error;
      Alert.alert('تم', `تم تسجيل انصراف ${employeeName}`);
      loadData();
    } catch (err: any) {
      console.error('Check-out error:', err);
      Alert.alert('خطأ', 'فشل تسجيل الانصراف');
    }
  };

  const handleExportPDF = async () => {
    if (fullAttendanceData.length === 0) {
      Alert.alert('تنبيه', 'لا توجد بيانات للتصدير');
      return;
    }

    const periodLabel = `في تاريخ: ${formatDate(selectedDate)}`;
    const rows = fullAttendanceData
      .map(row => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">${row.employee_name}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${row.branch_name}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${row.position}</td>
          <td style="border: 1px solid #ddd; padding: 10px; ${
            row.status === 'present' ? 'color: green;' :
            row.status === 'absent' ? 'color: red;' :
            row.status === 'late' ? 'color: orange;' : 'color: #3498db;'
          }">${getStatusLabel(row.status)}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${row.check_in ? new Date(row.check_in).toLocaleTimeString('ar-EG') : '—'}</td>
          <td style="border: 1px solid #ddd; padding: 10px;">${row.check_out ? new Date(row.check_out).toLocaleTimeString('ar-EG') : '—'}</td>
        </tr>
      `)
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              direction: rtl; 
              text-align: right; 
              margin: 20px;
              background-color: #f9f9f9;
            }
            h1 { 
              color: #2c3e50; 
              text-align: center; 
              margin-bottom: 20px; 
              font-size: 24px;
            }
            .period { 
              text-align: center; 
              margin-bottom: 20px; 
              color: #7f8c8d; 
              font-size: 16px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            }
            th { 
              background-color: #3498db; 
              color: white; 
              padding: 14px; 
              font-weight: bold;
              font-size: 15px;
            }
            td { 
              padding: 12px; 
              border-bottom: 1px solid #ecf0f1;
              font-size: 14px;
            }
            tr:last-child td { border-bottom: none; }
          </style>
        </head>
        <body>
          <h1>تقرير الحضور والانصراف</h1>
          <div class="period">${periodLabel}</div>
          <table>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>الفرع</th>
                <th>المسمى الوظيفي</th>
                <th>الحالة</th>
                <th>وقت الحضور</th>
                <th>وقت الانصراف</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'تصدير تقرير الحضور',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('PDF Error:', error);
      Alert.alert('خطأ', 'فشل إنشاء ملف PDF');
    }
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

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={{ marginTop: 10 }}>جارٍ التحميل...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'الحضور',
          headerShown: true,
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
        <ScrollView
        style={{ flex: 1, backgroundColor: '#f8f9fa' }}
        refreshControl={
            <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={['#3498db']}
            tintColor="#3498db"
            />
        }
        >
        <View style={{ padding: 10 }}>
            
            {/* اختيار التاريخ */}
            <View style={{ marginBottom: 20, backgroundColor: 'white', padding: 16, borderRadius: 10 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>تاريخ الحضور:</Text>
            <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                backgroundColor: '#3498db',
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                }}
            >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                {formatDate(selectedDate)}
                </Text>
            </TouchableOpacity>
            </View>

            {/* تبويبات الفروع */}
            <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabContainer}
            style={{ marginBottom: 16 }}
            >
            <TouchableOpacity
                style={[styles.tabButton, activeTab === 'all' && styles.activeTab]}
                onPress={() => {
                setActiveTab('all');
                setSelectedBranchId(null);
                }}
            >
                <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                الجميع
                </Text>
            </TouchableOpacity>

            {branchesList.map(branch => (
                <TouchableOpacity
                key={branch.id}
                style={[
                    styles.tabButton,
                    activeTab === 'byBranch' && selectedBranchId === branch.id && styles.activeTab,
                ]}
                onPress={() => {
                    setActiveTab('byBranch');
                    setSelectedBranchId(branch.id);
                }}
                >
                <Text
                    style={[
                    styles.tabText,
                    activeTab === 'byBranch' && selectedBranchId === branch.id && styles.activeTabText,
                    ]}
                >
                    {branch.name}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>

            {/* الجدول */}
            {fullAttendanceData.length === 0 ? (
            <View style={{ backgroundColor: 'white', padding: 30, borderRadius: 10, alignItems: 'center' }}>
                <Text style={{ color: '#7f8c8d' }}>لا توجد بيانات حضور لهذا اليوم</Text>
            </View>
            ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', minWidth: 850 }}>
                <View style={styles.tableHeader}>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الموظف</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الفرع</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>المسمى</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الحالة</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الحضور</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الانصراف</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>إجراءات</Text></View>
                </View>

                {fullAttendanceData.map((row, index) => (
                    <View key={`${row.employee_id}-${row.date}`} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#fafafa' : 'white' }]}>
                    <View style={styles.tableCell}><Text style={styles.tableText}>{row.employee_name}</Text></View>
                    <View style={styles.tableCell}><Text style={styles.tableText}>{row.branch_name}</Text></View>
                    <View style={styles.tableCell}><Text style={styles.tableText}>{row.position}</Text></View>
                    <View style={styles.tableCell}>
                        <Text style={[
                        styles.tableText,
                        {
                            color:
                            row.status === 'present' ? 'green' :
                            row.status === 'absent' ? 'red' :
                            row.status === 'late' ? 'orange' : '#3498db'
                        }
                        ]}>
                        {getStatusLabel(row.status)}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.tableText}>
                        {row.check_in ? new Date(row.check_in).toLocaleTimeString('ar-EG') : '—'}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.tableText}>
                        {row.check_out ? new Date(row.check_out).toLocaleTimeString('ar-EG') : '—'}
                        </Text>
                    </View>
                    <View style={styles.tableCell}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                        {(row.status === '—' || row.status === 'absent') && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: '#27ae60' }]}
                                onPress={() => handleCheckIn(row.employee_id, row.employee_name)}
                            >
                                <Text style={styles.actionButtonText}>حضور</Text>
                            </TouchableOpacity>
                            )}

                        {row.status === 'present' && !row.check_out && (
                            <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
                            onPress={() => handleCheckOut(row.employee_id, row.employee_name)}
                            >
                            <Text style={styles.actionButtonText}>انصراف</Text>
                            </TouchableOpacity>
                        )}
                        </View>
                    </View>
                    </View>
                ))}
                </View>
            </ScrollView>
            )}

            <TouchableOpacity onPress={handleExportPDF} style={styles.exportButton}>
            <Text style={styles.exportButtonText}>تصدير كـ PDF</Text>
            </TouchableOpacity>

            {/* منتقي التاريخ */}
            {showDatePicker && (
            <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setSelectedDate(date);
                }}
            />
            )}
        </View>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 20,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: '#3498db',
  },
  tabText: {
    color: '#2c3e50',
    fontWeight: '500',
    fontSize: 14,
  },
  activeTabText: {
    color: 'white',
    fontWeight: 'bold',
  },
  exportButton: {
    padding: 16,
    backgroundColor: '#9b59b6',
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3498db',
  },
  tableHeaderCell: {
    width: 140,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  tableHeaderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    width: 140,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default AttendanceScreen;