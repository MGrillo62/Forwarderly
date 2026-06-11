import jsPDF from 'jspdf';

const formatNum = (val: number) => 
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export const generateLiquidacionPDF = (order: any, cobros: any[], logoBase64: string | null = null, activeEmpresa: any = null) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

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
      const imgProps = doc.getImageProperties(logoBase64);
      const aspect = imgProps.width / imgProps.height;
      let logoWidth = 40;
      let logoHeight = logoWidth / aspect;
      if (logoHeight > 12) {
        logoHeight = 12;
        logoWidth = logoHeight * aspect;
      }
      
      doc.addImage(logoBase64, 'PNG', 15, 10, logoWidth, logoHeight);
      startY = 10 + logoHeight + 8; // Adjust startY dynamically based on logo height
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

  // Dynamic layout coordinates
  let currentY = startY + 18;
  let pageNumber = 1;

  // Helper to draw generic footer
  const drawPageFooter = (page: number) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`© 2026 Forwarderly Systems. Este documento es un reporte consolidado oficial de cobranzas. | Página ${page}`, pageWidth / 2, 285, { align: 'center' });
  };

  // Helper to check space and page-break
  const checkSpace = (neededHeight: number) => {
    if (currentY + neededHeight > 265) {
      drawPageFooter(pageNumber);
      doc.addPage();
      pageNumber++;
      
      // Top mini header
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Forwarderly Financial Systems — Reporte de Liquidación de Cobranza', 15, 10);
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 12, 195, 12);
      
      currentY = 20; // Reset Y on new page
    }
  };

  // --- SECTION 1: SALDOS SEGREGADOS POR MONEDA ---
  checkSpace(36);
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(15, currentY - 3, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('SALDOS SEGREGADOS POR MONEDA', 20, currentY - 0.5);

  // Left: USD Card
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, currentY + 3, 87, 26, 1, 1, 'FD');
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(15.1, currentY + 3.1, 86.8, 6.5, 1, 1, 'F');
  doc.setDrawColor(219, 234, 254); // blue-100
  doc.line(15, currentY + 9.5, 102, currentY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text('USD ($)', 19, currentY + 7.5);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Total:', 19, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`$ ${formatNum(usdTotal)}`, 98, currentY + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Cobrado:', 19, currentY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`$ ${formatNum(usdCobrado)}`, 98, currentY + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Pendiente:', 19, currentY + 24);
  doc.setFont('helvetica', 'bold');
  if (usdPending > 0.01) {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`$ ${formatNum(usdPending)}`, 98, currentY + 24, { align: 'right' });

  // Right: PEN Card
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(108, currentY + 3, 87, 26, 1, 1, 'FD');
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(108.1, currentY + 3.1, 86.8, 6.5, 1, 1, 'F');
  doc.setDrawColor(219, 234, 254);
  doc.line(108, currentY + 9.5, 195, currentY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text('PEN (S/)', 112, currentY + 7.5);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Total:', 112, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`S/ ${formatNum(penTotal)}`, 191, currentY + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Cobrado:', 112, currentY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`S/ ${formatNum(penCobrado)}`, 191, currentY + 19, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Pendiente:', 112, currentY + 24);
  doc.setFont('helvetica', 'bold');
  if (penPending > 0.01) {
    doc.setTextColor(239, 68, 68);
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`S/ ${formatNum(penPending)}`, 191, currentY + 24, { align: 'right' });

  currentY += 35;

  // --- SECTION 2: CONCEPTOS DEL DESPACHO A COBRAR (Grouped by Category) ---
  checkSpace(20);
  doc.setFillColor(79, 70, 229);
  doc.rect(15, currentY - 3, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('CONCEPTOS DEL DESPACHO A COBRAR', 20, currentY - 0.5);

  // Table Header
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(15, currentY + 2, 180, 7.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(15, currentY + 2, 195, currentY + 2);
  doc.line(15, currentY + 9.5, 195, currentY + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CONCEPTO / DOCUMENTO', 17, currentY + 7);
  doc.text('VALOR VENTA', 115, currentY + 7, { align: 'right' });
  doc.text('IGV', 150, currentY + 7, { align: 'right' });
  doc.text('PRECIO VENTA', 193, currentY + 7, { align: 'right' });

  currentY += 9.5;

  // Grouping lines by category
  const groupedLines: Record<string, any[]> = {};
  lines.forEach((l: any) => {
    const catName = l.concepto?.categoria?.nombre || 'Otros Conceptos';
    if (!groupedLines[catName]) {
      groupedLines[catName] = [];
    }
    groupedLines[catName].push(l);
  });

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

  Object.entries(groupedLines).forEach(([categoryName, catLines]) => {
    // Draw Category Sub-Header
    checkSpace(8);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(15, currentY, 180, 7, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY + 7, 195, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Categoría: ${categoryName}`, 17, currentY + 4.8);

    currentY += 7;

    // Draw Category Items
    catLines.forEach((l: any) => {
      checkSpace(9.5);
      
      // Bottom line of row
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 9.5, 195, currentY + 9.5);

      // Concept text (bold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(l.concepto?.nombre || 'Concepto General', 17, currentY + 6);
      const conceptW = doc.getTextWidth(l.concepto?.nombre || 'Concepto General');

      // Cot reference (normal slate-400)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      const cotLabel = `Cot: ${String(l.cotizacionNumero).padStart(5, '0')}`;
      doc.text(cotLabel, 17 + conceptW + 2.5, currentY + 6);
      const cotW = doc.getTextWidth(cotLabel);

      // Fetch document details
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
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(docStr, 17 + conceptW + 2.5 + cotW + 2.5, currentY + 6);
      }

      const symbol = l.moneda === 'PEN' ? 'S/' : l.moneda === 'EUR' ? '€' : '$';

      // Valor Venta
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`${symbol} ${formatNum(l.valorVenta ?? l.precioVenta)}`, 115, currentY + 6, { align: 'right' });

      // IGV (si corresponde)
      doc.text(l.igv > 0.001 ? `${symbol} ${formatNum(l.igv)}` : '-', 150, currentY + 6, { align: 'right' });

      // Precio Venta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(`${symbol} ${formatNum(l.precioVenta)}`, 193, currentY + 6, { align: 'right' });

      currentY += 9.5;
    });
  });

  currentY += 6;

  // --- SECTION 3: HISTORIAL DE TRANSACCIONES ---
  checkSpace(20);
  doc.setFillColor(79, 70, 229);
  doc.rect(15, currentY - 3, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('HISTORIAL DE TRANSACCIONES REGISTRADAS', 20, currentY - 0.5);

  // Helper to draw transaction table header
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

  drawTransHeader(currentY);
  currentY += 9.5;

  if (cobros.length === 0) {
    checkSpace(12);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('No hay transacciones registradas para esta orden.', 18, currentY + 6);
    currentY += 12;
  } else {
    cobros.forEach((c: any) => {
      checkSpace(18.5);
      drawTransRow(c, currentY);
      currentY += 18.5;
    });
  }

  currentY += 4;

  // --- SECTION 4: CUENTAS BANCARIAS PARA TRANSFERENCIA ---
  let cuentasList: any[] = [];
  if (activeEmpresa?.cuentasBancarias) {
    try {
      const parsed = typeof activeEmpresa.cuentasBancarias === 'string'
        ? JSON.parse(activeEmpresa.cuentasBancarias)
        : activeEmpresa.cuentasBancarias;
      if (Array.isArray(parsed)) {
        cuentasList = parsed;
      }
    } catch (e) {
      console.error('Error parsing cuentasBancarias:', e);
    }
  }

  if (cuentasList.length > 0) {
    const requiredHeight = 15 + (cuentasList.length * 8.5);
    checkSpace(requiredHeight);

    doc.setFillColor(79, 70, 229);
    doc.rect(15, currentY - 3, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(79, 70, 229);
    doc.text('CUENTAS BANCARIAS PARA TRANSFERENCIA', 20, currentY - 0.5);

    // Table Header for accounts
    doc.setFillColor(248, 250, 252);
    doc.rect(15, currentY + 2, 180, 6.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY + 2, 195, currentY + 2);
    doc.line(15, currentY + 8.5, 195, currentY + 8.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('BANCO', 18, currentY + 6.2);
    doc.text('MONEDA', 50, currentY + 6.2);
    doc.text('TIPO DE CUENTA', 80, currentY + 6.2);
    doc.text('NRO. DE CUENTA', 115, currentY + 6.2);
    doc.text('CCI', 155, currentY + 6.2);

    currentY += 8.5;

    cuentasList.forEach((cuenta: any) => {
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 7.5, 195, currentY + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(cuenta.banco || '-', 18, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(cuenta.moneda || '-', 50, currentY + 5);
      doc.text(cuenta.tipoCuenta || '-', 80, currentY + 5);
      doc.text(cuenta.nroCuenta || '-', 115, currentY + 5);
      doc.text(cuenta.cci || '-', 155, currentY + 5);

      currentY += 7.5;
    });

    currentY += 4;
  }

  // --- FOOTER NOTES AND SIGNATURE BOX ---
  checkSpace(35);

  const getNotesText = () => {
    if (activeEmpresa?.notasLiquidador && activeEmpresa.notasLiquidador.trim() !== '') {
      return activeEmpresa.notasLiquidador.replace(/ORD-1/g, `ORD-${order.correlativo}`);
    }
    return `Documento generado automáticamente por el sistema de gestión de cobranzas. Los montos reflejados corresponden a la liquidación final autorizada para el despacho ORD-${order.correlativo}.`;
  };

  const drawNotesAndSignature = (y: number) => {
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(15, y + 5, 195, y + 5);

    // Notes Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTAS DEL LIQUIDADOR', 15, y + 11);

    // Notes Content
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184); // slate-400
    const noteText = getNotesText();
    doc.text(noteText, 15, y + 15, { maxWidth: 105 });

    // Signature box
    doc.setDrawColor(148, 163, 184);
    doc.line(135, y + 21, 191, y + 21);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('FIRMA AUTORIZADA', 163, y + 25, { align: 'center' });
  };

  drawNotesAndSignature(currentY);
  drawPageFooter(pageNumber);

  // --- SAVE DOCUMENT ---
  const correlativoStr = `ORD-${String(order.correlativo).padStart(4, '0')}-${order.anio}`;
  doc.save(`Liquidacion_${correlativoStr}.pdf`);
};
