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

export interface Fardo {
  numero: number;
  itens: FardoItem[];
  alturaTotalCm: number;
  quantidadeTotal: number;
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

export function buildFardos(rows: NormalizedRow[]): Fardo[] {
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
    let remaining = row.quantidade;
    const unitH = row.alturaUnitariaCm;

    if (unitH <= 0) {
      // No height info — keep together in current fardo
      current.itens.push({
        ...row,
        alturaTotalCm: 0,
        quantidade: remaining,
      });
      current.quantidadeTotal += remaining;
      continue;
    }

    if (unitH > FARDO_MAX_CM) {
      // single item exceeds limit — own fardo
      if (current.itens.length) pushCurrent();
      current.itens.push({ ...row, quantidade: 1, alturaTotalCm: unitH });
      current.alturaTotalCm = unitH;
      current.quantidadeTotal = 1;
      pushCurrent();
      remaining -= 1;
    }

    while (remaining > 0) {
      const livre = FARDO_MAX_CM - current.alturaTotalCm;
      const cabe = Math.floor(livre / unitH);
      if (cabe <= 0) {
        pushCurrent();
        continue;
      }
      const usar = Math.min(cabe, remaining);
      current.itens.push({
        ...row,
        quantidade: usar,
        alturaTotalCm: +(usar * unitH).toFixed(2),
      });
      current.alturaTotalCm = +(current.alturaTotalCm + usar * unitH).toFixed(2);
      current.quantidadeTotal += usar;
      remaining -= usar;
      if (current.alturaTotalCm >= FARDO_MAX_CM - 0.01) pushCurrent();
    }
  }

  if (current.itens.length) fardos.push(current);
  return fardos;
}
