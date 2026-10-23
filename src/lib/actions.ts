import { Lead } from './types';
import { formatBudgetRange } from './format';

/**
 * Formats an Indian or international phone number into digits only for wa.me links.
 * If 10 digits are entered (e.g. 9845011223), automatically prefixes '91' for India.
 */
export function normalizePhoneForWhatsApp(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Generates a universal https://wa.me/<phone>?text=<encoded_message> URL.
 * Works with or without a phone number (if no phone, opens WhatsApp contact selector).
 */
export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message.trim());
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

function toCalendarUtcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export interface SiteVisitDetails {
  lead: Lead;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  durationMinutes?: number;
  meetingPoint?: string;
}

/**
 * Builds a Google Calendar event creation template link (no OAuth required).
 */
export function buildGoogleCalendarUrl({
  lead,
  dateStr,
  timeStr,
  durationMinutes = 60,
  meetingPoint,
}: SiteVisitDetails): string {
  const start = new Date(`${dateStr}T${timeStr}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const title = `Site Visit: ${lead.name} (${lead.property_requirement || lead.location})`;
  const location = meetingPoint?.trim() || lead.location;
  const budgetFormatted = formatBudgetRange(
    lead.budget_min_inr,
    lead.budget_max_inr,
    lead.budget_text
  );

  const descriptionLines = [
    `Customer: ${lead.name}`,
    lead.phone ? `Phone: ${lead.phone}` : '',
    `Location: ${lead.location}`,
    `Requirement: ${lead.property_requirement || 'Not specified'}`,
    `Budget: ${budgetFormatted}`,
    lead.analysis?.summary ? `\nLead Summary:\n${lead.analysis.summary}` : '',
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toCalendarUtcTimestamp(start)}/${toCalendarUtcTimestamp(end)}`,
    location,
    details: descriptionLines.join('\n'),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates and triggers a browser download of a standard .ics calendar file.
 */
export function downloadSiteVisitIcs({
  lead,
  dateStr,
  timeStr,
  durationMinutes = 60,
  meetingPoint,
}: SiteVisitDetails): void {
  const start = new Date(`${dateStr}T${timeStr}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const nowStamp = toCalendarUtcTimestamp(new Date());

  const title = `Site Visit: ${lead.name} (${lead.property_requirement || lead.location})`;
  const location = (meetingPoint?.trim() || lead.location).replace(/,/g, '\\,');
  const budgetFormatted = formatBudgetRange(
    lead.budget_min_inr,
    lead.budget_max_inr,
    lead.budget_text
  );

  const description = [
    `Customer: ${lead.name}`,
    lead.phone ? `Phone: ${lead.phone}` : '',
    `Requirement: ${lead.property_requirement || 'Not specified'}`,
    `Budget: ${budgetFormatted}`,
    lead.analysis?.summary ? `Summary: ${lead.analysis.summary}` : '',
  ]
    .filter(Boolean)
    .join('\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeadLens//Site Visit Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:leadlens-visit-${lead.id}-${Date.now()}@leadlens.app`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${toCalendarUtcTimestamp(start)}`,
    `DTEND:${toCalendarUtcTimestamp(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = lead.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.href = url;
  a.download = `site-visit-${safeName}-${dateStr}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates a ready-to-send confirmation message for the scheduled site visit.
 */
export function buildSiteVisitConfirmationMessage({
  lead,
  dateStr,
  timeStr,
  meetingPoint,
}: SiteVisitDetails): string {
  const start = new Date(`${dateStr}T${timeStr}:00`);
  const formattedDate = start.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const formattedTime = start.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const place = meetingPoint?.trim() || lead.location;
  const reqText = lead.property_requirement ? ` (${lead.property_requirement})` : '';

  return `Hi ${lead.name}, confirming your site visit for ${place}${reqText} on ${formattedDate} at ${formattedTime}. I will share the exact location pin and brochure before we meet. Please let me know if you need any changes!`;
}