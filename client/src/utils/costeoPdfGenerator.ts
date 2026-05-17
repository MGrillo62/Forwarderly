import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatNum = (val: number) => 
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

export const getCosteoCalculations = (formData: any, items: any[]) => {
  const totalFC = items.reduce((sum, i) => sum + (Number(i.valorTotal) || 0), 0);
  const isFob = formData.incoterm === 'FOB';
  const gOrigen = Number(formData.gastosOrigen || 0);
  const seguroVal = (!formData.seguro || Number(formData.seguro) === 0) ? totalFC * 0.02 : Number(formData.seguro);
  const cifG = (isFob ? totalFC : totalFC + gOrigen) + Number(formData.fleteInternacional || 0) + seguroVal;
  const tc = Number(formData.tipoCambio || 1);
  const hasItemAV = items.some(i => i.adValoremPorcentaje !== '' && Number(i.adValoremPorcentaje) > 0);
  const globalAV = Number(formData.adValoremGlobal || 0);
  const useGlobalAV = globalAV > 0 && !hasItemAV;

  let totalAV = 0;
  const finalItems = items.map(i => {
    const part = totalFC > 0 ? (Number(i.valorTotal) || 0) / totalFC : 0;
    const cifH = cifG * part;
    let avM = 0;
    if (useGlobalAV) {
      avM = cifH * (globalAV / 100);
    } else {
      avM = cifH * (Number(i.adValoremPorcentaje || 0) / 100);
    }
    totalAV += avM;
    const cTotal = (Number(i.valorTotal) || 0) + (Number(formData.fleteInternacional || 0) + seguroVal + gOrigen + Number(formData.gastosLocales || 0)) * part + avM;
    const cUnit = Number(i.cantidad) > 0 ? cTotal / Number(i.cantidad) : 0;
    const valVenta = (Number(i.precioVentaPEN || 0) * (1 - Number(i.descuentoPorcentaje || 0) / 100)) / 1.18;
    const uUnit = valVenta - (cUnit * tc);
    return { 
      ...i, 
      valorTotal: Number(i.valorTotal) || 0,
      adValoremMonto: avM, 
      costoTotalUnitario: cUnit, 
      costoUnitarioSoles: cUnit * tc, 
      utilidadUnitarioPEN: uUnit, 
      utilidadTotalPEN: uUnit * (Number(i.cantidad) || 0), 
      margenPorcentaje: valVenta > 0 ? (uUnit / valVenta) * 100 : 0 
    };
  });

  const actualAV = useGlobalAV ? cifG * (globalAV / 100) : totalAV;
  const baseImp = cifG + actualAV;
  const igv = baseImp * 0.16;
  const ipm = baseImp * 0.02;
  const perc = (baseImp + igv + ipm) * (Number(formData.percepcionPorcentaje || 0) / 100);
  const cTotalImp = totalFC + gOrigen + Number(formData.fleteInternacional || 0) + seguroVal + actualAV + Number(formData.gastosLocales || 0);
  const uTotalPEN = finalItems.reduce((sum, i) => sum + (i.utilidadTotalPEN || 0), 0);
  const ingTotalPEN = finalItems.reduce((sum, i) => sum + ((Number(i.precioVentaPEN || 0) * (1 - Number(i.descuentoPorcentaje || 0) / 100)) / 1.18) * Number(i.cantidad || 0), 0);

  return {
    totalFC, cifG, adValoremG: actualAV, igv, ipm, perc, cTotalImp,
    ratio: totalFC > 0 ? cTotalImp / totalFC : 0, finalItems,
    cTotalPEN: cTotalImp * tc, uTotalPEN, margProm: ingTotalPEN > 0 ? (uTotalPEN / ingTotalPEN) * 100 : 0,
    ingTotalPEN, seguroVal,
    totalOperativoOriginal: Number(formData.fleteInternacional || 0) + seguroVal + Number(formData.gastosLocales || 0) + gOrigen
  };
};

export const generateCosteoReportPDF = (costeo: any) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const itemsList = costeo.items || [];
  const calculations = getCosteoCalculations(costeo, itemsList);
  const clientName = costeo.clienteNombre || costeo.cliente?.razonSocial || 'SIN NOMBRE';
  const docCode = costeo.codigo || 'N/A';

  // --- PAGE 1 ---
  // Top Header Line
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Global Logistics & Financial Report', 15, 10);
  doc.line(15, 12, 195, 12);

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('REPORTE DE INTELIGENCIA', 15, 22);
  doc.text('LOGÍSTICA', 15, 30);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Análisis Consolidado de Importación y Rentabilidad Operativa', 15, 36);

  // Client and Doc ID
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Cliente: `, 15, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName, 30, 43);

  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENTO ID', 195, 22, { align: 'right' });
  doc.setFontSize(14);
  doc.text(docCode, 195, 28, { align: 'right' });

  // Metrics Row (4 Card rects)
  const rectW = 42;
  const rectH = 22;
  const gap = 4;
  const startX = 15;
  const startY = 48;

  const metrics = [
    { label: 'TOTAL INVERSIÓN (PEN)', value: `S/ ${formatNum(calculations.cTotalPEN)}` },
    { label: 'FOB VALUE (USD)', value: `$ ${formatNum(calculations.totalFC)}` },
    { label: 'ROI RATIO', value: `${formatNum(calculations.ratio)}x` },
    { label: 'MARGEN PROMEDIO', value: `${formatNum(calculations.margProm)}%` },
  ];

  metrics.forEach((m, idx) => {
    const x = startX + idx * (rectW + gap);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.roundedRect(x, startY, rectW, rectH, 3, 3, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 3, startY + 6);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(m.value, x + 3, startY + 15);
  });

  // Table 1: Detalle de Mercadería
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Detalle de Mercadería', 15, 78);

  // Badge Consolidado
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.roundedRect(173, 74, 22, 5, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('CONSOLIDADO', 184, 77.5, { align: 'center' });

  // Limit to first 4 items for Page 1
  const page1Items = itemsList.slice(0, 4);
  const showMoreMsg = itemsList.length > 4;

  const table1Rows = page1Items.map((i: any) => [
    i.sku || '-',
    i.producto || '-',
    String(i.cantidad),
    `$ ${formatNum(Number(i.valorUnitario) || 0)}`,
    `$ ${formatNum(Number(i.valorTotal) || 0)}`
  ]);

  autoTable(doc, {
    startY: 81,
    margin: { left: 15, right: 15 },
    head: [['SKU', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNIT (USD)', 'TOTAL (USD)']],
    body: table1Rows,
    theme: 'plain',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 70 },
      2: { cellWidth: 20 },
      3: { cellWidth: 32 },
      4: { cellWidth: 32 }
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 3;

  if (showMoreMsg) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'oblique');
    doc.setTextColor(148, 163, 184);
    doc.text('* La lista continúa en la siguiente página 2...', 15, currentY);
    currentY += 4;
  }

  // Side-by-Side: Tributos Aduaneros & Logística Operativa
  // We place them at currentY
  const boxW = 87;
  const boxH = 38;

  // Box Left: Tributos Aduaneros
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(241, 245, 249);
  doc.roundedRect(15, currentY, boxW, boxH, 4, 4, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Tributos Aduaneros', 20, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const isFob = costeo.incoterm === 'FOB';
  const adValPercent = Number(costeo.adValoremGlobal) || 0;
  
  doc.text(`Ad Valorem (${adValPercent}%)`, 20, currentY + 13);
  doc.text('IGV (16%)', 20, currentY + 18);
  doc.text('IPM (2%)', 20, currentY + 23);
  doc.text(`Percepción (${Number(costeo.percepcionPorcentaje || 0)}%)`, 20, currentY + 28);

  doc.setFont('helvetica', 'bold');
  doc.text(`S/ ${formatNum(calculations.adValoremG * (costeo.tipoCambio || 1))}`, 95, currentY + 13, { align: 'right' });
  doc.text(`S/ ${formatNum(calculations.igv * (costeo.tipoCambio || 1))}`, 95, currentY + 18, { align: 'right' });
  doc.text(`S/ ${formatNum(calculations.ipm * (costeo.tipoCambio || 1))}`, 95, currentY + 23, { align: 'right' });
  doc.text(`S/ ${formatNum(calculations.perc * (costeo.tipoCambio || 1))}`, 95, currentY + 28, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL IMPUESTOS', 20, currentY + 34);
  const totalTributosPEN = (calculations.adValoremG + calculations.igv + calculations.ipm + calculations.perc) * (costeo.tipoCambio || 1);
  doc.text(`S/ ${formatNum(totalTributosPEN)}`, 95, currentY + 34, { align: 'right' });

  // Box Right: Logística Operativa
  doc.roundedRect(108, currentY, boxW, boxH, 4, 4, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Logística Operativa', 113, currentY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text('Gastos de Origen', 113, currentY + 13);
  doc.text('Flete Internacional', 113, currentY + 18);
  doc.text('Seguro (Póliza)', 113, currentY + 23);
  doc.text('Gastos Locales', 113, currentY + 28);

  doc.setFont('helvetica', 'bold');
  doc.text(isFob ? 'N/A (FOB)' : `$ ${formatNum(Number(costeo.gastosOrigen) || 0)}`, 188, currentY + 13, { align: 'right' });
  doc.text(`$ ${formatNum(Number(costeo.fleteInternacional) || 0)}`, 188, currentY + 18, { align: 'right' });
  doc.text(`$ ${formatNum(calculations.seguroVal)}`, 188, currentY + 23, { align: 'right' });
  doc.text(`$ ${formatNum(Number(costeo.gastosLocales) || 0)}`, 188, currentY + 28, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL OPERATIVOS', 113, currentY + 34);
  doc.text(`$ ${formatNum(calculations.totalOperativoOriginal)}`, 188, currentY + 34, { align: 'right' });

  currentY += boxH + 8;

  // Table 2: Distribución de Costos y Proyección de Ventas
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribución de Costos y Proyección de Ventas', 15, currentY);

  const tc = Number(costeo.tipoCambio || 1);
  const table2Rows = page1Items.map((i: any) => {
    const calcItem = calculations.finalItems.find((fi: any) => fi.sku === i.sku) || i;
    const pricePen = Number(calcItem.precioVentaPEN) || 0;
    return [
      calcItem.producto || '-',
      `$ ${formatNum(calcItem.costoTotalUnitario || 0)}`,
      `${formatNum(calcItem.margenPorcentaje || 0)}%`,
      `S/ ${formatNum(pricePen)}`
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 15, right: 15 },
    head: [['PRODUCTO', 'COSTO UNIT (USD)', 'MARGEN %', 'PVP PROYECTADO (PEN)']],
    body: table2Rows,
    theme: 'plain',
    headStyles: {
      fillColor: [226, 232, 240], // Silver grey
      textColor: [15, 23, 42], // Slate black
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 40 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 3;

  if (showMoreMsg) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'oblique');
    doc.setTextColor(148, 163, 184);
    doc.text('* La lista continúa en la siguiente página 2...', 15, currentY);
    currentY += 4;
  }

  // Silver Grey Estimada Panel
  const panelH = 26;
  doc.setFillColor(226, 232, 240); // Silver grey
  doc.roundedRect(15, currentY, 180, panelH, 5, 5, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('RENTABILIDAD ESTIMADA DEL PROYECTO', 20, currentY + 6);

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900 (black)
  doc.text(`S/ ${formatNum(calculations.ingTotalPEN)}`, 20, currentY + 14);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Precio Venta Objetivo (PEN)', 20, currentY + 20);

  // Net Profit & Margen Real
  doc.setFont('helvetica', 'bold');
  doc.text('UTILIDAD NETA', 105, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(16, 124, 65); // green-700
  doc.text(`S/ ${formatNum(calculations.uTotalPEN)}`, 105, currentY + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('MARGEN REAL', 150, currentY + 6);
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(`${formatNum(calculations.margProm)}%`, 150, currentY + 13);

  // Footer page 1
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('© 2026 LOGISTICS AUDIT SYSTEMS', 15, 287);
  doc.text(`Document ID: ${docCode}`, 80, 287);
  doc.text('Terms of Service   Confidentiality Policy', 195, 287, { align: 'right' });

  // --- PAGE 2 (If more than 4 items) ---
  if (itemsList.length > 4) {
    doc.addPage();

    // Top Header Line
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Global Logistics & Financial Report - Anexo de Mercadería', 15, 10);
    doc.line(15, 12, 195, 12);

    // Title Page 2
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('DETALLE DE MERCADERÍA - CONTINUACIÓN', 15, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Cliente: `, 15, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 30, 28);

    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO ID', 195, 18, { align: 'right' });
    doc.setFontSize(12);
    doc.text(docCode, 195, 23, { align: 'right' });

    // Table 1 Page 2: remaining items
    const page2Items = itemsList.slice(4);
    const table1Page2Rows = page2Items.map((i: any) => [
      i.sku || '-',
      i.producto || '-',
      String(i.cantidad),
      `$ ${formatNum(Number(i.valorUnitario) || 0)}`,
      `$ ${formatNum(Number(i.valorTotal) || 0)}`
    ]);

    autoTable(doc, {
      startY: 33,
      margin: { left: 15, right: 15 },
      head: [['SKU', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNIT (USD)', 'TOTAL (USD)']],
      body: table1Page2Rows,
      theme: 'plain',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 70 },
        2: { cellWidth: 20 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 }
      }
    });

    let currentY2 = (doc as any).lastAutoTable.finalY + 12;

    // Table 2 Page 2: remaining item margins
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUCIÓN DE COSTOS - CONTINUACIÓN', 15, currentY2);

    const table2Page2Rows = page2Items.map((i: any) => {
      const calcItem = calculations.finalItems.find((fi: any) => fi.sku === i.sku) || i;
      const pricePen = Number(calcItem.precioVentaPEN) || 0;
      return [
        calcItem.producto || '-',
        `$ ${formatNum(calcItem.costoTotalUnitario || 0)}`,
        `${formatNum(calcItem.margenPorcentaje || 0)}%`,
        `S/ ${formatNum(pricePen)}`
      ];
    });

    autoTable(doc, {
      startY: currentY2 + 5,
      margin: { left: 15, right: 15 },
      head: [['PRODUCTO', 'COSTO UNIT (USD)', 'MARGEN %', 'PVP PROYECTADO (PEN)']],
      body: table2Page2Rows,
      theme: 'plain',
      headStyles: {
        fillColor: [226, 232, 240], // Silver grey
        textColor: [15, 23, 42], // Slate black
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 }
      }
    });

    // Footer page 2
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('© 2026 LOGISTICS AUDIT SYSTEMS', 15, 287);
    doc.text(`Document ID: ${docCode}`, 80, 287);
    doc.text('Terms of Service   Confidentiality Policy', 195, 287, { align: 'right' });
  }

  doc.save(`Reporte_Inteligencia_Logistica_${docCode}.pdf`);
};
