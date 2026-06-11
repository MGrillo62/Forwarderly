import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateQuotationPDF = (cotizacion: any, logoBase64: string | null = null, currentUser: any = null) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  const pageWidth = doc.internal.pageSize.getWidth(); // A4 is 210mm wide

  // Determine positions based on logo presence
  const showLogo = !!logoBase64;
  const titleY = showLogo ? 30 : 22;
  const subtitleY = showLogo ? 35 : 27;
  const cardY = showLogo ? 10 : 12;
  const cardH = 26; // Height of metadata card (4 rows: Nro, Fecha, Estado, Usuario)
  const cardW = 60;
  const cardX = pageWidth - 15 - cardW; // X: 135

  // Header Logo
  if (showLogo) {
    try {
      const imgProps = doc.getImageProperties(logoBase64);
      const aspect = imgProps.width / imgProps.height;
      let logoWidth = 35;
      let logoHeight = logoWidth / aspect;
      if (logoHeight > 12) {
        logoHeight = 12;
        logoWidth = logoHeight * aspect;
      }
      doc.addImage(logoBase64, 'PNG', 15, 10, logoWidth, logoHeight);
    } catch (e) {
      console.error('Error drawing logo in Quotation PDF:', e);
    }
  }

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Deep dark blue/black
  doc.text('DETALLE DE COTIZACIÓN', 15, titleY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('DOCUMENTO OFICIAL DE GESTIÓN LOGÍSTICA', 15, subtitleY);

  // Metadata Card (Top-Right)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // Slate gray for labels

  doc.text('NRO. COTIZ:', cardX + 4, cardY + 6);
  doc.text('FECHA:', cardX + 4, cardY + 12);
  doc.text('ESTADO:', cardX + 4, cardY + 18);
  doc.text('USUARIO:', cardX + 4, cardY + 24);

  // Values
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42); // Dark slate for values
  const numStr = `#${String(cotizacion.numero).padStart(5, '0')}`;
  const estadoStr = cotizacion.estado || 'BORRADOR';
  const userStr = cotizacion.vendedor ? `${cotizacion.vendedor.nombres}` : 'S/V';

  // Find exact date/time when this status was set
  const statusHistory = cotizacion.historial || [];
  const matchedHistory = [...statusHistory].reverse().find((h: any) => h.estado === estadoStr);
  const statusDate = matchedHistory ? new Date(matchedHistory.fechaHora) : new Date(cotizacion.createdAt);
  const dateStr = `${statusDate.toLocaleDateString('es-PE')} ${statusDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;

  doc.setFont('helvetica', 'bold');
  doc.text(numStr, cardX + cardW - 4, cardY + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, cardX + cardW - 4, cardY + 12, { align: 'right' });

  // Highlight the status (Requested addition)
  if (estadoStr === 'APROBADA') {
    doc.setTextColor(22, 163, 74); // Green
  } else if (estadoStr === 'RECHAZADA') {
    doc.setTextColor(220, 38, 38); // Red
  } else if (estadoStr === 'ENVIADA') {
    doc.setTextColor(37, 99, 235); // Blue
  } else {
    doc.setTextColor(71, 85, 105); // Slate gray for BORRADOR
  }
  doc.setFont('helvetica', 'bold');
  doc.text(estadoStr, cardX + cardW - 4, cardY + 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(userStr, cardX + cardW - 4, cardY + 24, { align: 'right' });

  // Y coordinate for customer/currency info cards
  const yCards = Math.max(showLogo ? 42 : 44, subtitleY + 8);

  // Separator Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, yCards - 5, pageWidth - 15, yCards - 5);

  // Customer Card (Left)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(15, yCards, 110, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('CLIENTE / PROSPECTO', 19, yCards + 6);

  const targetName = cotizacion.cliente
    ? cotizacion.cliente.razonSocial
    : (cotizacion.lead?.razonSocial || cotizacion.lead?.nombre || cotizacion.lead?.contacto || 'S/N');
  const targetRuc = cotizacion.cliente?.ruc || cotizacion.lead?.ruc || '—';
  const targetCorreo = cotizacion.cliente?.correo || cotizacion.lead?.correo || '—';
  const targetTelefono = cotizacion.cliente?.celular || cotizacion.lead?.celular || '—';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Dark slate

  // Split and wrap text if customer name is extremely long
  const wrappedClientName = doc.splitTextToSize(targetName, 102);
  doc.text(wrappedClientName, 19, yCards + 12);

  const clientNameHeight = wrappedClientName.length * 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const detailsStartY = yCards + 12 + clientNameHeight + 0.5;
  doc.text(`RUC: ${targetRuc}`, 19, detailsStartY);
  doc.text(`Correo: ${targetCorreo}`, 19, detailsStartY + 4.5);
  doc.text(`Teléfono: ${targetTelefono}`, 19, detailsStartY + 9);

  // Currency Card (Right)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(130, yCards, 65, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('MONEDA', 134, yCards + 6);

  const currencySymbol = cotizacion.moneda === 'PEN' ? 'S/' : cotizacion.moneda === 'EUR' ? '€' : '$';
  const currencyName = cotizacion.moneda === 'PEN' ? 'PEN (S/)' : cotizacion.moneda === 'EUR' ? 'EUR (€)' : 'USD ($)';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(currencyName, 134, yCards + 12);

  // Logistics Details within the card
  if (cotizacion.tipoCarga || cotizacion.incoterm || cotizacion.origen?.nombre || cotizacion.destino?.nombre) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    let detailsTextY = yCards + 18;
    if (cotizacion.tipoCarga || cotizacion.incoterm) {
      const cargoInco = [cotizacion.tipoCarga, cotizacion.incoterm].filter(Boolean).join(' / ');
      doc.text(`Carga/Inco: ${cargoInco}`, 134, detailsTextY);
      detailsTextY += 4.5;
    }
    if (cotizacion.origen?.nombre) {
      const origText = doc.splitTextToSize(`Origen: ${cotizacion.origen.nombre}`, 58);
      doc.text(origText, 134, detailsTextY);
      detailsTextY += origText.length * 4.5;
    }
    if (cotizacion.destino?.nombre) {
      const destText = doc.splitTextToSize(`Destino: ${cotizacion.destino.nombre}`, 58);
      doc.text(destText, 134, detailsTextY);
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Precios de servicios', 134, yCards + 20);
    doc.text('expresados en la', 134, yCards + 24.5);
    doc.text('moneda indicada.', 134, yCards + 29);
  }

  // Table (Start at yCards + 37)
  const symbol = currencySymbol;
  
  // Grouping lines by category
  const groupedLines: Record<string, any[]> = {};
  cotizacion.lineas.forEach((l: any) => {
    const catName = l.concepto?.categoria?.nombre || l.categoriaNombre || 'Otros Conceptos';
    if (!groupedLines[catName]) {
      groupedLines[catName] = [];
    }
    groupedLines[catName].push(l);
  });

  const tableRows: any[] = [];
  
  Object.entries(groupedLines).forEach(([categoryName, catLines]) => {
    // Add category sub-header row
    tableRows.push([
      {
        content: `CATEGORÍA: ${categoryName.toUpperCase()}`,
        colSpan: 4,
        styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [71, 85, 105], fontSize: 8 }
      }
    ]);
    
    // Add concepts belonging to this category
    catLines.forEach((l: any) => {
      tableRows.push([
        l.concepto?.nombre || l.conceptoNombre || '—',
        `${symbol} ${(l.valorVenta ?? l.precioVenta).toFixed(2)}`,
        l.igv > 0.001 ? `${symbol} ${l.igv.toFixed(2)}` : '-',
        `${symbol} ${l.precioVenta.toFixed(2)}`
      ]);
    });
  });

  autoTable(doc, {
    startY: yCards + 37,
    head: [['CONCEPTO', 'VALOR VENTA', 'IGV', 'PRECIO VENTA']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      lineColor: [226, 232, 240], // Light gray borders
      lineWidth: 0.1,
      textColor: [51, 65, 85], // Slate dark gray
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [241, 245, 249], // Slate white-gray
      textColor: [15, 23, 42], // Slate black
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 90, halign: 'left' },  // Concept
      1: { cellWidth: 30, halign: 'right' }, // Sale Value
      2: { cellWidth: 30, halign: 'right' }, // IGV
      3: { cellWidth: 30, halign: 'right' }  // Sale Price
    }
  });

  // Table end Y coordinate and page
  const finalY = (doc as any).lastAutoTable.finalY || (yCards + 37 + 15);
  const tableEndPage = doc.getNumberOfPages();

  // If table spans multiple pages, print the continuation note on Page 1
  if (tableEndPage > 1) {
    const origPage = doc.getNumberOfPages();
    doc.setPage(1);
    doc.setFont('helvetica', 'oblique');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('La lista continúa en la página 2', pageWidth - 15, 280, { align: 'right' });
    doc.setPage(origPage);
  }

  // Determine if we need to start totals on a new page to prevent overflow / cut off
  let totalsY = finalY + 10;
  if (totalsY + 60 > 280) {
    doc.addPage();
    totalsY = 20; // Start at the top of the new page
  }

  // Draw Left Card (Totals details)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, totalsY, 105, 34, 2, 2, 'FD');

  // Col 1: TOTAL VALOR VENTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL VALOR VENTA', 25, totalsY + 11);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${symbol} ${cotizacion.totalVenta.toFixed(2)}`, 25, totalsY + 22);

  // Col 2: IGV (18%)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('IGV (18%)', 75, totalsY + 11);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${symbol} ${cotizacion.igv.toFixed(2)}`, 75, totalsY + 22);

  // Draw Right Card (Precio Total)
  doc.setFillColor(15, 23, 42); // Dark slate blue
  doc.roundedRect(125, totalsY, 70, 34, 2, 2, 'F');

  // Label: PRECIO TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PRECIO TOTAL', 160, totalsY + 13, { align: 'center' });

  // Value: Symbol and amount on the same line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(`${symbol} ${cotizacion.precioTotal.toFixed(2)}`, 160, totalsY + 23, { align: 'center' });

  // Footer Section
  let currentY = totalsY + 38;

  if (cotizacion.referencia) {
    // Check if reference field overflows
    const wrappedRef = doc.splitTextToSize(`REFERENCIA / OBSERVACIONES: ${cotizacion.referencia}`, pageWidth - 30);
    const refHeight = wrappedRef.length * 4.5;
    
    if (currentY + refHeight + 5 > 280) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('REFERENCIA / OBSERVACIONES:', 15, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(cotizacion.referencia, pageWidth - 30), 15, currentY + 4.5);
    
    currentY += refHeight + 8;
  }

  if (currentY + 25 > 280) {
    doc.addPage();
    currentY = 20;
  }

  // Thin gray separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, currentY, pageWidth - 15, currentY);

  // Technical Notes (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('NOTAS TÉCNICAS', 15, currentY + 6);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  
  const notesText = 'La presente cotización tiene una vigencia de 15 días calendario. Precios sujetos a variaciones del mercado internacional y disponibilidad de cupos en los servicios tercerizados.';
  const wrappedNotes = doc.splitTextToSize(notesText, 95);
  doc.text(wrappedNotes, 15, currentY + 11);

  // Authorized Signature (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Light slate/gray
  doc.text('FIRMA AUTORIZADA', pageWidth - 15, currentY + 11, { align: 'right' });

  // Signature line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(135, currentY + 15, pageWidth - 15, currentY + 15);

  // Name
  const sellerName = (cotizacion.vendedor?.nombres ? `${cotizacion.vendedor.nombres} ${cotizacion.vendedor.apellidos || ''}` : 'SUPER ADMIN').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sellerName} - LOGISTICS MANAGER`, pageWidth - 15, currentY + 20, { align: 'right' });

  // Page Loop to Draw Professional Printer Footer & Page Numbers
  const totalPages = doc.getNumberOfPages();
  const now = new Date();
  const formatPrintDate = `${now.toLocaleDateString('es-PE')} ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  const printerName = currentUser ? `${currentUser.nombres} ${currentUser.apellidos || ''}`.trim() : 'S/U';

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate 300
    
    // Left: Print details
    doc.text(`Impreso por: ${printerName} | Fecha y Hora de Impresión: ${formatPrintDate}`, 15, 289);
    
    // Right: Page count
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, 289, { align: 'right' });
  }

  // Save the PDF
  doc.save(`Cotizacion_${String(cotizacion.numero).padStart(5, '0')}.pdf`);
};
