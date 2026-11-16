/** `text` with its first letter in upper case: `projects` → `Projects`. */
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
