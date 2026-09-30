/**
 * Normalizes Pakistani and international phone numbers to a canonical digit-only string
 * suitable for both WhatsApp `https://wa.me/{phoneNormalized}` links and Firestore
 * `phoneIndex/{phoneNormalized}` duplicate prevention.
 *
 * Examples:
 *  "03001234567"    -> "923001234567"
 *  "+923001234567"  -> "923001234567"
 *  "00923001234567" -> "923001234567"
 *  "3001234567"     -> "923001234567"
 *  "0300-1234567"   -> "923001234567"
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';

  // Strip spaces, dashes, parentheses, dots, and non-digit characters except leading '+'
  let cleaned = String(rawPhone).trim();

  // Remove all non-digits
  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';

  // Handle '00' international prefix (e.g., 00923001234567 -> 923001234567)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Handle Pakistani numbers starting with '03' (11 digits: 03XXXXXXXXX -> 923XXXXXXXXX)
  if (digits.length === 11 && digits.startsWith('03')) {
    return '92' + digits.slice(1);
  }

  // Handle Pakistani landline/mobile starting with '0' (10-11 digits)
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    return '92' + digits.slice(1);
  }

  // Handle 10-digit Pakistani mobile without leading 0 (3XXXXXXXXX -> 923XXXXXXXXX)
  if (digits.length === 10 && digits.startsWith('3')) {
    return '92' + digits;
  }

  // Handle 9203XXXXXXXXX mistake (where user typed +92 0300 1234567)
  if (digits.length === 13 && digits.startsWith('9203')) {
    return '92' + digits.slice(3);
  }

  return digits;
}

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  formatted: string;
  error?: string;
}

export function validateAndFormatPhone(rawPhone: string): PhoneValidationResult {
  const normalized = normalizePhoneNumber(rawPhone);

  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      formatted: '',
      error: 'Phone number is required.',
    };
  }

  // Pakistani mobile validation (starts with 923)
  if (normalized.startsWith('923')) {
    if (normalized.length !== 12) {
      return {
        valid: false,
        normalized,
        formatted: rawPhone,
        error: 'Pakistani mobile number must have 11 digits (e.g., 03001234567 or +923001234567).',
      };
    }
    const operator = normalized.slice(2, 5);
    const subscriber = normalized.slice(5);
    return {
      valid: true,
      normalized,
      formatted: `+92 ${operator} ${subscriber}`,
    };
  }

  // General international validation (8 to 15 digits per E.164)
  if (normalized.length < 9 || normalized.length > 15) {
    return {
      valid: false,
      normalized,
      formatted: rawPhone,
      error: 'Please enter a valid phone number (e.g., 03001234567 or +923001234567).',
    };
  }

  return {
    valid: true,
    normalized,
    formatted: `+${normalized}`,
  };
}
