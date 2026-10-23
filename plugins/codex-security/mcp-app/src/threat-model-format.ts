const whitespace = /[\p{White_Space}\u001c-\u001f]+/gu;

/** Match the retained artifact projection's Python whitespace semantics. */
export function nonblank(value: string): boolean {
  return value.replace(whitespace, "").length > 0;
}

function collapse(value: string): string {
  return value.replace(whitespace, " ").replace(/^ | $/gu, "");
}

/** Match report_projection._path_text without collapsing literal filenames. */
export function pathText(value: string): string {
  if (
    !value.includes(",") &&
    value === collapse(value) &&
    !/[\u0000-\u001f]/u.test(value)
  )
    return value.replace(/([\\`*_\[\]<>])/gu, "\\$1");

  const label = JSON.stringify(value).replace(/[\p{C}\p{Z}]/gu, (character) =>
    character === " "
      ? character
      : character
          .split("")
          .map(
            (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`,
          )
          .join(""),
  );
  const marker = "`".repeat(
    (label.match(/`+/gu) ?? []).reduce(
      (length, run) => Math.max(length, run.length + 1),
      1,
    ),
  );
  return `${marker}${label}${marker}`;
}

/** Plain metadata remains text; authored single-backtick spans remain intact. */
export function text(value: unknown, fallback = ""): string {
  const candidate =
    typeof value === "string" && nonblank(value) ? value : fallback;
  const normalized = collapse(candidate);
  const protectedText =
    /^(?:#{1,6} |[-*+] |> |```|~~~|\p{Decimal_Number}+[.)] |\|)/u.test(
      normalized,
    )
      ? `Text: ${normalized}`
      : normalized;
  return protectedText
    .split(/((?<!`)`[^`\n]+`(?!`))/u)
    .map((part, index) =>
      index % 2 ? part : part.replace(/([\\`*_\[\]<>])/gu, "\\$1"),
    )
    .join("");
}
