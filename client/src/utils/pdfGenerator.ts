import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateQuotationPDF = (cotizacion: any, logoBase64: string | null = null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 10, 35, 12);
    } catch (e) {
      console.error('Error drawing logo in Quotation PDF:', e);
    }
  }

  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text('COTIZACIÓN DE IMPORTACIÓN', pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Nro: ${String(cotizacion.numero).padStart(5, '0')}`, 15, 35);
  doc.text(`Fecha: ${new Date(cotizacion.createdAt).toLocaleDateString()}`, 15, 40);
  doc.text(`Vendedor: ${cotizacion.vendedor?.nombres || 'S/V'}`, 15, 45);

  // Client Info
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text('DATOS DEL CLIENTE', 15, 55);
  doc.line(15, 57, 70, 57);

  doc.setFontSize(10);
  doc.text(`Razón Social: ${cotizacion.cliente?.razonSocial || 'S/N'}`, 15, 65);
  doc.text(`RUC: ${cotizacion.cliente?.ruc || 'S/N'}`, 15, 70);
  doc.text(`Dirección: ${cotizacion.cliente?.direccion || 'S/D'}`, 15, 75);

  // Table
  const tableRows = cotizacion.lineas.map((l: any) => [
    l.concepto?.categoria?.nombre || 'S/C',
    l.concepto?.nombre || 'S/C',
    `S/ ${l.precioVenta.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Categoría', 'Concepto', 'Precio Venta']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text(`Sub-Total: S/ ${cotizacion.totalVenta.toFixed(2)}`, pageWidth - 60, finalY);
  doc.text(`IGV (18%): S/ ${cotizacion.igv.toFixed(2)}`, pageWidth - 60, finalY + 7);
  
  doc.setFontSize(13);
  doc.setTextColor(41, 128, 185);
  doc.text(`TOTAL: S/ ${cotizacion.precioTotal.toFixed(2)}`, pageWidth - 60, finalY + 16);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('Gracias por su confianza. Esta cotización tiene una vigencia de 7 días.', pageWidth / 2, pageWidth + 80, { align: 'center' });

  doc.save(`Cotizacion_${String(cotizacion.numero).padStart(5, '0')}.pdf`);
};
