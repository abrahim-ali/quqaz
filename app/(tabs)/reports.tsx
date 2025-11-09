// screens/ReportsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { generateDetailedReportPDF } from '@/utils/reportGenerator';
import Colors from '@/constants/colors';
import { Stack } from 'expo-router';

const ReportsScreen = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<{ id: string; name: string }[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // ← جديد: حالة نموذج المكافأة
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [rewardAmount, setRewardAmount] = useState('');
  const [rewardReason, setRewardReason] = useState('مكافأة أداء');

  // ← تبويبات الفروع
  const [activeTab, setActiveTab] = useState<'all' | 'byBranch'>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setRefreshing(isRefreshing);
    try {
      const [
        empRes,
        branchRes,
        advRes,
        dedRes,
        absRes,
        rewRes,
        payRes,
      ] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('branches').select('id, name'),
        supabase.from('advance_requests').select('*'),
        supabase.from('deductions').select('*'),
        supabase.from('absences').select('*'),
        supabase.from('rewards').select('*'),
        supabase.from('salary_payments').select('*'),
      ]);

      if (empRes.error) throw empRes.error;
      if (branchRes.error) throw branchRes.error;

      const empData = empRes.data || [];
      const branchData = branchRes.data || [];

      // بناء خريطة لأسماء الفروع
      const branchMap: Record<string, string> = {};
      branchData.forEach((b: any) => {
        branchMap[b.id] = b.name || `فرع ${b.id}`;
      });
      setBranchNames(branchMap);
      setBranchesList(branchData.map((b: any) => ({ id: b.id, name: b.name || `فرع ${b.id}` })));

      setEmployees(empData);
      setAdvances(advRes.data || []);
      setDeductions(dedRes.data || []);
      setAbsences(absRes.data || []);
      setRewards(rewRes.data || []);
      setPayments(payRes.data || []);
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

  const isDateInRange = (dateString: string | null): boolean => {
    if (!dateString) return false;
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const startDate = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
    const endDate = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate());
    return date >= startDate && date <= endDate;
  };

  // تحديد الموظفين المعروضين حسب التبويب
  const displayedEmployees = activeTab === 'all'
    ? employees
    : employees.filter(emp => emp.branch_id === selectedBranchId);

  const reportData = displayedEmployees.map(emp => {
    const empAdvances = advances
      .filter(a => a.employee_id === emp.id && a.status === 'approved' && isDateInRange(a.request_date))
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const empDeductions = deductions
      .filter(d => d.employee_id === emp.id && isDateInRange(d.date))
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    const empAbsences = absences
      .filter(a => a.employee_id === emp.id && isDateInRange(a.date))
      .reduce((sum, a) => sum + (a.deduction_amount || 0), 0);

    const empRewards = rewards
      .filter(r => r.employee_id === emp.id && isDateInRange(r.date))
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const empPayments = payments
      .filter(p => p.employee_id === emp.id && isDateInRange(p.payment_date))
      .reduce((sum, p) => sum + (p.net_salary || 0), 0);

    const baseSalary = emp.salary || 0;
    const totalDeductions = empDeductions + empAbsences;
    const netBalance = baseSalary - empAdvances - totalDeductions + empRewards;

    return {
      employee_name: emp.name || 'غير معروف',
      base_salary: baseSalary,
      total_advances: empAdvances,
      total_deductions: empDeductions,
      total_absences_amount: empAbsences,
      total_rewards: empRewards,
      total_paid: empPayments,
      net_balance: netBalance,
    };
  });

  const setPeriod = (type: 'monthly' | 'yearly') => {
    const now = new Date();
    let start, end;
    if (type === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }
    setDateRange({ start, end });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ar-EG');
  };

  const handleExport = async () => {
    if (displayedEmployees.length === 0) {
      Alert.alert('تنبيه', 'لا يوجد موظفين للتصدير');
      return;
    }
    const periodLabel = `من ${formatDate(dateRange.start)} إلى ${formatDate(dateRange.end)}`;
    try {
      await generateDetailedReportPDF('تقرير مفصل للرواتب', reportData, periodLabel);
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل التصدير');
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

  const totalNet = reportData.reduce((sum, r) => sum + r.net_balance, 0);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'التقارير',
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
        <View style={{ padding: 16 }}>

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

          

          {/* اختيار تاريخ */}
          <View style={{ marginBottom: 20, backgroundColor: 'white', padding: 10, borderRadius: 10,borderColor: '#e74c3c', borderWidth: 1, }}>
            {/* أزرار الفترات */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <TouchableOpacity onPress={() => setPeriod('monthly')} style={styles.periodButton}>
                <Text style={styles.periodButtonText}>هذا الشهر</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPeriod('yearly')} style={[styles.periodButton, { backgroundColor: '#2ecc71' }]}>
                <Text style={styles.periodButtonText}>هذا العام</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>الفترة:</Text>
            </View>
            
            <Text style={{ textAlign: 'center', color: '#e74c3c' }}>
              من {formatDate(dateRange.start)} إلى {formatDate(dateRange.end)}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.dateButton}>
                <Text style={styles.dateButtonText}>تغيير النهاية</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.dateButton}>
                <Text style={styles.dateButtonText}>تغيير البداية</Text>
              </TouchableOpacity>
            </View>
          </View>

          {displayedEmployees.length === 0 ? (
            <View style={{ backgroundColor: 'white', padding: 30, borderRadius: 10, alignItems: 'center' }}>
              <Text style={{ color: '#7f8c8d' }}>لا يوجد موظفين</Text>
            </View>
          ) : (
            <>
              {/* الجدول مع تمرير أفقي */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 20 }}>
                <View style={{ backgroundColor: 'white', borderRadius: 10, overflow: 'hidden', minWidth: 950 }}>
                  <View style={styles.tableHeader}>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الموظف</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الأساسي</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>السلف</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الخصومات</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الغيابات</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>المكافآت</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>المدفوع</Text></View>
                    <View style={styles.tableHeaderCell}><Text style={styles.tableHeaderText}>الصافي</Text></View>
                  </View>

                  {reportData.map((row, index) => (
                    <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#fafafa' : 'white' }]}>
                      <View style={styles.tableCell}><Text style={styles.tableText}>{row.employee_name}</Text></View>
                      <View style={styles.tableCell}><Text style={styles.tableText}>{row.base_salary.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}><Text style={[styles.tableText, { color: '#e74c3c' }]}>{row.total_advances.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}><Text style={[styles.tableText, { color: '#3498db' }]}>{row.total_deductions.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}><Text style={[styles.tableText, { color: '#f39c12' }]}>{row.total_absences_amount.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}><Text style={[styles.tableText, { color: '#27ae60', fontWeight: 'bold' }]}>{row.total_rewards.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}><Text style={[styles.tableText, { color: '#2ecc71' }]}>{row.total_paid.toLocaleString('ar-EG')}</Text></View>
                      <View style={styles.tableCell}>
                        <Text style={[
                          styles.tableText,
                          { fontWeight: 'bold', color: row.net_balance >= 0 ? 'green' : 'red' }
                        ]}>
                          {row.net_balance.toLocaleString('ar-EG')}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={[styles.tableRow, { backgroundColor: '#f1f8ff', borderTopWidth: 2, borderTopColor: '#3498db' }]}>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#2c3e50' }]}>الإجمالي</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold' }]}>{reportData.reduce((sum, r) => sum + r.base_salary, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#e74c3c' }]}>{reportData.reduce((sum, r) => sum + r.total_advances, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#3498db' }]}>{reportData.reduce((sum, r) => sum + r.total_deductions, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#f39c12' }]}>{reportData.reduce((sum, r) => sum + r.total_absences_amount, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#27ae60' }]}>{reportData.reduce((sum, r) => sum + r.total_rewards, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}><Text style={[styles.tableText, { fontWeight: 'bold', color: '#2ecc71' }]}>{reportData.reduce((sum, r) => sum + r.total_paid, 0).toLocaleString('ar-EG')}</Text></View>
                    <View style={styles.tableCell}>
                      <Text style={[
                        styles.tableText,
                        { fontWeight: 'bold', color: totalNet >= 0 ? 'green' : 'red' }
                      ]}>
                        {totalNet.toLocaleString('ar-EG')}
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
                <Text style={styles.exportButtonText}>تصدير كـ PDF</Text>
              </TouchableOpacity>
            </>
          )}

          {/* منتقيات التاريخ */}
          {showStartPicker && (
            <DateTimePicker
              value={dateRange.start}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowStartPicker(false);
                if (selectedDate) setDateRange(prev => ({ ...prev, start: selectedDate }));
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={dateRange.end}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowEndPicker(false);
                if (selectedDate) setDateRange(prev => ({ ...prev, end: selectedDate }));
              }}
            />
          )}

        
        </View>
      </ScrollView>
    </View>
  );
};

// الأنماط
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  periodButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#3498db',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  periodButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  dateButton: {
    padding: 8,
    backgroundColor: '#3498db',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  dateButtonText: {
    color: 'white',
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
    width: 120,
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
    width: 120,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableText: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // لا حاجة لـ justifyContent أو gap هنا لأن ScrollView يتحكم في التخطيط
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderColor: '#240088ff',
    borderWidth: 1,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 20,
    marginRight: 8, // بدل استخدام gap
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
});

export default ReportsScreen;