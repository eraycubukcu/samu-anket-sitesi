import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

// Dosya adında işletim sistemlerinin kabul etmediği karakterleri temizler
export function buildExportFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

// Bir DOM bölümünü A4 PDF olarak indirir; uzun içerik sayfalara bölünür.
// data-pdf-skip="true" olan elemanlar (ör. butonlar) çıktıya girmez.
export async function exportElementToPdf(node: HTMLElement, filename: string) {
  try {
    // Aktif tema koyu olsa da PDF her zaman açık temayla üretilir.
    node.classList.add("pdf-export-light");
    const canvas = await html2canvas(node, {
      scale: 2,
      backgroundColor: "#ffffff",
      ignoreElements: (el) => el.getAttribute("data-pdf-skip") === "true",
    });
    node.classList.remove("pdf-export-light");

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, contentWidth, imgHeight);
      heightLeft -= contentHeight;
    }

    pdf.save(`${buildExportFilename(filename)}.pdf`);
  } finally {
    node.classList.remove("pdf-export-light");
  }
}
