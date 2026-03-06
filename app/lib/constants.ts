export const CATEGORIES = [
  'Food',
  'Transport',
  'Groceries',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
] as const;

export const METHODS = ['Cash', 'BCA Debit', 'QRIS'] as const;

export const USERS = ['Danny', 'Wife'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Method = (typeof METHODS)[number];
export type User = (typeof USERS)[number];
