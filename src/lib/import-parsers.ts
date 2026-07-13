// CSV/TXT/XLSX/OFX parsers for bank statements and card invoices.
// Also provides a naive category suggestion by keyword.

import * as XLSX from "xlsx";
export { suggestCategoryName } from "./finance-domain";

export type ParsedLine = {
  raw: string;
  date: string | null; // YYYY-MM-DD
  description: string;
  amount: number | null;
  meta?: Record<string, string>;
};

function parseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  // dd/mm/yyyy or dd-mm-yyyy (also dd/mm/yy)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
  }
  return null;
}

function parseAmount(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  // Remove currency symbols and spaces
  s = s.replace(/R\$|BRL|USD|\$|\s/gi, "");
  // Handle parentheses as negative
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  // If both , and . present, assume BR: dot=thousands, comma=decimal
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // Only comma → decimal
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function splitCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const DATE_KEYS = [
  "data",
  "date",
  "dt",
  "dtposted",
  "transaction_date",
  "data_lancamento",
  "data lançamento",
];
const DESC_KEYS = [
  "descricao",
  "descrição",
  "description",
  "historico",
  "histórico",
  "memo",
  "detalhe",
  "estabelecimento",
  "lançamento",
  "lancamento",
  "title",
  "titulo",
  "título",
  "nome",
  "name",
];
const AMOUNT_KEYS = ["valor", "amount", "value", "vlr", "montante", "quantia"];

function pickIndex(headers: string[], keys: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const k of keys) {
    const i = lower.indexOf(k);
    if (i >= 0) return i;
  }
  // fuzzy contains
  for (let i = 0; i < lower.length; i++) {
    if (keys.some((k) => lower[i].includes(k))) return i;
  }
  return -1;
}

export function parseCSV(text: string): ParsedLine[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rawLines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return [];

  const first = rawLines[0];
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows = rawLines.map((l) => splitCSVLine(l, sep));
  const header = rows[0];
  const iDate = pickIndex(header, DATE_KEYS);
  const iDesc = pickIndex(header, DESC_KEYS);
  const iAmt = pickIndex(header, AMOUNT_KEYS);

  const dataRows = iDate >= 0 || iDesc >= 0 || iAmt >= 0 ? rows.slice(1) : rows;

  return dataRows.map<ParsedLine>((cols) => {
    const raw = cols.join(sep);
    const date =
      iDate >= 0 ? parseDate(cols[iDate] ?? "") : parseDate(cols[0] ?? "");
    const description =
      iDesc >= 0
        ? cols[iDesc] ?? ""
        : (cols[1] ?? cols[0] ?? "").toString();
    const amount =
      iAmt >= 0 ? parseAmount(cols[iAmt] ?? "") : parseAmount(cols[cols.length - 1] ?? "");
    return { raw, date, description: description.trim(), amount };
  });
}

export function parseTXT(text: string): ParsedLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result: ParsedLine[] = [];
  const dateRe =
    /(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
  const amountRe = /(-?\(?\s*R?\$?\s*-?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?\)?)\s*$/;

  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm) continue;
    const date = parseDate(dm[1]);
    const am = line.match(amountRe);
    let amount: number | null = null;
    let rest = line.replace(dateRe, "").trim();
    if (am) {
      amount = parseAmount(am[1]);
      rest = rest.replace(am[1], "").trim();
    }
    rest = rest.replace(/[\-–—|;:]{1,3}\s*$/g, "").trim();
    result.push({
      raw: line,
      date,
      description: rest || line,
      amount,
    });
  }
  return result;
}

// -------- File type detection --------

export type DetectedType = "csv" | "txt" | "pdf" | "xlsx" | "ofx" | "unknown";

export type DetectionResult = {
  type: DetectedType;
  warning?: string;
  originalExtension: string | null;
};

function extensionOf(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

export async function detectFileType(file: File): Promise<DetectionResult> {
  const ext = extensionOf(file.name);
  const head = await file.slice(0, 512).arrayBuffer();
  const bytes = new Uint8Array(head);
  const sigPK = bytes[0] === 0x50 && bytes[1] === 0x4b; // ZIP (xlsx/office)
  const sigPDF =
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

  // Decode as latin1-ish text for OFX sniff
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    text = "";
  }
  const upper = text.toUpperCase();
  const looksOFX =
    upper.includes("OFXHEADER") ||
    upper.includes("<OFX>") ||
    upper.includes("<STMTTRN") ||
    upper.startsWith("OFX");

  if (sigPDF) {
    return {
      type: "pdf",
      originalExtension: ext,
      warning:
        ext !== "pdf"
          ? "Este arquivo parece estar com a extensão diferente do formato real (PDF)."
          : undefined,
    };
  }
  if (sigPK) {
    return {
      type: "xlsx",
      originalExtension: ext,
      warning:
        ext !== "xlsx"
          ? "Este arquivo parece estar com a extensão diferente do formato real. Vamos tentar processá-lo como planilha."
          : undefined,
    };
  }
  if (looksOFX) {
    return {
      type: "ofx",
      originalExtension: ext,
      warning:
        ext !== "ofx"
          ? "Este arquivo tem estrutura OFX. Vamos processá-lo como OFX."
          : undefined,
    };
  }
  if (ext === "csv") return { type: "csv", originalExtension: ext };
  if (ext === "txt") return { type: "txt", originalExtension: ext };
  if (ext === "ofx") return { type: "ofx", originalExtension: ext };
  if (ext === "xlsx" || ext === "xls") return { type: "xlsx", originalExtension: ext };
  if (ext === "pdf") return { type: "pdf", originalExtension: ext };
  return { type: "unknown", originalExtension: ext };
}

// -------- XLSX parser --------

const XLSX_DATE_KEYS = [
  "data",
  "date",
  "dt",
  "data lançamento",
  "data lancamento",
  "data_lancamento",
  "data movimento",
  "lançamento",
  "lancamento",
];
const XLSX_DESC_KEYS = [
  "descrição",
  "descricao",
  "description",
  "histórico",
  "historico",
  "memo",
  "detalhe",
  "estabelecimento",
  "lançamento",
  "lancamento",
];
const XLSX_AMOUNT_KEYS = ["valor", "amount", "value", "vlr", "montante", "quantia"];

function normHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .trim();
}

function findKey(headers: string[], keys: string[]): number {
  const lower = headers.map(normHeader);
  for (const k of keys) {
    const i = lower.indexOf(k);
    if (i >= 0) return i;
  }
  for (let i = 0; i < lower.length; i++) {
    if (keys.some((k) => lower[i].includes(k))) return i;
  }
  return -1;
}

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date (1900 base)
    const utcDays = Math.floor(v - 25569);
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  return parseDatePublic(String(v));
}

// Re-export inner date/amount parsers for reuse
export function parseDatePublic(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
  }
  // OFX YYYYMMDD
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export function parseAmountPublic(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s) return null;
  s = s.replace(/R\$|BRL|USD|\$|\s/gi, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

export async function parseXLSX(file: File): Promise<ParsedLine[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    blankrows: false,
  });
  if (rows.length === 0) return [];

  // Try to find a header row within the first 10 rows
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(normHeader);
    if (
      cells.some((c) => XLSX_DATE_KEYS.includes(c) || c.includes("data")) &&
      cells.some((c) => XLSX_AMOUNT_KEYS.includes(c) || c.includes("valor") || c.includes("amount"))
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // No header — try positional (col 0 = date, col 1 = desc, last = amount)
    return rows
      .map<ParsedLine | null>((cols) => {
        const date = excelDateToISO(cols[0]);
        const desc = String(cols[1] ?? "").trim();
        const amount = parseAmountPublic(cols[cols.length - 1]);
        if (!date && amount == null) return null;
        return { raw: cols.join(" | "), date, description: desc, amount };
      })
      .filter((x): x is ParsedLine => !!x);
  }

  const headers = rows[headerIdx].map((h) => String(h ?? ""));
  const iDate = findKey(headers, XLSX_DATE_KEYS);
  const iDesc = findKey(headers, XLSX_DESC_KEYS);
  const iAmt = findKey(headers, XLSX_AMOUNT_KEYS);

  const dataRows = rows.slice(headerIdx + 1);
  return dataRows
    .map<ParsedLine | null>((cols) => {
      const date =
        iDate >= 0 ? excelDateToISO(cols[iDate]) : excelDateToISO(cols[0]);
      const description =
        iDesc >= 0
          ? String(cols[iDesc] ?? "").trim()
          : String(cols[1] ?? "").trim();
      const amount =
        iAmt >= 0
          ? parseAmountPublic(cols[iAmt])
          : parseAmountPublic(cols[cols.length - 1]);
      if (!date && amount == null && !description) return null;
      return {
        raw: cols.map((c) => String(c ?? "")).join(" | "),
        date,
        description,
        amount,
      };
    })
    .filter((x): x is ParsedLine => !!x);
}

// -------- OFX parser --------

function stripOfxHeader(text: string): string {
  const idx = text.indexOf("<OFX");
  return idx >= 0 ? text.slice(idx) : text;
}

// SGML → tag-value: <TAG>value (until next <)
function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

export async function parseOFX(file: File): Promise<ParsedLine[]> {
  const text = await file.text();
  const body = stripOfxHeader(text);
  const blocks = Array.from(
    body.matchAll(/<STMTTRN\b[^>]*>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN\b)|$)/gi),
    (match) => match[1],
  );
  const out: ParsedLine[] = [];
  for (const block of blocks) {
    const dt = extractTag(block, "DTPOSTED");
    const amt = extractTag(block, "TRNAMT");
    const memo = extractTag(block, "MEMO");
    const name = extractTag(block, "NAME");
    const trntype = extractTag(block, "TRNTYPE");
    const fitid = extractTag(block, "FITID");
    const desc = (memo || name || "").trim();
    out.push({
      raw: block.replace(/\s+/g, " ").trim().slice(0, 400),
      date: dt ? parseDatePublic(dt) : null,
      description: desc || "Transação OFX",
      amount: amt ? parseAmountPublic(amt) : null,
      meta: {
        ...(fitid ? { fitid } : {}),
        ...(trntype ? { trntype } : {}),
      },
    });
  }
  return out;
}
