// Валідація для форми анкети

export const validatePhone = (phone: string): boolean => {
  if (!phone) return false;
  // Перевірка формату +380XXXXXXXXX
  const phoneRegex = /^\+380\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const validateEmail = (email: string): boolean => {
  if (!email) return true; // Email опціональний
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const formatPhone = (value: string): string => {
  // Видаляємо все крім цифр
  const digits = value.replace(/\D/g, '');
  
  // Якщо починається не з 380, додаємо +380
  if (digits.length > 0 && !digits.startsWith('380')) {
    return '+380' + digits.slice(0, 9);
  }
  
  // Форматуємо +380XXXXXXXXX
  if (digits.startsWith('380')) {
    return '+' + digits.slice(0, 12);
  }
  
  return value;
};

// Смарт-дефолти для дати
export const getDefaultEventDate = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = неділя, 5 = п'ятниця, 6 = субота
  
  // Якщо сьогодні п'ятниця або субота, пропонуємо наступну п'ятницю
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + (5 - dayOfWeek + 7) % 7);
    return nextFriday.toISOString().split('T')[0];
  }
  
  // Інакше пропонуємо найближчу п'ятницю
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  return nextFriday.toISOString().split('T')[0];
};

// Автозаповнення часу кінця (+4 години від початку)
export const calculateEndTime = (startTime: string): string => {
  if (!startTime) return '';
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date();
  startDate.setHours(hours, minutes, 0);
  
  startDate.setHours(startDate.getHours() + 4);
  
  const endHours = startDate.getHours().toString().padStart(2, '0');
  const endMinutes = startDate.getMinutes().toString().padStart(2, '0');
  
  return `${endHours}:${endMinutes}`;
};

