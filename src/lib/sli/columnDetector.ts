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
        (h) => !used.has(h.raw) && candidates.some((c) => h.norm.includes(c) || c.includes(h.norm)),
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
