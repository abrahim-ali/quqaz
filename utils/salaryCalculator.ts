// utils/salaryCalculator.ts

/**
 * ✅ حساب الراتب التراكمي حتى تاريخ الدفع (أو حتى الآن إذا لم يُدفع من قبل)
 * مع دعم:
 * - المكافآت (تُضاف إلى الصافي)
 * - تقسيط السلف حسب repayment_period و repayment_type
 * - إرجاع تفاصيل السلف لتمكين التحديث الجزئي
 */
export const calculateNetSalaryForEmployee = (
  employee: any,
  advances: any[],
  deductions: any[],
  absences: any[],
  rewards: any[],
  lastPaymentDate: string | null,
  currentDate: string = new Date().toISOString().split('T')[0] // تاريخ الحساب الفعلي
) => {
  const baseSalary = employee.salary > 0 ? employee.salary : 0;
  const employee_id = employee.id;

  // تحديد نقطة البداية: اليوم التالي لآخر دفعة
  const cutoffDate = lastPaymentDate
    ? new Date(new Date(lastPaymentDate).getTime() + 24 * 60 * 60 * 1000)
    : new Date(0);

  const now = new Date(currentDate);
  const cutoff = new Date(cutoffDate);

  // ✅ تتبع تفاصيل السلف (للاستخدام في التحديث الجزئي)
  const advanceDetails: {
    id: string;
    total_amount: number;
    current_paid: number;
    due_amount: number;
  }[] = [];

  let totalAdvanceInstallments = 0;

  for (const advance of advances) {
    if (
      advance.employee_id !== employee_id ||
      advance.status !== 'approved' ||
      new Date(advance.request_date) < cutoffDate
    ) {
      continue;
    }

    const totalAmount = advance.amount || 0;
    const paidSoFar = advance.paid_amount || 0;
    if (paidSoFar >= totalAmount) continue; // تم سدادها بالكامل

    const repaymentPeriod = advance.repayment_period || 1;
    const repaymentType = advance.repayment_type || 'monthly';
    const requestDate = new Date(advance.request_date);
    const amountPerPeriod = totalAmount / repaymentPeriod;

    // حساب عدد الفترات المنقضية حتى "الآن"
    let periodsElapsed = 0;
    if (repaymentType === 'monthly') {
      const monthsDiff =
        (now.getFullYear() - requestDate.getFullYear()) * 12 +
        (now.getMonth() - requestDate.getMonth());
      periodsElapsed = Math.min(monthsDiff + 1, repaymentPeriod);
    } else if (repaymentType === 'weekly') {
      const timeDiff = now.getTime() - requestDate.getTime();
      const weeksDiff = Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000));
      periodsElapsed = Math.min(weeksDiff + 1, repaymentPeriod);
    }

    // حساب عدد الفترات التي تم دفعها قبل cutoff (أي قبل هذه الدفعة)
    let paidPeriods = 0;
    if (repaymentType === 'monthly') {
      const monthsToCutoff =
        (cutoff.getFullYear() - requestDate.getFullYear()) * 12 +
        (cutoff.getMonth() - requestDate.getMonth());
      paidPeriods = Math.max(0, monthsToCutoff);
    } else if (repaymentType === 'weekly') {
      const timeToCutoff = cutoff.getTime() - requestDate.getTime();
      if (timeToCutoff > 0) {
        paidPeriods = Math.floor(timeToCutoff / (7 * 24 * 60 * 60 * 1000)) + 1;
      }
    }

    const duePeriods = Math.max(0, periodsElapsed - paidPeriods);
    const dueAmount = Math.min(duePeriods * amountPerPeriod, totalAmount - paidSoFar);

    if (dueAmount > 0) {
      advanceDetails.push({
        id: advance.id,
        total_amount: totalAmount,
        current_paid: paidSoFar,
        due_amount: dueAmount,
      });
      totalAdvanceInstallments += dueAmount;
    }
  }

  // الخصومات اليدوية غير المدفوعة
  const manualDeductions = deductions
    .filter((d: any) => d.employee_id === employee_id)
    .filter((d: any) => new Date(d.date) >= cutoffDate)
    .reduce((sum: number, d: any) => sum + d.amount, 0);

  // خصومات الغياب غير المدفوعة
  const absenceDeductions = absences
    .filter((a: any) => a.employee_id === employee_id)
    .filter((a: any) => new Date(a.date) >= cutoffDate)
    .reduce((sum: number, a: any) => sum + a.deduction_amount, 0);

  // المكافآت غير المدفوعة
  const totalRewards = rewards
    .filter((r: any) => r.employee_id === employee.id)
    .filter((r: any) => new Date(r.date) >= cutoffDate)
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  const totalDeductions = manualDeductions + absenceDeductions;
  const net_salary = Math.max(0, baseSalary - totalAdvanceInstallments - totalDeductions + totalRewards);

  return {
    net_salary,
    baseSalary,
    approvedAdvances: totalAdvanceInstallments,
    totalDeductions,
    totalRewards,
    advanceDetails, // ← مهم جدًا لتحديث السلف جزئيًا
  };
};