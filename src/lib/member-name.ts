function cleanNamePart(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function normalized(value: string) {
  return value.toLocaleLowerCase("en-US");
}

export function normalizedMemberNameParts(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
) {
  let first = cleanNamePart(firstName);
  let last = cleanNamePart(lastName);
  const firstKey = normalized(first);
  const lastKey = normalized(last);

  if (first && last && firstKey === lastKey) {
    const parts = first.split(" ");
    if (parts.length > 1) {
      last = parts.pop() || last;
      first = parts.join(" ");
    }
  } else if (first && last && firstKey.endsWith(` ${lastKey}`)) {
    first = first.slice(0, -(last.length + 1)).trim();
  } else if (first && last && lastKey.startsWith(`${firstKey} `)) {
    last = last.slice(first.length + 1).trim();
  }

  return { firstName: first, lastName: last };
}

export function canonicalMemberName({
  firstName,
  lastName,
  fallback = "",
}: {
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string | null;
}) {
  const parts = normalizedMemberNameParts(firstName, lastName);
  return (
    [parts.firstName, parts.lastName].filter(Boolean).join(" ") ||
    cleanNamePart(fallback)
  );
}
