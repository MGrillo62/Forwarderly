import jsPDF from 'jspdf';

const formatNum = (val: number) => 
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export const generateLiquidacionPDF = (order: any, cobros: any[], logoBase64: string | null = null) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- CLIENT NAME LOGIC ---
  const getClientName = () => {
    if (order.cotizacion) {
      return order.cotizacion.cliente?.razonSocial || order.cotizacion.lead?.nombre || order.cotizacion.lead?.contacto || 'SIN CLIENTE';
    }
    if (order.cotizacionesAsociadas && order.cotizacionesAsociadas.length > 0) {
      const names = order.cotizacionesAsociadas.map((c: any) => c.cliente?.razonSocial || c.lead?.nombre || c.lead?.contacto).filter(Boolean);
      const uniqueNames = Array.from(new Set(names));
      return uniqueNames.join(' / ') || 'SIN CLIENTE';
    }
    return 'SIN CLIENTE';
  };
  const clienteName = getClientName();

  // --- HEADER SECTION ---
  let startY = 18;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 15, 12, 35, 10);
      startY = 28;
    } catch (e) {
      console.error('Error drawing logo:', e);
      startY = 18;
    }
  }

  // Title left aligned
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`LIQUIDACIÓN DE COBRANZA — ORD-${order.correlativo}`, 15, startY);

  // Client info below title (Large client name)
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Cliente:', 15, startY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13); // Large text for the client's name
  doc.text(clienteName, 29, startY + 7);

  // State in the top right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('ESTADO DEL DOCUMENTO', 195, startY - 3, { align: 'right' });

  // Badge background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(162, startY - 1.5, 33, 5, 0.5, 0.5, 'F');
  // Badge text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CONSOLIDADO', 178.5, startY + 2.2, { align: 'center' });

  // Separator Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(15, startY + 11, 195, startY + 11);

  // --- TOTALS CALCULATION ---
  const lines: any[] = [];
  if (order.cotizacion?.lineas) {
    order.cotizacion.lineas.forEach((l: any) => {
      lines.push({
        ...l,
        moneda: order.cotizacion.moneda,
        cotizacionNumero: order.cotizacion.numero
      });
    });
  }
  if (order.cotizacionesAsociadas) {
    order.cotizacionesAsociadas.forEach((c: any) => {
      if (c.lineas) {
        c.lineas.forEach((l: any) => {
          lines.push({
            ...l,
            moneda: c.moneda,
            cotizacionNumero: c.numero
          });
        });
      }
    });
  }

  let usdTotal = 0;
  let penTotal = 0;
  let eurTotal = 0;

  lines.forEach((l: any) => {
    const val = Number(l.precioVenta) || 0;
    if (l.moneda === 'USD') usdTotal += val;
    else if (l.moneda === 'PEN') penTotal += val;
    else if (l.moneda === 'EUR') eurTotal += val;
  });

  let totalTributosPEN = 0;
  if (order.costeo) {
    const tcCosteo = Number(order.costeo.tipoCambio) || 1;
    const adValorem = (Number(order.costeo.adValoremGlobal) || 0) * tcCosteo;
    const igv = (Number(order.costeo.igv) || 0) * tcCosteo;
    const ipm = (Number(order.costeo.ipm) || 0) * tcCosteo;
    const percepcion = (Number(order.costeo.percepcionMonto) || 0) * tcCosteo;
    totalTributosPEN = adValorem + igv + ipm + percepcion;
  }
  penTotal += totalTributosPEN;

  let usdCobrado = 0;
  let penCobrado = 0;
  let eurCobrado = 0;

  cobros.forEach((c: any) => {
    const val = Number(c.monto) || 0;
    if (c.moneda === 'USD') usdCobrado += val;
    else if (c.moneda === 'PEN') penCobrado += val;
    else if (c.moneda === 'EUR') eurCobrado += val;
  });

  const legacyPayments = order.pagos?.reduce((acc: number, p: any) => acc + (Number(p.monto) || 0), 0) || 0;
  penCobrado += legacyPayments;

  const usdPending = Math.max(0, usdTotal - usdCobrado);
  const penPending = Math.max(0, penTotal - penCobrado);

  // --- SECTION 1: SALDOS SEGREGADOS POR MONEDA ---
  const sec1Y = startY + 18;
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(15, sec1Y - 3, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('SALDOS SEGREGADOS POR MONEDA', 20, sec1Y - 0.5);

  // Cards layout: side by side
  // Left: USD Card
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, sec1Y + 3, 87, 26, 1, 1, 'FD');
  // Card Header Fill
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(15.1, 41.1 + (sec1Y - 38), 86.8, 6.5, 1, 1, 'F');
  // Header line
  doc.setDrawColor(219, 234, 254); // blue-100
  doc.line(15, sec1Y + 9.5, 102, sec1Y + 9.5);
  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('USD ($)', 19, sec1Y + 7.5);

  // USD Values
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.text('Total:', 19, sec1Y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`$ ${formatNum(usdTotal)}`, 98, sec1Y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Cobrado:', 19, sec1Y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text(`$ ${formatNum(usdCobrado)}`, 98, sec1Y + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Pendiente:', 19, sec1Y + 24);
  doc.setFont('helvetica', 'bold');
  if (usdPending > 0.01) {
    doc.setTextColor(239, 68, 68); // red-500
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`$ ${formatNum(usdPending)}`, 98, sec1Y + 24, { align: 'right' });

  // Right: PEN Card
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(108, sec1Y + 3, 87, 26, 1, 1, 'FD');
  // Card Header Fill
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(108.1, 41.1 + (sec1Y - 38), 86.8, 6.5, 1, 1, 'F');
  // Header line
  doc.setDrawColor(219, 234, 254);
  doc.line(108, sec1Y + 9.5, 195, sec1Y + 9.5);
  // Header text
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text('PEN (S/)', 112, sec1Y + 7.5);

  // PEN Values
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Total:', 112, sec1Y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`S/ ${formatNum(penTotal)}`, 191, sec1Y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Cobrado:', 112, sec1Y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`S/ ${formatNum(penCobrado)}`, 191, sec1Y + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Pendiente:', 112, sec1Y + 24);
  doc.setFont('helvetica', 'bold');
  if (penPending > 0.01) {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`S/ ${formatNum(penPending)}`, 191, sec1Y + 24, { align: 'right' });

  // --- SECTION 2: CONCEPTOS DEL DESPACHO A COBRAR ---
  const sec2Y = sec1Y + 38;
  doc.setFillColor(79, 70, 229);
  doc.rect(15, sec2Y - 3, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('CONCEPTOS DEL DESPACHO A COBRAR', 20, sec2Y - 0.5);

  // Table Header (Removed COBRAR column)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(15, sec2Y + 2, 180, 7.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(15, sec2Y + 2, 195, sec2Y + 2);
  doc.line(15, sec2Y + 9.5, 195, sec2Y + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CONCEPTO / DOCUMENTO', 15, sec2Y + 7);
  doc.text('VENTA', 191, sec2Y + 7, { align: 'right' });

  // Parse billing documents from cobros as fallback
  const lineDocs: Record<string, { tipoDocumento: string, nroDocumento: string, fechaDocumento: string }> = {};
  cobros.forEach((c: any) => {
    if (c.detallesLineas) {
      try {
        const parsed = typeof c.detallesLineas === 'string' ? JSON.parse(c.detallesLineas) : c.detallesLineas;
        Object.assign(lineDocs, parsed);
      } catch (e) {
        console.error('Error parsing detallesLineas:', e);
      }
    }
  });

  // Concept Rows (Single line representation)
  let currentY = sec2Y + 9.5;
  const rowHeight = 9.5;

  lines.forEach((l: any) => {
    // Bottom line
    doc.setDrawColor(241, 245, 249);
    doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

    // Concept text (bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(l.concepto?.nombre || 'Concepto General', 15, currentY + 6.2);
    const conceptW = doc.getTextWidth(l.concepto?.nombre || 'Concepto General');

    // Cot reference (normal slate-400)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    const cotLabel = `Cot: ${String(l.cotizacionNumero).padStart(5, '0')}`;
    doc.text(cotLabel, 15 + conceptW + 2.5, currentY + 6.2);
    const cotW = doc.getTextWidth(cotLabel);

    // Fetch document details (saved on concept line directly, fallback to cobros history)
    const docTipo = l.tipoDocumento || lineDocs[l.id]?.tipoDocumento || 'FACTURA';
    const docNro = l.nroDocumento || lineDocs[l.id]?.nroDocumento || '';
    const docFecha = l.fechaDocumento || lineDocs[l.id]?.fechaDocumento || '';

    let docStr = '';
    if (docNro) {
      const formattedDate = docFecha ? new Date(docFecha).toLocaleDateString('es-PE') : '';
      docStr = `  |  ${docTipo}: ${docNro}${formattedDate ? ` (${formattedDate})` : ''}`;
    }

    if (docStr) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(docStr, 15 + conceptW + 2.5 + cotW + 2.5, currentY + 6.2);
    }

    // Amount
    const symbol = l.moneda === 'PEN' ? 'S/' : l.moneda === 'EUR' ? '€' : '$';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235);
    doc.text(`${symbol} ${formatNum(l.precioVenta)}`, 191, currentY + 6.2, { align: 'right' });

    currentY += rowHeight;
  });

  // --- SECTION 3: HISTORIAL DE TRANSACCIONES ---
  const sec3Y = currentY + 8;
  
  // Helper to draw the transaction table header
  const drawTransHeader = (y: number) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y + 2, 180, 7.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 2, 195, y + 2);
    doc.line(15, y + 9.5, 195, y + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('FECHA', 18, y + 7);
    doc.text('MÉTODO / REFERENCIA', 50, y + 7);
    doc.text('COBRADO', 165, y + 7, { align: 'right' });
    doc.text('T.C.', 191, y + 7, { align: 'right' });
  };

  // Helper to draw a single transaction row
  const drawTransRow = (c: any, y: number) => {
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 18, 195, y + 18);

    // Date
    const cDate = c.createdAt 
      ? new Date(c.createdAt).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(cDate, 18, y + 10);

    // Badge Method
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(50, y + 3, 28, 4.5, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(255, 255, 255);
    doc.text(c.metodo || 'TRANSFERENCIA', 64, y + 6.2, { align: 'center' });

    // Ref and Bank
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(15, 23, 42);
    doc.text(`Ref: ${c.referencia || '-'}`, 50, y + 11.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Banco: ${c.banco || '-'}`, 50, y + 15.5);

    // Amount Cobrado
    const symbol = c.moneda === 'PEN' ? 'S/' : c.moneda === 'EUR' ? '€' : '$';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${symbol} ${formatNum(c.monto)}`, 165, y + 10, { align: 'right' });

    // T.C.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(formatNum(c.tipoCambio || 1), 191, y + 10, { align: 'right' });
  };

  // Helper to draw bottom notes and signature box
  const drawNotesAndSignature = (y: number) => {
    // Top line separator for footer elements
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 5, 195, y + 5);

    // Notes on the left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTAS DEL LIQUIDADOR', 15, y + 11);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184); // slate-400
    const noteText = `Documento generado automáticamente por el sistema de gestión de cobranzas. Los montos reflejados corresponden a la liquidación final autorizada para el despacho ORD-${order.correlativo}.`;
    doc.text(noteText, 15, y + 15, { maxWidth: 105 });

    // Signature on the right
    doc.setDrawColor(148, 163, 184);
    doc.line(135, y + 21, 191, y + 21);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('FIRMA AUTORIZADA', 163, y + 25, { align: 'center' });
  };

  // Helper to draw generic footer (run on all pages)
  const drawPageFooter = (page: number) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('© 2026 Forwarderly Systems. Este documento es un reporte consolidado oficial de cobranzas.', pageWidth / 2, 285, { align: 'center' });
  };

  // PAGINATION IMPLEMENTATION
  const hasMoreThanThree = cobros.length > 3;

  if (!hasMoreThanThree) {
    // --- ALL FITS ON PAGE 1 ---
    doc.setFillColor(79, 70, 229);
    doc.rect(15, sec3Y - 3, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text('HISTORIAL DE TRANSACCIONES REGISTRADAS', 20, sec3Y - 0.5);

    drawTransHeader(sec3Y);

    let transY = sec3Y + 9.5;
    cobros.forEach((c: any) => {
      drawTransRow(c, transY);
      transY += 18.5;
    });

    // Draw notes and signature below
    drawNotesAndSignature(transY + 3);
    drawPageFooter(1);

  } else {
    // --- MULTIPAGE SETUP: FIRST 3 ROWS ON PAGE 1, OTHERS ON PAGE 2 ---
    // --- PAGE 1 ---
    doc.setFillColor(79, 70, 229);
    doc.rect(15, sec3Y - 3, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text('HISTORIAL DE TRANSACCIONES REGISTRADAS', 20, sec3Y - 0.5);

    drawTransHeader(sec3Y);

    let transY = sec3Y + 9.5;
    const page1Cobros = cobros.slice(0, 3);
    page1Cobros.forEach((c: any) => {
      drawTransRow(c, transY);
      transY += 18.5;
    });

    // "Sigue en la siguiente página" text
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text('Sigue en la siguiente página...', 191, transY + 6, { align: 'right' });

    drawPageFooter(1);

    // --- PAGE 2 ---
    doc.addPage();
    
    // Top mini header
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Forwarderly Financial Systems — Settlement Report', 15, 10);
    doc.line(15, 12, 195, 12);

    // Title Page 2
    const page2TitleY = 22;
    doc.setFillColor(79, 70, 229);
    doc.rect(15, page2TitleY - 3, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text('HISTORIAL DE TRANSACCIONES REGISTRADAS (Continuación)', 20, page2TitleY - 0.5);

    drawTransHeader(page2TitleY);

    let transPage2Y = page2TitleY + 9.5;
    const page2Cobros = cobros.slice(3);
    page2Cobros.forEach((c: any) => {
      drawTransRow(c, transPage2Y);
      transPage2Y += 18.5;
    });

    // Draw notes and signature at the end of page 2
    drawNotesAndSignature(transPage2Y + 4);
    drawPageFooter(2);
  }

  // --- SAVE DOCUMENT ---
  const correlativoStr = `ORD-${String(order.correlativo).padStart(4, '0')}-${order.anio}`;
  doc.save(`Liquidacion_${correlativoStr}.pdf`);
};
