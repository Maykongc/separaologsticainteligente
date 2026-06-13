import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Fardo } from "./fardoBuilder";
import type { FooterInfo } from "./columnDetector";

export function generatePdf(fardos: Fardo[], footer: FooterInfo, fileName: string) {
  const totalEnderecosGeral = new Set(
    fardos.flatMap((f) => f.itens.map((it) => it.endereco)),
  ).size;
  const totalQuantidadeGeral = fardos.reduce((a, f) => a + f.quantidadeTotal, 0);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  fardos.forEach((fardo, idx) => {
    if (idx > 0) doc.addPage();
    const isLast = idx === fardos.length - 1;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`FARDO ${fardo.numero}`, 10, 14);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const headerRight = `ALTURA TOTAL: ${fardo.alturaTotalCm.toFixed(1)} cm     QUANTIDADE TOTAL: ${fardo.quantidadeTotal}`;
    doc.text(headerRight, pageW - 10, 14, { align: "right" });

    // Table
    autoTable(doc, {
      startY: 28,
      head: [["PRODUTO", "ENDEREÇO", "CÓDIGO", "QTD", "ALT. (cm)"]],
      body: fardo.itens.map((it) => [
        it.produto,
        it.endereco,
        it.codigo,
        String(it.quantidade),
        it.alturaUnitariaCm > 0 ? it.alturaTotalCm.toFixed(2) : "—",
      ]),
      styles: { fontSize: 11, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", halign: "left" },
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 60 },
        2: { cellWidth: 50 },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 30, halign: "right" },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(10, pageH - 18, pageW - 10, pageH - 18);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");

    const parts: string[] = [];
    if (footer.rota) parts.push(`ROTA: ${footer.rota}`);
    if (footer.pedidoOrigem) parts.push(`PEDIDO ORIGEM: ${footer.pedidoOrigem}`);
    if (footer.separacao) parts.push(`SEPARAÇÃO: ${footer.separacao}`);
    parts.push(`TOTAL ENDEREÇOS: ${totalEnderecosGeral}`);
    parts.push(`TOTAL QUANTIDADE: ${totalQuantidadeGeral}`);
    doc.text(parts.join("     |     "), 10, pageH - 10);

    doc.setFont("helvetica", "normal");
    doc.text(
      `Página ${idx + 1} de ${fardos.length}`,
      pageW - 10,
      pageH - 10,
      { align: "right" },
    );

    if (isLast) {
      // Big FIM marker centered
      doc.setFont("helvetica", "bold");
      doc.setFontSize(60);
      doc.setTextColor(220, 38, 38);
      doc.text("FIM", pageW / 2, pageH - 30, { align: "center" });
    }
  });

  const cleanName = fileName.replace(/\.[^.]+$/, "");
  doc.save(`SLI_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
