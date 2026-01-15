/**
 * Utility functions for formatting timestamps
 */

import { formatDistanceToNow, format } from 'date-fns';
import { uk, pl, enUS, type Locale } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  pl,
  uk,
  en: enUS,
};

/**
 * Format timestamp to relative time (e.g., "5 хв тому")
 */
export function formatTimestamp(dateStr: string, locale: string = 'uk'): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв`;
    if (diffHours < 24) return `${diffHours} год`;
    if (diffDays < 7) return `${diffDays} дн`;
    
    const selectedLocale = localeMap[locale] || uk;
    return formatDistanceToNow(date, { addSuffix: true, locale: selectedLocale });
  } catch {
    return '';
  }
}

/**
 * Format timestamp to full date (e.g., "15 січня 2024, 14:30")
 */
export function formatFullDate(dateStr: string, locale: string = 'uk'): string {
  try {
    const date = new Date(dateStr);
    const selectedLocale = localeMap[locale] || uk;
    return format(date, "d MMMM yyyy, HH:mm", { locale: selectedLocale });
  } catch {
    return '';
  }
}

/**
 * Format timestamp to short date (e.g., "15.01.2024")
 */
export function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, 'dd.MM.yyyy');
  } catch {
    return '';
  }
}

/**
 * Format timestamp to time only (e.g., "14:30")
 */
export function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  } catch {
    return '';
  }
}

