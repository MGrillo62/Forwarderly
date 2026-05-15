export const calculateLineValues = (costo: number, precioVenta: number, afectoIGV: boolean = true) => {
  let valorVenta, igv;
  
  if (afectoIGV) {
    valorVenta = precioVenta / 1.18;
    igv = valorVenta * 0.18;
  } else {
    valorVenta = precioVenta;
    igv = 0;
  }
  
  const utilidad = valorVenta - costo;
  const margen = valorVenta > 0 ? (utilidad / valorVenta) * 100 : 0;

  return {
    valorVenta,
    igv,
    utilidad,
    margen
  };
};

export const calculateTotals = (lineas: any[]) => {
  const precioTotal = lineas.reduce((acc, l) => acc + (l.afectoIGV ? l.precioVenta : l.valorVenta), 0);
  const totalVenta = lineas.reduce((acc, l) => acc + l.valorVenta, 0);
  const igv = lineas.reduce((acc, l) => acc + l.igv, 0);
  const utilidad = lineas.reduce((acc, l) => acc + l.utilidad, 0);
  const porcentajeUtilidad = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;

  return {
    precioTotal,
    totalVenta,
    igv,
    utilidad,
    porcentajeUtilidad
  };
};
