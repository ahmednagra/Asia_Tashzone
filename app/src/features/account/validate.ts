export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function emailOk(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length >= 3 && e.length <= 254 && EMAIL.test(e);
}

export function passwordOk(password: string, email = ""): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX
    && /\p{L}/u.test(password) && /\d/.test(password)
    && password.trim().toLowerCase() !== normalizeEmail(email);
}

export const codeOk = (code: string) => /^\d{6}$/.test(code);

export const digitsOnly = (text: string) => text.replace(/\D/g, "").slice(0, 6);
