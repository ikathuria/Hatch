export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) => emailPattern.test(normalizeEmail(value));

const emailExtractionPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const extractEmails = (value: string) =>
  Array.from(new Set((value.match(emailExtractionPattern) ?? []).map((email) => normalizeEmail(email))));
