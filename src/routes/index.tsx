import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Package, PackageCheck, Download, RotateCcw, Loader2, ArrowRight, Boxes, GripVertical, X, Scissors, Combine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseFile } from "@/lib/sli/fileParser";
import { detectColumns, detectFooter, type ColumnMap, type DetectedColumn, type FooterInfo } from "@/lib/sli/columnDetector";
import { normalizeRows, buildFardos, FARDO_MAX_CM, FARDO_FECHADO_MAX_CM, type Fardo, type FardoItem } from "@/lib/sli/fardoBuilder";
import { generatePdf } from "@/lib/sli/pdfGenerator";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SLI — Sistema de Separação Logística Inteligente" },
      { name: "description", content: "Automatize a leitura de planilhas operacionais e gere PDFs de separação organizados por FARDO." },
      { property: "og:title", content: "SLI — Separação Logística Inteligente" },
      { property: "og:description", content: "Upload de XLSX/CSV, geração automática de FARDOs e PDF pronto para impressão." },
    ],
  }),
  component: Index,
});

type Step = "upload" | "validation" | "preview" | "result";

interface ProcessState {
  file: File;
  headers: string[];
  rowCount: number;
  map: ColumnMap;
  missing: DetectedColumn[];
  unknown: string[];
  footer: FooterInfo;
  rawRows: Record<string, unknown>[];
  extraRows: Record<string, unknown>[];
  extraHeaders: string[];
  fardos?: Fardo[];
}

const LABELS: Record<DetectedColumn, string> = {
  produto: "Produto",
  endereco: "Endereço",
  codigo: "Código",
  quantidade: "Quantidade",
  altura: "Altura",
};

function sortItensByEndereco(itens: FardoItem[]): FardoItem[] {
  return [...itens].sort((a, b) =>
    (a.endereco ?? "").localeCompare(b.endereco ?? "", "pt-BR", { numeric: true, sensitivity: "base" }),
  );
}

function mergeFardoByCode(f: Fardo): Fardo {
  const byCode = new Map<string, FardoItem>();
  const out: FardoItem[] = [];
  for (const it of f.itens) {
    const key = (it.codigo ?? "").trim();
    if (!key) { out.push({ ...it }); continue; }
    const existing = byCode.get(key);
    if (existing) {
      existing.quantidade += it.quantidade;
      existing.alturaTotalCm = +(existing.alturaTotalCm + it.alturaTotalCm).toFixed(2);
    } else {
      const copy = { ...it };
      byCode.set(key, copy);
      out.push(copy);
    }
  }
  const sorted = sortItensByEndereco(out);
  return {
    ...f,
    itens: sorted,
    alturaTotalCm: +sorted.reduce((a, v) => a + (v.alturaUnitariaCm > 0 ? v.alturaTotalCm : 0), 0).toFixed(2),
    quantidadeTotal: sorted.reduce((a, v) => a + v.quantidade, 0),
  };
}

function Index() {
  const [step, setStep] = useState<Step>("upload");
  const [state, setState] = useState<ProcessState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      if (!parsed.sheet1.rows.length) {
        toast.error("A primeira aba está vazia.");
        return;
      }
      const { map, missing, unknown } = detectColumns(parsed.sheet1.headers);
      const footer = parsed.sheet2 ? detectFooter(parsed.sheet2.rows) : {};
      setState({
        file,
        headers: parsed.sheet1.headers,
        rowCount: parsed.sheet1.rows.length,
        map,
        missing,
        unknown,
        footer,
        rawRows: parsed.sheet1.rows,
        extraRows: parsed.sheet3?.rows ?? [],
        extraHeaders: parsed.sheet3?.headers ?? [],
      });
      setStep("validation");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível ler o arquivo. Verifique o formato.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const buildPreview = () => {
    if (!state) return;
    setBusy(true);
    try {
      const normalized = normalizeRows(state.rawRows, state.map);
      const fardos = buildFardos(normalized);
      if (!fardos.length) {
        toast.error("Nenhum FARDO pôde ser formado.");
        return;
      }
      // 3ª aba: cada linha vira 1 FARDO adicional
      if (state.extraRows.length) {
        const extraMap = detectColumns(state.extraHeaders).map;
        const extraNormalized = normalizeRows(state.extraRows, extraMap);
        let n = fardos[fardos.length - 1].numero;
        for (const row of extraNormalized) {
          n += 1;
          const qtd = row.quantidade || 1;
          const altTotal = row.alturaUnitariaCm > 0 ? +(row.alturaUnitariaCm * qtd).toFixed(2) : 0;
          fardos.push({
            numero: n,
            itens: [{
              produto: row.produto,
              endereco: row.endereco,
              codigo: row.codigo,
              quantidade: qtd,
              alturaUnitariaCm: row.alturaUnitariaCm,
              alturaTotalCm: altTotal,
            }],
            alturaTotalCm: altTotal,
            quantidadeTotal: qtd,
          });
        }
      }
      // Unifica itens com mesmo código dentro de cada FARDO
      const merged = fardos.map(mergeFardoByCode);
      setState({ ...state, fardos: merged });
      setStep("preview");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!state?.fardos) return;
    generatePdf(state.fardos, state.footer, state.file.name);
    toast.success("PDF gerado com sucesso.");
    setStep("result");
  };

  const reset = () => {
    setState(null);
    setStep("upload");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Boxes className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">SLI</h1>
              <p className="text-xs text-muted-foreground">Separação Logística Inteligente</p>
            </div>
          </div>
          <Stepper step={step} />
        </div>
      </header>


      <main className="mx-auto max-w-6xl px-6 py-10">
        {step === "upload" && (
          <UploadStep
            busy={busy}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDrop={onDrop}
            inputRef={inputRef}
            onPick={(f) => handleFile(f)}
          />
        )}

        {step === "validation" && state && (
          <ValidationStep state={state} onContinue={buildPreview} onCancel={reset} busy={busy} />
        )}

        {step === "preview" && state && state.fardos && (
          <PreviewStep
            state={{ ...state, fardos: state.fardos }}
            onBack={() => setStep("validation")}
            onDownload={download}
            onUpdateFardos={(fs) => setState({ ...state, fardos: fs })}
          />
        )}

        {step === "result" && state && state.fardos && (
          <ResultStep state={{ ...state, fardos: state.fardos }} onDownloadAgain={download} onNew={reset} />
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        SLI v1.0 · Processamento local · Limite FARDO {FARDO_MAX_CM} cm
      </footer>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "validation", label: "Validação" },
    { id: "preview", label: "Pré-visualização" },
    { id: "result", label: "Resultado" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="hidden items-center gap-2 md:flex">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-sm ${i === idx ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

function UploadStep({
  busy,
  dragOver,
  setDragOver,
  onDrop,
  inputRef,
  onPick,
}: {
  busy: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">Envie sua planilha de separação</h2>
        <p className="mt-2 text-muted-foreground">
          XLSX, XLS ou CSV. O sistema identifica as colunas automaticamente e gera o PDF pronto para impressão.
        </p>
      </div>

      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed bg-surface p-16 transition-all ${
          dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50"
        }`}
        style={{ boxShadow: dragOver ? "var(--shadow-elevated)" : undefined }}
      >
        {busy ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
            <Upload className="h-7 w-7 text-primary" />
          </div>
        )}
        <div className="text-center">
          <p className="font-semibold">{busy ? "Lendo arquivo..." : "Arraste aqui ou clique para selecionar"}</p>
          <p className="mt-1 text-sm text-muted-foreground">.xlsx, .xls, .csv até 50MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <FeatureItem icon={<FileSpreadsheet />} title="Detecção automática" desc="Reconhece variações de cabeçalho." />
        <FeatureItem icon={<Package />} title="FARDOs de até 60 cm" desc="Agrupamento e divisão automática." />
        <FeatureItem icon={<Download />} title="PDF operacional" desc="Layout paisagem, pronto para imprimir." />
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="bg-surface p-5">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-primary [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Card>
  );
}

function ValidationStep({
  state,
  onContinue,
  onCancel,
  busy,
}: {
  state: ProcessState;
  onContinue: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const canContinue = state.missing.length === 0;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Validação da planilha</h2>
        <p className="text-sm text-muted-foreground">{state.file.name} · {state.rowCount} registros</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 text-success" /> Colunas identificadas
          </h3>
          <ul className="space-y-2 text-sm">
            {(Object.keys(LABELS) as DetectedColumn[]).map((k) => (
              <li key={k} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="font-medium">{LABELS[k]}</span>
                {state.map[k] ? (
                  <Badge variant="secondary" className="font-mono text-xs">{state.map[k]}</Badge>
                ) : k === "altura" ? (
                  <Badge variant="secondary" className="text-xs">extraída do Produto (MM→CM)</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">não encontrada</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-surface p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" /> Outras colunas
          </h3>
          {state.unknown.length ? (
            <div className="flex flex-wrap gap-2">
              {state.unknown.map((c) => (
                <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todas as colunas foram mapeadas.</p>
          )}

          <h3 className="mt-5 mb-2 text-sm font-semibold">Rodapé operacional</h3>
          <div className="space-y-1 text-sm">
            <FooterLine label="Rota" value={state.footer.rota} />
            <FooterLine label="Pedido Origem" value={state.footer.pedidoOrigem} />
            <FooterLine label="Separação" value={state.footer.separacao} />
          </div>
        </Card>
      </div>

      {!canContinue && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Colunas obrigatórias ausentes</p>
          <p className="text-muted-foreground">
            Não foi possível encontrar: {state.missing.map((m) => LABELS[m]).join(", ")}. Renomeie os cabeçalhos e envie novamente.
          </p>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onContinue} disabled={!canContinue || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          Continuar
        </Button>
      </div>
    </div>
  );
}

function FooterLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between rounded bg-muted px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function PreviewStep({
  state,
  onBack,
  onDownload,
  onUpdateFardos,
}: {
  state: ProcessState & { fardos: Fardo[] };
  onBack: () => void;
  onDownload: () => void;
  onUpdateFardos: (fs: Fardo[]) => void;
}) {
  const fardos = state.fardos;
  const totalQtd = fardos.reduce((a, f) => a + f.quantidadeTotal, 0);
  const avgH = fardos.reduce((a, f) => a + f.alturaTotalCm, 0) / fardos.length;
  const [dragOver, setDragOver] = useState<number | null>(null);

  // MDF = chapa inteira. TIRA/PEÇA/CORTE de MDF não contam para o limite de altura.
  const isMDF = (produto: string) =>
    /\bmdf\b/i.test(produto) && !/\b(tira|tiras|peça|peca|peças|pecas|corte|cortes|sarrafo|sarrafos)\b/i.test(produto);
  const hasMDF = (f: Fardo) => f.itens.some((it) => isMDF(it.produto));
  const maxFor = (f: Fardo, incoming?: { produto: string }) => {
    if (f.fechado) return FARDO_FECHADO_MAX_CM;
    return hasMDF(f) || (incoming && isMDF(incoming.produto)) ? FARDO_MAX_CM : Infinity;
  };

  const recalc = (f: Fardo): Fardo => {
    const itens = sortItensByEndereco(f.itens);
    return {
      ...f,
      itens,
      alturaTotalCm: +itens.reduce((a, it) => a + (it.alturaUnitariaCm > 0 ? it.alturaTotalCm : 0), 0).toFixed(2),
      quantidadeTotal: itens.reduce((a, it) => a + it.quantidade, 0),
    };
  };

  const addEmptyFardo = () => {
    const next = [...fardos, { numero: fardos.length + 1, itens: [], alturaTotalCm: 0, quantidadeTotal: 0 }];
    onUpdateFardos(next);
    toast.success(`FARDO ${next.length} criado.`);
  };

  const addClosedFardo = () => {
    const next = [...fardos, { numero: fardos.length + 1, itens: [], alturaTotalCm: 0, quantidadeTotal: 0, fechado: true }];
    onUpdateFardos(next);
    toast.success(`FARDO fechado ${next.length} criado (máx. ${FARDO_FECHADO_MAX_CM} cm).`);
  };

  const deleteFardo = (numero: number) => {
    const target = fardos.find((f) => f.numero === numero);
    if (!target) return;
    if (target.itens.length > 0) {
      const ok = window.confirm(
        `FARDO ${numero} possui ${target.itens.length} item(ns). Excluir mesmo assim? Os itens serão removidos.`,
      );
      if (!ok) return;
    }
    const next = fardos.filter((f) => f.numero !== numero).map((f, i) => ({ ...f, numero: i + 1 }));
    onUpdateFardos(next);
    toast.success(`FARDO ${numero} excluído.`);
  };

  const reorderFardo = (srcNumero: number, destNumero: number) => {
    if (srcNumero === destNumero) return;
    const srcIdx = fardos.findIndex((f) => f.numero === srcNumero);
    const destIdx = fardos.findIndex((f) => f.numero === destNumero);
    if (srcIdx < 0 || destIdx < 0) return;
    const arr = [...fardos];
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(destIdx, 0, moved);
    onUpdateFardos(arr.map((f, i) => ({ ...f, numero: i + 1 })));
    toast.success(`FARDO movido para posição ${destIdx + 1}.`);
  };

  const moveItem = (srcFardo: number, srcIdx: number, destFardo: number) => {
    if (srcFardo === destFardo) return;
    const src = fardos.find((f) => f.numero === srcFardo);
    const dest = fardos.find((f) => f.numero === destFardo);
    if (!src || !dest) return;

    const item = src.itens[srcIdx];
    if (!item) return;
    if (dest.fechado && dest.itens.length >= 1 && dest.itens[0].codigo !== item.codigo) {
      toast.error("FARDO fechado permite apenas 1 item.");
      return;
    }
    // Regra: não é permitido separar itens de mesmo código arrastando.
    // Se o código existir em outro FARDO (que não o destino), o movimento fragmentaria o código.
    const outroComMesmoCodigo = fardos.find(
      (f) =>
        f.numero !== srcFardo &&
        f.numero !== destFardo &&
        f.itens.some((i) => i.codigo === item.codigo),
    );
    if (outroComMesmoCodigo) {
      toast.error(
        `Código ${item.codigo} já está no FARDO ${outroComMesmoCodigo.numero}. Para separar quantidades use a tesoura.`,
      );
      return;
    }
    const itemH = item.alturaUnitariaCm > 0 ? item.alturaTotalCm : 0;
    const limit = maxFor(dest, item);
    if (dest.alturaTotalCm + itemH > limit + 0.01) {
      toast.error(`Não cabe: ${(dest.alturaTotalCm + itemH).toFixed(1)} cm excederia o limite de ${limit} cm.`);
      return;
    }
    const next = fardos
      .map((f) => {
        if (f.numero === srcFardo) return recalc({ ...f, itens: f.itens.filter((_, i) => i !== srcIdx) });
        if (f.numero === destFardo) return mergeFardoByCode({ ...f, itens: [...f.itens, item] });
        return f;
      })
      .map((f, i) => ({ ...f, numero: i + 1 }));

    onUpdateFardos(next);
    toast.success(`Item movido para FARDO ${destFardo}.`);
  };

  // Regra: itens só podem ser fragmentados pela tesoura (nunca arrastando).
  const splitItem = (fardoNum: number, idx: number) => {
    const f = fardos.find((x) => x.numero === fardoNum);
    const it = f?.itens[idx];
    if (!f || !it) return;
    if (it.quantidade <= 1) {
      toast.error("Quantidade insuficiente para dividir.");
      return;
    }
    const suggested = String(Math.floor(it.quantidade / 2));
    const input = window.prompt(
      `Dividir ${it.quantidade} un de "${it.produto}"\nQuantas unidades separar em um novo FARDO?`,
      suggested,
    );
    if (input == null) return;
    const n = Math.floor(Number(input));
    if (!Number.isFinite(n) || n <= 0 || n >= it.quantidade) {
      toast.error(`Informe um número entre 1 e ${it.quantidade - 1}.`);
      return;
    }
    const unit = it.alturaUnitariaCm;
    const partA: FardoItem = {
      ...it,
      quantidade: it.quantidade - n,
      alturaTotalCm: unit > 0 ? +((it.quantidade - n) * unit).toFixed(2) : 0,
    };
    const partB: FardoItem = {
      ...it,
      quantidade: n,
      alturaTotalCm: unit > 0 ? +(n * unit).toFixed(2) : 0,
    };
    const newFardo: Fardo = {
      numero: fardos.length + 1,
      itens: [partB],
      alturaTotalCm: partB.alturaTotalCm,
      quantidadeTotal: partB.quantidade,
    };
    const next = [
      ...fardos.map((x) =>
        x.numero === fardoNum
          ? recalc({ ...x, itens: x.itens.map((v, i) => (i === idx ? partA : v)) })
          : x,
      ),
      newFardo,
    ].map((x, i) => ({ ...x, numero: i + 1 }));
    onUpdateFardos(next);
    toast.success(`Separado ${partB.quantidade} un em novo FARDO ${next.length} (restam ${partA.quantidade}).`);
  };



  const unifyFardo = (fardoNum: number) => {
    const target = fardos.find((f) => f.numero === fardoNum);
    if (!target) return;
    const before = target.itens.length;
    const merged = mergeFardoByCode(target);
    if (merged.itens.length === before) {
      toast.info("Nenhum código duplicado neste FARDO.");
      return;
    }
    onUpdateFardos(fardos.map((f) => (f.numero === fardoNum ? merged : f)));
    toast.success(`Unificados ${before - merged.itens.length} item(ns) duplicado(s).`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pré-visualização</h2>
          <p className="text-sm text-muted-foreground">Arraste itens entre FARDOs para reorganizar (limite {FARDO_MAX_CM} cm).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>Voltar</Button>
          <Button variant="outline" onClick={addEmptyFardo}>
            <Package className="mr-2 h-4 w-4" /> Novo FARDO
          </Button>
          <Button variant="outline" onClick={addClosedFardo}>
            <PackageCheck className="mr-2 h-4 w-4" /> Fardo Fechado
          </Button>
          <Button onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" /> Gerar PDF
          </Button>
        </div>

      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total de FARDOs" value={String(fardos.length)} />
        <StatCard label="Quantidade total" value={String(totalQtd)} />
        <StatCard label="Altura média" value={`${avgH.toFixed(1)} cm`} />
      </div>

      <div className="space-y-3">
        {fardos.map((f, i) => {
          const limit = maxFor(f);
          const over = limit !== Infinity && f.alturaTotalCm > limit + 0.01;
          return (
          <Card
            key={f.numero}
            onDragOver={(e) => { e.preventDefault(); setDragOver(f.numero); }}
            onDragLeave={() => setDragOver((v) => (v === f.numero ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const data = e.dataTransfer.getData("text/plain");
              if (!data) return;
              if (data.startsWith("fardo:")) {
                reorderFardo(Number(data.slice(6)), f.numero);
                return;
              }
              const [sf, si] = data.split(":").map(Number);
              moveItem(sf, si, f.numero);
            }}
            className={`bg-surface p-4 transition-colors ${dragOver === f.numero ? "ring-2 ring-primary" : ""}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", `fardo:${f.numero}`);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="flex cursor-grab items-center gap-2 rounded-md bg-primary px-3 py-1 text-sm font-bold text-primary-foreground active:cursor-grabbing"
                  title="Arraste para reordenar"
                >
                  <GripVertical className="h-4 w-4 opacity-70" />
                  FARDO {f.numero}
                </div>
                {i === fardos.length - 1 && (
                  <Badge variant="destructive" className="font-bold">FIM</Badge>
                )}
                {f.fechado && (
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-xs">fechado · máx {FARDO_FECHADO_MAX_CM} cm</Badge>
                )}
                {!f.fechado && limit === Infinity && (
                  <Badge variant="outline" className="text-xs">sem MDF · sem limite</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={over ? "text-destructive" : ""}>
                  <strong>{f.alturaTotalCm.toFixed(1)}</strong> / {limit === Infinity ? "∞" : `${limit}`} cm
                </span>

                <span><strong>{f.quantidadeTotal}</strong> un</span>
                <span className="text-muted-foreground">{f.itens.length} itens</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => unifyFardo(f.numero)}
                  disabled={f.itens.length < 2}
                  title="Unificar itens com o mesmo código"
                >
                  <Combine className="h-3.5 w-3.5" /> Unificar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteFardo(f.numero)}
                  aria-label={`Excluir FARDO ${f.numero}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="w-6 px-2 py-1.5"></th>
                    <th className="px-2 py-1.5 text-left font-medium">Produto</th>
                    <th className="px-2 py-1.5 text-left font-medium">Endereço</th>
                    <th className="px-2 py-1.5 text-left font-medium">Código</th>
                    <th className="px-2 py-1.5 text-right font-medium">Qtd</th>
                    <th className="px-2 py-1.5 text-right font-medium">Alt. (cm)</th>
                    <th className="w-8 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {f.itens.map((it, idx) => (
                    <tr
                      key={idx}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", `${f.numero}:${idx}`);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab border-b border-border/50 last:border-0 hover:bg-muted/50 active:cursor-grabbing"
                    >
                      <td className="px-2 py-1.5 text-muted-foreground"><GripVertical className="h-3 w-3" /></td>
                      <td className="px-2 py-1.5">{it.produto}</td>
                      <td className="px-2 py-1.5">{it.endereco}</td>
                      <td className="px-2 py-1.5 font-mono">{it.codigo}</td>
                      <td className="px-2 py-1.5 text-right">{it.quantidade}</td>
                      <td className="px-2 py-1.5 text-right">{it.alturaUnitariaCm > 0 ? it.alturaTotalCm.toFixed(2) : "—"}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-primary"
                          onClick={(e) => { e.stopPropagation(); splitItem(f.numero, idx); }}
                          disabled={it.quantidade <= 1}
                          title="Dividir quantidade (tesoura)"
                          aria-label="Dividir quantidade"
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          );
        })}
      </div>
    </div>
  );
}


function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Card>
  );
}

function ResultStep({
  state,
  onDownloadAgain,
  onNew,
}: {
  state: ProcessState & { fardos: Fardo[] };
  onDownloadAgain: () => void;
  onNew: () => void;
}) {
  return (
    <Card className="bg-surface p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <h2 className="text-2xl font-bold">PDF gerado com sucesso</h2>
      <p className="mt-2 text-muted-foreground">
        {state.fardos.length} FARDO{state.fardos.length > 1 ? "s" : ""} a partir de {state.rowCount} registros.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={onDownloadAgain}>
          <Download className="mr-2 h-4 w-4" /> Baixar novamente
        </Button>
        <Button variant="outline" onClick={onNew}>
          <RotateCcw className="mr-2 h-4 w-4" /> Novo processamento
        </Button>
      </div>
    </Card>
  );
}
