import nodemailer from 'nodemailer';

interface SendClaimEmailParams {
  numeroReclamacion: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  nroDocumento: string;
  domicilio: string;
  telefono: string;
  correo: string;
  representante?: string | null;
  tipoBien: string;
  montoReclamado: number;
  descripcionBien: string;
  tipoReclamacion: string;
  detalle: string;
  pedido: string;
  createdAt: Date;
}

export const sendClaimEmail = async (claim: SendClaimEmailParams) => {
  const formattedDate = new Date(claim.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 20px; background-color: #f8fafc; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 30px; text-align: center; border-bottom: 4px solid #38bdf8; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
        .header p { margin: 8px 0 0 0; font-size: 14px; color: #94a3b8; }
        .content { padding: 30px; }
        .claim-number { background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 15px; border-radius: 4px 8px 8px 4px; margin-bottom: 25px; }
        .claim-number h2 { margin: 0; font-size: 18px; color: #4f46e5; }
        .claim-number p { margin: 4px 0 0 0; font-size: 12px; color: #64748b; }
        .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 25px 0 15px 0; letter-spacing: 0.5px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .field { margin-bottom: 12px; }
        .field.full { grid-column: span 2; }
        .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
        .value { font-size: 14px; color: #0f172a; font-weight: 500; }
        .alert-box { background-color: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 15px; border-radius: 8px; font-size: 12px; margin-top: 30px; border-left: 4px solid #f59e0b; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Libro de Reclamaciones Virtual</h1>
          <p>Optimus Systems & Process EIRL | Forwarderly</p>
        </div>
        <div class="content">
          <div class="claim-number">
            <h2>Hoja de Reclamación N° ${claim.numeroReclamacion}</h2>
            <p>Fecha de registro: ${formattedDate}</p>
          </div>

          <div class="section-title">1. Identificación del Consumidor Reclamante</div>
          <div class="grid">
            <div class="field">
              <div class="label">Nombres y Apellidos</div>
              <div class="value">${claim.nombres} ${claim.apellidos}</div>
            </div>
            <div class="field">
              <div class="label">Documento de Identidad</div>
              <div class="value">${claim.tipoDocumento}: ${claim.nroDocumento}</div>
            </div>
            <div class="field">
              <div class="label">Domicilio</div>
              <div class="value">${claim.domicilio}</div>
            </div>
            <div class="field">
              <div class="label">Celular / Teléfono</div>
              <div class="value">${claim.telefono}</div>
            </div>
            <div class="field full">
              <div class="label">Correo Electrónico</div>
              <div class="value">${claim.correo}</div>
            </div>
            ${claim.representante ? `
            <div class="field full">
              <div class="label">Representante Legal (Padre/Madre/Apoderado)</div>
              <div class="value">${claim.representante}</div>
            </div>` : ''}
          </div>

          <div class="section-title">2. Identificación del Bien Contratado</div>
          <div class="grid">
            <div class="field">
              <div class="label">Tipo de Bien</div>
              <div class="value">${claim.tipoBien === 'PRODUCTO' ? 'Producto' : 'Servicio'}</div>
            </div>
            <div class="field">
              <div class="label">Monto Reclamado</div>
              <div class="value">S/ ${claim.montoReclamado.toFixed(2)} PEN</div>
            </div>
            <div class="field full">
              <div class="label">Descripción del Producto o Servicio</div>
              <div class="value">${claim.descripcionBien}</div>
            </div>
          </div>

          <div class="section-title">3. Detalle de la Reclamación</div>
          <div class="grid">
            <div class="field full">
              <div class="label">Tipo de Solicitud</div>
              <div class="value" style="font-weight: bold; color: ${claim.tipoReclamacion === 'RECLAMO' ? '#ef4444' : '#f59e0b'}">${claim.tipoReclamacion}</div>
            </div>
            <div class="field full">
              <div class="label">Detalle y Sustento</div>
              <div class="value" style="white-space: pre-line;">${claim.detalle}</div>
            </div>
            <div class="field full">
              <div class="label">Pedido del Consumidor (Solicitud)</div>
              <div class="value" style="white-space: pre-line;">${claim.pedido}</div>
            </div>
          </div>

          <div class="alert-box">
            <strong>Nota de INDECOPI:</strong> El proveedor debe dar respuesta al reclamo en un plazo no mayor a quince (15) días hábiles improrrogables. La formulación del reclamo no impide acudir a otras vías de solución de controversias.
          </div>
        </div>
        <div class="footer">
          Este correo ha sido enviado automáticamente desde el Libro de Reclamaciones integrado de Forwarderly.<br>
          Optimus Systems & Process EIRL - RUC: 20608552311<br>
          Calle Españoleto 141 Dpto 102, San Borja, Lima-Perú.
        </div>
      </div>
    </body>
    </html>
  `;

  console.log(`[EMAIL DISPATCH] Preparando envío para Reclamación ${claim.numeroReclamacion}`);
  
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      // Send to business email
      await transporter.sendMail({
        from: `"Libro de Reclamaciones" <${smtpUser}>`,
        to: 'martin.grillo@optimussp.com',
        cc: claim.correo, // Copy to customer
        subject: `[Libro de Reclamaciones] Nueva Hoja de Reclamación N° ${claim.numeroReclamacion}`,
        html: htmlContent
      });

      console.log(`[SMTP SUCCESS] Correo de reclamación ${claim.numeroReclamacion} enviado correctamente.`);
    } catch (err: any) {
      console.error(`[SMTP ERROR] Falló el envío real de correo para ${claim.numeroReclamacion}:`, err.message);
    }
  } else {
    // Console fallback
    console.log("--------------------------------------------------------------------------------");
    console.log(`>>> MOCK EMAIL DISPATCH <<<`);
    console.log(`TO: martin.grillo@optimussp.com`);
    console.log(`CC: ${claim.correo}`);
    console.log(`SUBJECT: [Libro de Reclamaciones] Nueva Hoja de Reclamación N° ${claim.numeroReclamacion}`);
    console.log(`HTML CONTENT:\n${htmlContent}`);
    console.log("--------------------------------------------------------------------------------");
  }
};
