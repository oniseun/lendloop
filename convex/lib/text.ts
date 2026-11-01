import { appError, ErrorCode } from './errors';

interface TextRule {
  field: string;
  min?: number;
  max: number;
}

export const cleanText = (value: string, { field, min = 0, max }: TextRule) => {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length < min) {
    throw appError(
      ErrorCode.VALIDATION_ERROR,
      `${field} must be at least ${min} characters`,
    );
  }
  if (cleaned.length > max) {
    throw appError(
      ErrorCode.VALIDATION_ERROR,
      `${field} must be at most ${max} characters`,
    );
  }
  return cleaned;
};

// We only ever share a first name with other neighbours.
export const firstName = (fullName: string) =>
  fullName.trim().split(/\s+/)[0] || 'Neighbour';
