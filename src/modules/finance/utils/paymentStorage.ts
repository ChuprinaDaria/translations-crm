import { Payment } from '../api/transactions';

const STORAGE_KEY = 'finance_payments_customization';

export interface HiddenNote {
  id: string;
  text: string;
  created_by: string; // email або ім'я користувача
  created_at: string; // ISO date string
}

export interface PaymentCustomization {
  color?: string | null;
  hidden_notes?: HiddenNote[] | null; // Масив нотаток замість одного рядка
}

export interface PaymentCustomizations {
  [paymentId: string]: PaymentCustomization;
}

/**
 * Зберегти кастомізацію платежу (колір та приховані примітки)
 */
export function savePaymentCustomization(
  paymentId: string,
  customization: PaymentCustomization
): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const customizations: PaymentCustomizations = stored ? JSON.parse(stored) : {};
    
    customizations[paymentId] = {
      ...customizations[paymentId],
      ...customization,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
  } catch (error) {
    console.error('Failed to save payment customization:', error);
  }
}

/**
 * Отримати кастомізацію платежу
 */
export function getPaymentCustomization(
  paymentId: string
): PaymentCustomization | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const customizations: PaymentCustomizations = JSON.parse(stored);
    return customizations[paymentId] || null;
  } catch (error) {
    console.error('Failed to get payment customization:', error);
    return null;
  }
}

/**
 * Застосувати кастомізації до списку платежів
 */
export function applyCustomizationsToPayments(payments: Payment[]): Payment[] {
  return payments.map(payment => {
    const customization = getPaymentCustomization(payment.id);
    if (!customization) return payment;
    
    // Конвертуємо масив нотаток в рядок для сумісності з Payment interface
    const hiddenNotesString = customization.hidden_notes && customization.hidden_notes.length > 0
      ? customization.hidden_notes.map(n => n.text).join('\n\n---\n\n')
      : null;
    
    return {
      ...payment,
      color: customization.color || payment.color,
      hidden_notes: hiddenNotesString || payment.hidden_notes,
      hidden_notes_list: customization.hidden_notes || payment.hidden_notes_list || null,
    };
  });
}

/**
 * Отримати інформацію про поточного користувача з токену
 */
export function getCurrentUserInfo(): { email: string; name?: string } | null {
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) return null;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      email: payload.email || payload.sub || 'Unknown',
      name: payload.name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || payload.email,
    };
  } catch (error) {
    console.error('Failed to get user info from token:', error);
    return null;
  }
}

/**
 * Видалити кастомізацію платежу
 */
export function removePaymentCustomization(paymentId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    
    const customizations: PaymentCustomizations = JSON.parse(stored);
    delete customizations[paymentId];
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customizations));
  } catch (error) {
    console.error('Failed to remove payment customization:', error);
  }
}

