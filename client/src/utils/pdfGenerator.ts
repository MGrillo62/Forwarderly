import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateQuotationPDF = (cotizacion: any, logoBase64: string | null = null) => {
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
      doc.addImage(logoBase64, 'PNG', 15, 10, 35, 12);
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
  const dateStr = new Date(cotizacion.createdAt).toLocaleDateString('es-PE');
  const estadoStr = cotizacion.estado || 'BORRADOR';
  const userStr = cotizacion.vendedor ? `${cotizacion.vendedor.nombres}` : 'S/V';

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

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text('Precios de servicios', 134, yCards + 20);
  doc.text('expresados en la', 134, yCards + 24.5);
  doc.text('moneda indicada.', 134, yCards + 29);

  // Table (Start at yCards + 37)
  const symbol = currencySymbol;
  const tableRows = cotizacion.lineas.map((l: any) => [
    (l.concepto?.categoria?.nombre || l.categoriaNombre || 'S/C').toUpperCase(),
    (l.proveedor?.razonSocial || l.proveedor?.contacto || '—').toUpperCase(),
    `${symbol} ${l.costo.toFixed(2)}`,
    `${symbol} ${l.precioVenta.toFixed(2)}`,
    `${symbol} ${l.valorVenta.toFixed(2)}`,
    `${symbol} ${l.utilidad.toFixed(2)}`,
    `${l.margen.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: yCards + 37,
    head: [['CATEGORÍA', 'PROVEEDOR', 'COSTO', 'PRECIO VENTA', 'VALOR VENTA', 'UTILIDAD', 'MARGEN']],
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
      0: { cellWidth: 35, halign: 'left' },  // Category
      1: { cellWidth: 30, halign: 'left' },  // Provider
      2: { cellWidth: 23, halign: 'right' }, // Cost
      3: { cellWidth: 25, halign: 'right' }, // Sale Price
      4: { cellWidth: 25, halign: 'right' }, // Sale Value
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }, // Profit
      6: { cellWidth: 20, halign: 'right' }  // Margin
    },
    didParseCell: (data) => {
      // Style Utilidad column text blue to match the template
      if (data.column.index === 5 && data.section === 'body') {
        data.cell.styles.textColor = [37, 99, 235]; // Blue
      }
    }
  });

  // Table end Y coordinate
  const finalY = (doc as any).lastAutoTable.finalY || (yCards + 37 + 15);

  // Italics note right below the table bottom, very close as requested
  doc.setFont('helvetica', 'oblique');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('La lista continúa en la página 2', pageWidth - 15, finalY + 5.5, { align: 'right' });

  // Totals Block section
  const totalsY = finalY + 13;

  // Draw Left Card (Totals details)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, totalsY, 105, 34, 2, 2, 'FD');

  // Col 1: TOTAL VALOR VENTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL VALOR VENTA', 20, totalsY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${symbol} ${cotizacion.totalVenta.toFixed(2)}`, 20, totalsY + 19);

  // Col 2: IGV (18%)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('IGV (18%)', 55, totalsY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${symbol} ${cotizacion.igv.toFixed(2)}`, 55, totalsY + 19);

  // Col 3: UTILIDAD TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text('UTILIDAD TOTAL', 90, totalsY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text(`${symbol} ${cotizacion.utilidad.toFixed(2)}`, 90, totalsY + 19);

  // Draw Right Card (Precio Total)
  doc.setFillColor(15, 23, 42); // Dark slate blue
  doc.roundedRect(125, totalsY, 70, 34, 2, 2, 'F');

  // Label: PRECIO TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PRECIO TOTAL', 160, totalsY + 8, { align: 'center' });

  // Value: Symbol and amount on the same line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(`${symbol} ${cotizacion.precioTotal.toFixed(2)}`, 160, totalsY + 19, { align: 'center' });

  // Inner Margen box (white text on slate gray rounded tag)
  doc.setFillColor(71, 85, 105);
  doc.roundedRect(135, totalsY + 22, 50, 7.5, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`MARGEN: ${cotizacion.porcentajeUtilidad.toFixed(1)}%`, 160, totalsY + 27, { align: 'center' });

  // Footer Section
  const footerY = totalsY + 44;

  // Thin gray separator line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, pageWidth - 15, footerY);

  // Technical Notes (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('NOTAS TÉCNICAS', 15, footerY + 6);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  
  const notesText = 'La presente cotización tiene una vigencia de 15 días calendario. Precios sujetos a variaciones del mercado internacional y disponibilidad de cupos en los servicios tercerizados.';
  const wrappedNotes = doc.splitTextToSize(notesText, 95);
  doc.text(wrappedNotes, 15, footerY + 11);

  // Authorized Signature (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Light slate/gray
  doc.text('FIRMA AUTORIZADA', pageWidth - 15, footerY + 11, { align: 'right' });

  // Signature line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(135, footerY + 15, pageWidth - 15, footerY + 15);

  // Name
  const sellerName = (cotizacion.vendedor?.nombres ? `${cotizacion.vendedor.nombres} ${cotizacion.vendedor.apellidos || ''}` : 'SUPER ADMIN').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${sellerName} - LOGISTICS MANAGER`, pageWidth - 15, footerY + 20, { align: 'right' });

  // Save the PDF
  doc.save(`Cotizacion_${String(cotizacion.numero).padStart(5, '0')}.pdf`);
};
