function transliterateSpecialChars(name: string): string {
  return name
    .replace(/ß/g, "ss")
    .replace(/ẞ/g, "SS")
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");
}

/** Existing disk-export naming convention, shared by JSON mirrors and PDFs. */
export function sanitizeFilename(name: string): string {
  return transliterateSpecialChars(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .replace(/_+/g, "_");
}

/** Existing editor download convention; preserves hyphens and trims whitespace. */
export function sanitizeDownloadName(name: string): string {
  return transliterateSpecialChars(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}
