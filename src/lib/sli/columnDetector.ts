// Detects logistics columns from variable header names (Portuguese-aware)

export type DetectedColumn = "produto" | "endereco" | "codigo" | "quantidade" | "altura";

const SYNONYMS: Record<DetectedColumn, string[]> = {
  produto: ["produto", "descricao", "desc produto", "desc", "item", "mercadoria", "nome", "descricao produto"],
  endereco: ["endereco", "end", "endereco picking", "localizacao", "rua", "posicao", "picking", "local"],
  codigo: ["codigo", "cod", "cod produto", "sku", "ean", "cod item", "codigo produto", "id produto", "id"],
  quantidade: ["quantidade", "qtd", "qtde", "qty", "qt", "qtd separar", "qtd. separar", "quant"],
  altura: ["altura", "altura mm", "altura_mm", "alt", "altura cm", "height", "h", "altura embalagem"],
};

const FOOTER_SYNONYMS = {
  rota: ["rota", "route"],
  pedidoOrigem: ["pedido origem", "pedido", "pedido de origem", "origem"],
  separacao: ["separacao", "separação", "numero separacao", "nr separacao", "n separacao", "sep"],
};

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ColumnMap = Partial<Record<DetectedColumn, string>>;

export function detectColumns(headers: string[]): {
  map: ColumnMap;
  missing: DetectedColumn[];
  unknown: string[];
} {
  const map: ColumnMap = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, norm: normalize(h) }));

  (Object.keys(SYNONYMS) as DetectedColumn[]).forEach((key) => {
    const candidates = SYNONYMS[key];
    // exact match first
    let found = normalized.find((h) => !used.has(h.raw) && candidates.includes(h.norm));
    // then contains
    if (!found)
      found = normalized.find(
        (h) => !used.has(h.raw) && candidates.some((c) => {
          // Evita falsos positivos de abreviações muito curtas, como "id"
          // em "Pedido Origem" ou "h" em "Caminhão".
          if (c.length < 3 || h.norm.length < 3) return false;
          return h.norm.includes(c) || c.includes(h.norm);
        }),
      );
    if (found) {
      map[key] = found.raw;
      used.add(found.raw);
    }
  });

  const required: DetectedColumn[] = ["produto", "endereco", "codigo", "quantidade"];
  const missing = required.filter((k) => !map[k]);
  const unknown = headers.filter((h) => !used.has(h));
  return { map, missing, unknown };
}

export interface FooterInfo {
  rota?: string;
  pedidoOrigem?: string;
  separacao?: string;
}

export function detectFooter(rows: Record<string, unknown>[]): FooterInfo {
  if (!rows.length) return {};
  const headers = Object.keys(rows[0]);
  const result: FooterInfo = {};
  const find = (syns: string[]) => {
    const h = headers.find((header) => syns.some((s) => normalize(header).includes(s)));
    if (!h) return undefined;
    for (const row of rows) {
      const val = row[h];
      if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
    }
    return undefined;
  };
  result.rota = find(FOOTER_SYNONYMS.rota);
  result.pedidoOrigem = find(FOOTER_SYNONYMS.pedidoOrigem);
  result.separacao = find(FOOTER_SYNONYMS.separacao);
  return result;
}

export function parseNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Returns height in CM. Detects mm vs cm based on magnitude and column name.
export function normalizeHeightCm(raw: unknown, columnName: string): number {
  const n = parseNumber(raw);
  if (n <= 0) return 0;
  const norm = normalize(columnName);
  if (norm.includes("cm")) return n;
  if (norm.includes("mm")) return n / 10;
  // Heuristic: values > 100 are very likely mm for a single item
  return n > 100 ? n / 10 : n;
}

// Extracts height (in cm) from a free-text product description.
// Recognizes patterns like "2750X1850X15MM", "2750 x 1840 x 15 mm" or trailing "15MM".
const DIMENSION_RE = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/i;
const MM_RE = /(\d+(?:[.,]\d+)?)\s*mm/i;
const CM_RE = /(\d+(?:[.,]\d+)?)\s*cm/i;

export function extractHeightCmFromText(text: unknown): number {
  if (text === null || text === undefined) return 0;
  const s = String(text);
  const dim = s.match(DIMENSION_RE);
  if (dim) {
    const mm = parseFloat(dim[3].replace(",", "."));
    if (!isNaN(mm) && mm > 0) return +(mm / 10).toFixed(2);
  }
  const mm = s.match(MM_RE);
  if (mm) {
    const v = parseFloat(mm[1].replace(",", "."));
    if (!isNaN(v) && v > 0) return +(v / 10).toFixed(2);
  }
  const cm = s.match(CM_RE);
  if (cm) {
    const v = parseFloat(cm[1].replace(",", "."));
    if (!isNaN(v) && v > 0) return +v.toFixed(2);
  }
  return 0;
}
