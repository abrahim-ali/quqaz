// utils/reportGenerator.ts
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as Sharing from 'expo-sharing';


export const generateDetailedReportPDF = async (
  title: string,
  reportData: Array<{
    employee_name: string;
    base_salary: number;
    total_advances: number;
    total_deductions: number;
    total_absences_amount: number;
    total_rewards: number;
    total_paid: number;
    net_balance: number;
  }>,
  periodLabel: string
) => {
  const totals = reportData.reduce(
    (acc, row) => {
      acc.base_salary += row.base_salary;
      acc.total_advances += row.total_advances;
      acc.total_deductions += row.total_deductions;
      acc.total_absences_amount += row.total_absences_amount;
      acc.total_rewards += row.total_rewards;
      acc.total_paid += row.total_paid;
      acc.net_balance += row.net_balance;
      return acc;
    },
    {
      base_salary: 0,
      total_advances: 0,
      total_deductions: 0,
      total_absences_amount: 0,
      total_rewards: 0,
      total_paid: 0,
      net_balance: 0,
    }
  );

  const rows = reportData
    .map(row => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">${row.employee_name}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">${row.base_salary.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; color: #e74c3c;">${row.total_advances.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; color: #3498db;">${row.total_deductions.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; color: #f39c12;">${row.total_absences_amount.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; color: #27ae60; font-weight: bold;">${row.total_rewards.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; color: #2ecc71;">${row.total_paid.toLocaleString('ar-EG')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold; ${
          row.net_balance >= 0 ? 'color: green;' : 'color: red;'
        }">${row.net_balance.toLocaleString('ar-EG')}</td>
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
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          th { 
            background-color: #3498db; 
            color: white; 
            padding: 12px; 
            font-weight: bold;
          }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #ecf0f1;
          }
          .total-row { 
            background-color: #f8f9fa; 
            font-weight: bold;
          }
          .total-label { 
            color: #2c3e50;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="period">الفترة: ${periodLabel}</div>
        <table>
          <thead>
            <tr>
              <th>الموظف</th>
              <th>الراتب الأساسي</th>
              <th>السلف</th>
              <th>الخصومات</th>
              <th>الغيابات</th>
              <th>المكافآت</th>
              <th>المدفوع</th>
              <th>الصافي</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td class="total-label">الإجمالي</td>
              <td>${totals.base_salary.toLocaleString('ar-EG')}</td>
              <td style="color: #e74c3c;">${totals.total_advances.toLocaleString('ar-EG')}</td>
              <td style="color: #3498db;">${totals.total_deductions.toLocaleString('ar-EG')}</td>
              <td style="color: #f39c12;">${totals.total_absences_amount.toLocaleString('ar-EG')}</td>
              <td style="color: #27ae60;">${totals.total_rewards.toLocaleString('ar-EG')}</td>
              <td style="color: #2ecc71;">${totals.total_paid.toLocaleString('ar-EG')}</td>
              <td style="${totals.net_balance >= 0 ? 'color: green;' : 'color: red;'} font-weight: bold;">
                ${totals.net_balance.toLocaleString('ar-EG')}
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error('PDF Error:', error);
    throw new Error('فشل إنشاء ملف PDF');
  }
};