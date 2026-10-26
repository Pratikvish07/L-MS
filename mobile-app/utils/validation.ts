import type { LectureMetadata } from '@/types/recording.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return undefined;
}

export type LectureFormErrors = Partial<Record<keyof LectureMetadata, string>>;

export function validateLecture(form: Partial<LectureMetadata>): LectureFormErrors {
  const errors: LectureFormErrors = {};
  if (!form.classroomId) errors.classroomId = 'Select a classroom.';
  if (!form.degreeId) errors.degreeId = 'Select a degree.';
  if (!form.streamId) errors.streamId = 'Select a stream.';
  if (!form.year) errors.year = 'Select the year.';
  if (!form.subjectId) errors.subjectId = 'Select a subject.';
  if (!form.chapter?.trim()) errors.chapter = 'Select or enter a chapter.';
  if (!form.topic?.trim()) errors.topic = 'Enter the lecture topic.';
  else if (form.topic.trim().length > 120) errors.topic = 'Keep the topic under 120 characters.';
  if (!form.recordedAt) errors.recordedAt = 'Choose the lecture date and time.';
  return errors;
}

/** Faculty control codes: 6 digits, rotated every 30 seconds by the mount phone. */
export const PAIRING_CODE_LENGTH = 6;

const PAIRING_CODE_PATTERN = /^\d{6}$/;

export function normalizePairingCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, PAIRING_CODE_LENGTH);
}

export function isValidPairingCode(code: string): boolean {
  return PAIRING_CODE_PATTERN.test(code);
}
