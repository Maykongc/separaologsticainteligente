import type { ColumnMap } from "./columnDetector";
import { extractHeightCmFromText, normalizeHeightCm, parseNumber } from "./columnDetector";

export const FARDO_MAX_CM = 60;

export interface FardoItem {
  produto: string;
  endereco: string;
  codigo: string;
  quantidade: number;
  alturaUnitariaCm: number;
  alturaTotalCm: number;
}

export const FARDO_FECHADO_MAX_CM = 70;

export interface Fardo {
  numero: number;
  itens: FardoItem[];
  alturaTotalCm: number;
  quantidadeTotal: number;
  fechado?: boolean;
}

interface NormalizedRow {
  produto: string;
  endereco: string;
  codigo: string;
  quantidade: number;
  alturaUnitariaCm: number;
}

export function normalizeRows(
  rows: Record<string, unknown>[],
  map: ColumnMap,
): NormalizedRow[] {
  return rows
    .map((row) => {
      const qtd = Math.max(1, Math.round(parseNumber(row[map.quantidade ?? ""])) || 1);
      const altCol = map.altura ?? "";
      const produto = String(row[map.produto ?? ""] ?? "").trim();
      let altura = altCol ? normalizeHeightCm(row[altCol], altCol) : 0;
      // Fallback: extract MM/CM measurement from product description text
      if (altura <= 0) altura = extractHeightCmFromText(produto);
      // Final fallback: scan every cell of the row for an MM/CM pattern
      if (altura <= 0) {
        for (const v of Object.values(row)) {
          const h = extractHeightCmFromText(v);
          if (h > 0) { altura = h; break; }
        }
      }
      return {
        produto,
        endereco: String(row[map.endereco ?? ""] ?? "").trim(),
        codigo: String(row[map.codigo ?? ""] ?? "").trim(),
        quantidade: qtd,
        alturaUnitariaCm: altura,
      };
    })
    .filter((r) => r.produto || r.codigo);
}

/** Agrupa linhas com o mesmo código para que um código nunca fique em 2 fardos */
function groupByCodigo(rows: NormalizedRow[]): NormalizedRow[] {
  const map = new Map<string, NormalizedRow>();
  const out: NormalizedRow[] = [];
  for (const r of rows) {
    const key = r.codigo.trim().toUpperCase();
    if (!key) { out.push(r); continue; }
    const prev = map.get(key);
    if (prev) {
      prev.quantidade += r.quantidade;
      if (prev.alturaUnitariaCm <= 0) prev.alturaUnitariaCm = r.alturaUnitariaCm;
    } else {
      const copy = { ...r };
      map.set(key, copy);
      out.push(copy);
    }
  }
  return out;
}

export function buildFardos(inputRows: NormalizedRow[]): Fardo[] {
  const rows = groupByCodigo(inputRows);
  const fardos: Fardo[] = [];
  let current: Fardo = { numero: 1, itens: [], alturaTotalCm: 0, quantidadeTotal: 0 };

  const pushCurrent = () => {
    if (current.itens.length) fardos.push(current);
    current = {
      numero: (fardos[fardos.length - 1]?.numero ?? 0) + 1,
      itens: [],
      alturaTotalCm: 0,
      quantidadeTotal: 0,
    };
  };

  for (const row of rows) {
    const unitH = row.alturaUnitariaCm;
    const total = unitH > 0 ? +(row.quantidade * unitH).toFixed(2) : 0;

    // Um código nunca é dividido entre fardos: se não couber no fardo atual,
    // abre-se um novo fardo (mesmo que o item sozinho ultrapasse o limite).
    if (current.itens.length && total > 0 && current.alturaTotalCm + total > FARDO_MAX_CM + 0.01) {
      pushCurrent();
    }

    current.itens.push({ ...row, alturaTotalCm: total });
    current.alturaTotalCm = +(current.alturaTotalCm + total).toFixed(2);
    current.quantidadeTotal += row.quantidade;

    if (current.alturaTotalCm >= FARDO_MAX_CM - 0.01) pushCurrent();
  }


  if (current.itens.length) fardos.push(current);
  return fardos;
}
