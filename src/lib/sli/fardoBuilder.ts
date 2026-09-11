import type { ColumnMap } from "./columnDetector";
import { extractHeightCmFromText, normalizeHeightCm, parseNumber } from "./columnDetector";

export const FARDO_MAX_CM = 60;
export const FARDO_MAX_ITENS = 10;

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

/**
 * Regras operacionais de FARDO fechado automático:
 * - MDF 15 mm com 40 a 45 unidades
 * - MDF 18 mm com 30 a 36 unidades
 */
export function shouldAutoCloseFardo(
  produto: string,
  alturaUnitariaCm: number,
  quantidade: number,
): boolean {
  const isMdf = /\bmdf\b/i.test(produto)
    && !/\b(tira|tiras|peça|peca|peças|pecas|corte|cortes|sarrafo|sarrafos)\b/i.test(produto);
  if (!isMdf) return false;

  const is15mm = Math.abs(alturaUnitariaCm - 1.5) < 0.01;
  const is18mm = Math.abs(alturaUnitariaCm - 1.8) < 0.01;
  return (is15mm && quantidade >= 40 && quantidade <= 45)
    || (is18mm && quantidade >= 30 && quantidade <= 36);
}

function isMdfProduto(produto: string): boolean {
  return /\bmdf\b/i.test(produto)
    && !/\b(tira|tiras|peça|peca|peças|pecas|corte|cortes|sarrafo|sarrafos)\b/i.test(produto);
}

function compareEndereco(a: NormalizedRow, b: NormalizedRow): number {
  return a.endereco.localeCompare(b.endereco, "pt-BR", { numeric: true, sensitivity: "base" });
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
  // A sequência de separação é definida antes da montagem dos FARDOs.
  const rows = groupByCodigo(inputRows).sort(compareEndereco);
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

    // Combinações fechadas são sempre isoladas em um FARDO próprio.
    if (shouldAutoCloseFardo(row.produto, unitH, row.quantidade)) {
      pushCurrent();
      fardos.push({
        numero: fardos.length + 1,
        itens: [{ ...row, alturaTotalCm: total }],
        alturaTotalCm: total,
        quantidadeTotal: row.quantidade,
        fechado: true,
      });
      current = {
        numero: fardos.length + 1,
        itens: [],
        alturaTotalCm: 0,
        quantidadeTotal: 0,
      };
      continue;
    }

    // O limite de 60 cm vale quando o FARDO contém MDF. Materiais que não são
    // MDF podem ser agrupados sem limite de altura. Um código nunca é dividido.
    const currentHasMdf = current.itens.some((item) => isMdfProduto(item.produto));
    const nextHasMdf = currentHasMdf || isMdfProduto(row.produto);
    const exceedsHeight = nextHasMdf
      && total > 0
      && current.alturaTotalCm + total > FARDO_MAX_CM + 0.01;
    const exceedsItemCount = current.itens.length >= FARDO_MAX_ITENS;
    if (current.itens.length && (exceedsHeight || exceedsItemCount)) {
      pushCurrent();
    }

    current.itens.push({ ...row, alturaTotalCm: total });
    current.alturaTotalCm = +(current.alturaTotalCm + total).toFixed(2);
    current.quantidadeTotal += row.quantidade;

    if (nextHasMdf && current.alturaTotalCm >= FARDO_MAX_CM - 0.01) pushCurrent();
  }


  if (current.itens.length) fardos.push(current);
  return fardos;
}
