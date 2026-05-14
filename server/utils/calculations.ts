export const calculateLineValues = (costo: number, precioVenta: number) => {
  const valorVenta = precioVenta / 1.18;
  const igv = valorVenta * 0.18;
  const utilidad = precioVenta - costo;
  const margen = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;

  return {
    valorVenta,
    igv,
    utilidad,
    margen
  };
};

export const calculateTotals = (lineas: any[]) => {
  const precioTotal = lineas.reduce((acc, l) => acc + l.precioVenta, 0);
  const totalVenta = lineas.reduce((acc, l) => acc + l.valorVenta, 0);
  const igv = lineas.reduce((acc, l) => acc + l.igv, 0);
  const utilidad = lineas.reduce((acc, l) => acc + l.utilidad, 0);
  const porcentajeUtilidad = precioTotal > 0 ? (utilidad / precioTotal) * 100 : 0;

  return {
    precioTotal,
    totalVenta,
    igv,
    utilidad,
    porcentajeUtilidad
  };
};
