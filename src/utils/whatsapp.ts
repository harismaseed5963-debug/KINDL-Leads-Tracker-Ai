import { normalizePhoneNumber } from './phone';

/**
 * Replaces `{name}` (case-insensitive) and `{first_name}` in a WhatsApp message template
 * with the lead's actual name.
 */
export function personalizeWhatsAppMessage(template: string, fullName: string): string {
  if (!template) return '';
  const cleanName = (fullName || 'there').trim();
  const firstName = cleanName.split(/\s+/)[0] || cleanName;

  return template
    .replace(/\{name\}/gi, cleanName)
    .replace(/\{full_name\}/gi, cleanName)
    .replace(/\{first_name\}/gi, firstName);
}

/**
 * Builds the official manual WhatsApp `https://wa.me/{phone}` URL with pre-filled personalized text.
 */
export function buildWhatsAppUrl(phoneOrNormalized: string, templateMessage: string, fullName: string): string {
  const phone = normalizePhoneNumber(phoneOrNormalized);
  if (!phone) return '';
  const personalized = personalizeWhatsAppMessage(templateMessage, fullName).trim();

  if (!personalized) {
    return `https://wa.me/${phone}`;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(personalized)}`;
}
