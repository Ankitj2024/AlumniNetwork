/** Escapes text typed by a user so it matches literally inside a RegExp or a MongoDB $regex. */
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
