import { parseISO, format, addMonths, subMonths, setDate, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

/**
 * Returns the cycle month and year for a given date.
 * If day <= 25, it's the current month's cycle.
 * If day >= 26, it's the next month's cycle.
 */
export function getCycleMonth(date: Date): { month: number; year: number } {
  const day = date.getDate();
  if (day <= 25) {
    return { month: date.getMonth() + 1, year: date.getFullYear() };
  } else {
    const nextMonth = addMonths(date, 1);
    return { month: nextMonth.getMonth() + 1, year: nextMonth.getFullYear() };
  }
}

/**
 * Returns the cycle year for a given date.
 */
export function getCycleYear(date: Date): number {
  return getCycleMonth(date).year;
}

/**
 * Returns the period interval for a given cycle month and year.
 * Period: from 26th of (month-1) to 25th of (month)
 */
export function getCycleInterval(month: number, year: number) {
  const targetDate = new Date(year, month - 1, 15); // Middle of target month
  const start = startOfDay(setDate(subMonths(targetDate, 1), 26));
  const end = endOfDay(setDate(targetDate, 25));
  return { start, end };
}

/**
 * Returns the cycle interval that covers the given date.
 */
export function getCycleIntervalForDate(date: Date) {
  const { month, year } = getCycleMonth(date);
  return getCycleInterval(month, year);
}

/**
 * Checks if a record date belongs to the same cycle as the target date.
 */
export function isSameCycleMonth(recordDate: Date, targetDate: Date): boolean {
  const targetCycle = getCycleIntervalForDate(targetDate);
  return isWithinInterval(recordDate, targetCycle);
}
