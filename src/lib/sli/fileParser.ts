import * as XLSX from "xlsx";

export interface ParsedFile {
  sheet1: { headers: string[]; rows: Record<string, unknown>[] };
  sheet2: { headers: string[]; rows: Record<string, unknown>[] } | null;
  sheetNames: string[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const names = wb.SheetNames;
  const sheet1 = sheetToData(wb.Sheets[names[0]]);
  const sheet2 = names[1] ? sheetToData(wb.Sheets[names[1]]) : null;
  return { sheet1, sheet2, sheetNames: names };
}

function sheetToData(sheet: XLSX.WorkSheet) {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  const headers = json.length ? Object.keys(json[0]) : [];
  return { headers, rows: json };
}
