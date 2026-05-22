import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatNum = (val: number) => 
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export const generateLiquidacionPDF = (order: any, cobros: any[], logoBase64: string | null = null) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- HEADER SECTION ---
  // Top Header Line
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Forwarderly Financial Systems — Settlement Report', 15, 10);
  doc.line(15, 12, 195, 12);

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 15, 35, 12);
    } catch (e) {
      console.error('Error drawing logo in Settlement PDF:', e);
    }
  }

  // Document Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('LIQUIDACIÓN DE COBRANZA', 195, 22, { align: 'right' });

  // Document Metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  const correlativoStr = `ORD-${String(order.correlativo).padStart(4, '0')}-${order.anio}`;
  doc.text(`Referencia Orden: ${correlativoStr}`, 195, 27, { align: 'right' });
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 195, 32, { align: 'right' });

  // --- COORDINATES / METADATA CARD ---
  // We will build a beautiful card with double column details
  const cardY = 38;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(15, cardY, 180, 32, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text('COORDINADAS LOGÍSTICAS Y CLIENTE', 18, cardY + 6);
  doc.line(18, cardY + 8, 80, cardY + 8);

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  // Left Column
  const clienteName = order.cotizacion?.cliente?.razonSocial || order.cotizacion?.lead?.nombre || 'SIN CLIENTE';
  const clienteDoc = order.cotizacion?.cliente?.ruc || order.cotizacion?.lead?.ruc || 'SIN DOCUMENTO';
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 18, cardY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(clienteName, 35, cardY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('RUC / ID:', 18, cardY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(clienteDoc, 35, cardY + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('Incoterm:', 18, cardY + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(order.incoterm || 'N/A', 35, cardY + 27);

  // Right Column
  doc.setFont('helvetica', 'bold');
  doc.text('Nro. BL:', 110, cardY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(order.nroBL || 'N/A', 128, cardY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Nro. DAM:', 110, cardY + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(order.nroDAM || 'N/A', 128, cardY + 22);

  doc.setFont('helvetica', 'bold');
  doc.text('Modalidad:', 110, cardY + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(order.modalidad || 'N/A', 128, cardY + 27);

  // --- COLLECTIONS TABLE ---
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Cobros Recaudados', 15, cardY + 40);

  const tableRows = cobros.map((c: any) => {
    const fecha = c.fechaPago ? new Date(c.fechaPago).toLocaleDateString() : (c.fechaCobro ? new Date(c.fechaCobro).toLocaleDateString() : '-');
    const monto = Number(c.monto) || 0;
    const tc = Number(c.tipoCambio) || 1;
    const totalPEN = c.moneda === 'PEN' ? monto : monto * tc;

    return [
      fecha,
      c.modalidad || '-',
      c.referencia || '-',
      c.banco || '-',
      c.moneda,
      `${c.moneda === 'PEN' ? 'S/' : c.moneda === 'EUR' ? '€' : '$'} ${formatNum(monto)}`,
      formatNum(tc),
      `S/ ${formatNum(totalPEN)}`
    ];
  });

  autoTable(doc, {
    startY: cardY + 44,
    margin: { left: 15, right: 15 },
    head: [['Fecha', 'Modalidad', 'Referencia', 'Banco', 'Moneda', 'Monto', 'T.C.', 'Total PEN']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15 },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 15, halign: 'right' },
      7: { cellWidth: 35, halign: 'right' }
    }
  });

  // --- TOTALS CALCULATION & BOX ---
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Compute totals
  const currencyTotals: Record<string, number> = {};
  let grandTotalPEN = 0;

  cobros.forEach((c: any) => {
    const monto = Number(c.monto) || 0;
    const tc = Number(c.tipoCambio) || 1;
    const totalPEN = c.moneda === 'PEN' ? monto : monto * tc;
    
    grandTotalPEN += totalPEN;
    currencyTotals[c.moneda] = (currencyTotals[c.moneda] || 0) + monto;
  });

  // Right-aligned totals summary card
  const totalBoxW = 90;
  const totalBoxH = 12 + (Object.keys(currencyTotals).length * 5);
  const totalBoxX = pageWidth - 15 - totalBoxW;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(79, 70, 229); // Indigo-600
  doc.roundedRect(totalBoxX, finalY, totalBoxW, totalBoxH, 1, 1, 'FD');

  let currentTotalY = finalY + 5;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('RESUMEN DE RECAUDACIÓN', totalBoxX + 4, currentTotalY);
  doc.line(totalBoxX + 4, currentTotalY + 1.5, totalBoxX + totalBoxW - 4, currentTotalY + 1.5);

  currentTotalY += 5;
  doc.setFont('helvetica', 'semibold');
  doc.setTextColor(15, 23, 42);

  // Print subtotal for each currency present
  Object.entries(currencyTotals).forEach(([curr, sum]) => {
    const symbol = curr === 'PEN' ? 'S/' : curr === 'EUR' ? '€' : '$';
    doc.text(`Total en ${curr}:`, totalBoxX + 4, currentTotalY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${symbol} ${formatNum(sum)}`, totalBoxX + totalBoxW - 4, currentTotalY, { align: 'right' });
    doc.setFont('helvetica', 'semibold');
    currentTotalY += 5;
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text('TOTAL GENERAL (PEN):', totalBoxX + 4, currentTotalY + 1);
  doc.text(`S/ ${formatNum(grandTotalPEN)}`, totalBoxX + totalBoxW - 4, currentTotalY + 1, { align: 'right' });

  // --- FOOTER ---
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('© 2026 Forwarderly Systems. Este documento es un reporte consolidado oficial de cobranzas.', pageWidth / 2, 285, { align: 'center' });

  doc.save(`Liquidacion_${correlativoStr}.pdf`);
};
