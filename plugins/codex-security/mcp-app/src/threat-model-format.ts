const whitespace = /[\p{White_Space}\u001c-\u001f]+/gu;

/** Match the retained artifact projection's Python whitespace semantics. */
export function nonblank(value: string): boolean {
  return value.replace(whitespace, "").length > 0;
}

function collapse(value: string): string {
  return value.replace(whitespace, " ").replace(/^ | $/gu, "");
}

/** Match report_projection._escape_markdown without changing URL ampersands. */
function escapeMarkdown(value: string, inlineCode = false): string {
  const urls = [...value.matchAll(/(?:https?|ftp):\/\/|(www)\./giu)]
    .filter((match) => {
      const previous = value[match.index - 1] ?? "";
      return match[1]
        ? previous === "" ||
            /[\p{White_Space}\u001c-\u001f*_~(]/u.test(previous)
        : !/[A-Za-z]/u.test(previous);
    })
    .map((match) => {
      const length = value
        .slice(match.index)
        .search(/[\p{White_Space}\u001c-\u001f<>]/u);
      return {
        start: match.index,
        end: length < 0 ? value.length : match.index + length,
      };
    });
  // Conservatively retain fuzzy links without a TLD or Unicode domain table.
  const domain = String.raw`[^\p{White_Space}\u001c-\u001f<>/@:?&.#\\]+(?:\.[^\p{White_Space}\u001c-\u001f<>/@:?&.#\\]+)+`;
  const bareLink = new RegExp(
    String.raw`(?<![^\p{White_Space}\u001c-\u001f"'(\[*_~])(?:(?://)?${domain}(?=[:/?#])|[^\p{White_Space}\u001c-\u001f<>/@]+@${domain})[^\p{White_Space}\u001c-\u001f<>]*`,
    "gu",
  );
  for (const match of value.matchAll(bareLink)) {
    urls.push({ start: match.index, end: match.index + match[0].length });
  }
  const pattern = inlineCode
    ? /(?<!`)`[^`\n]+`(?!`)|[\\`*_\[\]<>&]/gu
    : /[\\`*_\[\]<>&]/gu;
  return value.replace(pattern, (match, offset: number) =>
    match.length > 1 ||
    (match === "&" &&
      urls.some(({ start, end }) => start <= offset && offset < end))
      ? match
      : "\\" + match,
  );
}

/** Match report_projection._path_text with ensure_ascii for quoted scope paths. */
export function pathText(value: string): string {
  if (
    !value.includes(",") &&
    value === collapse(value) &&
    !/[\u0000-\u001f]/u.test(value)
  )
    return escapeMarkdown(value);

  // Escape UTF-16 units so quoted paths do not depend on Unicode versions.
  const label = JSON.stringify(value).replace(
    /[\u007f-\uffff]/g,
    (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`,
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
  return escapeMarkdown(protectedText, true);
}
