// whatsappService.ts

const WA_API_URL = 'https://graph.facebook.com/v24.0/768304483043281/messages';
const WA_ACCESS_TOKEN = process.env.EXPO_PUBLIC_WA_ACCESS_TOKEN;

if (!WA_ACCESS_TOKEN) {
  throw new Error(
    'Missing EXPO_PUBLIC_WA_ACCESS_TOKEN in .env file'
  );
}

const normalizeYemeniPhone = (phone: string): string => {
  // إزالة كل ما ليس رقمًا
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('964')) {
    if (cleaned.length === 12) return cleaned;
  }

  if (!cleaned.startsWith('964')) {
    // تأكد أنه 9 أرقام (أو على الأقل رقم معقول)
    if (cleaned.length >= 10) {
      cleaned = '964' + cleaned.slice(-10);
    } else {
      throw new Error('رقم الهاتف غير صالح: يجب أن يكون 10 أرقام على الأقل');
    }
  }

  // التحقق من الطول النهائي (يجب أن يكون 13 رقمًا: 964 + 9)
  if (cleaned.length !== 13 || !cleaned.startsWith('964')) {
    throw new Error('رقم الهاتف غير صالح بعد التنقية');
  }

  return cleaned;
};

export interface WhatsAppTemplateParams {
  parameters: string[];
  to: string; // الآن إلزامي (بدون افتراضي)
  templateName?: string;
}

/**
 * إرسال رسالة واتساب باستخدام قالب مع تنقية رقم الهاتف تلقائيًا
 */
export const sendWhatsAppTemplateMessage = async (
  params: WhatsAppTemplateParams
): Promise<any> => {
  const { parameters, to, templateName = 'confirmation2' } = params;

  // تنقية رقم الهاتف
  const normalizedPhone = normalizeYemeniPhone(to);

  if (!Array.isArray(parameters) || parameters.some(p => typeof p !== 'string')) {
    throw new Error('يجب أن تكون "parameters" مصفوفة من النصوص');
  }

  const bodyParameters = parameters.map(text => ({ type: 'text' as const, text }));

  const payload = {
    messaging_product: 'whatsapp' as const,
    to: normalizedPhone,
    type: 'template' as const,
    template: {
      name: templateName,
      language: { code: 'ar' as const },
      components: [
        {
          type: 'body' as const,
          parameters: bodyParameters
        }
      ]
    }
  };

  const response = await fetch(WA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('خطأ من WhatsApp API:', result);
    throw new Error(result?.error?.message || 'فشل في إرسال الرسالة');
  }

  return result;
};