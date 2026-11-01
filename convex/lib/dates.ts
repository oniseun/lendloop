import { LOAN_MAX_DAYS } from './constants';
import { appError, ErrorCode } from './errors';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isIsoDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
};

export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

export const todayIso = (now: number = Date.now()) => toIsoDate(new Date(now));

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

// Inclusive ranges: [a.start, a.end] overlaps [b.start, b.end].
export const rangesOverlap = (
  a: { startDate: string; endDate: string },
  b: { startDate: string; endDate: string },
) => a.startDate <= b.endDate && b.startDate <= a.endDate;

export const assertValidLoanRange = (
  startDate: string,
  endDate: string,
  today: string,
) => {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw appError(ErrorCode.VALIDATION_ERROR, 'Dates must be YYYY-MM-DD');
  }
  if (startDate < today) {
    throw appError(ErrorCode.VALIDATION_ERROR, 'Start date is in the past');
  }
  if (endDate < startDate) {
    throw appError(ErrorCode.VALIDATION_ERROR, 'End date is before start date');
  }
  if (daysBetween(startDate, endDate) + 1 > LOAN_MAX_DAYS) {
    throw appError(
      ErrorCode.VALIDATION_ERROR,
      `Loans are limited to ${LOAN_MAX_DAYS} days`,
    );
  }
};
