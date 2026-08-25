const secretPatterns = [
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g,
  /\bAIza[A-Za-z0-9_-]{30,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,}\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

export const sensitiveEngineeringExtensions = [
  ".step", ".stp", ".stl", ".iges", ".igs", ".sldprt", ".sldasm",
  ".f3d", ".fcstd", ".prt", ".asm", ".zip",
];

export function redactLikelySecrets(content: string) {
  let redacted = content;
  let matches = 0;
  for (const pattern of secretPatterns) {
    redacted = redacted.replace(pattern, () => {
      matches += 1;
      return "[REDACTED SECRET]";
    });
  }
  return { redacted, matches };
}

export function hasSensitiveEngineeringAttachment(filenames: string[]) {
  return filenames.some((filename) => {
    const lower = filename.toLowerCase();
    return sensitiveEngineeringExtensions.some((extension) => lower.endsWith(extension));
  });
}
