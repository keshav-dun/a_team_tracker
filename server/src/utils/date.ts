/**
 * Get today's date as YYYY-MM-DD string (UTC).
 */
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get date string N days from today.
 */
export const getFutureDateString = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Check if a date string is in the past (before today).
 */
export const isPastDate = (dateStr: string): boolean => {
  return dateStr < getTodayString();
};

/**
 * Check if a date is within the allowed planning window (today to today+90).
 */
export const isWithinPlanningWindow = (dateStr: string): boolean => {
  const today = getTodayString();
  const maxDate = getFutureDateString(90);
  return dateStr >= today && dateStr <= maxDate;
};

/**
 * Get first and last day of a month given YYYY-MM format.
 */
export const getMonthRange = (
  yearMonth: string
): { startDate: string; endDate: string } => {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};
