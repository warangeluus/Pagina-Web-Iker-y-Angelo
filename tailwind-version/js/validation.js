export function validateContact(values) {
  const text = key => String(values[key] ?? '').trim();
  const errors = {};
  const name = text('name');
  if (name.length < 3 || name.length > 80 || !/\p{L}/u.test(name) || !/^[\p{L}\p{M} '\u2019-]+$/u.test(name)) errors.name = 'Escribe un nombre de 3 a 80 caracteres que contenga letras.';
  const email = text('email');
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Escribe un correo como nombre@correo.com.';
  const phone = text('phone');
  const digits = phone.replace(/\D/g, '').length;
  if (phone && (!/^\+?[0-9() -]+$/.test(phone) || digits < 7 || digits > 15 || phone.length > 25)) errors.phone = 'Escribe entre 7 y 15 dígitos. Puedes incluir + al inicio, espacios, paréntesis y guiones.';
  if (!/^[\s\S]{3,100}$/.test(text('subject'))) errors.subject = 'Escribe un asunto de 3 a 100 caracteres.';
  if (!/^[\s\S]{10,1000}$/.test(text('message'))) errors.message = 'Escribe un mensaje de 10 a 1000 caracteres.';
  return errors;
}
