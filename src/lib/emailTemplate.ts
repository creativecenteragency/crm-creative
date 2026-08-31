import type { Lead, WorkspaceBranding } from '../types/database'

export function renderTemplate(text: string, lead: Lead): string {
  const vars: Record<string, string> = {
    nombre: lead.first_name ?? '',
    apellido: lead.last_name ?? '',
    nombre_completo: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
    email: lead.email ?? '',
    telefono: lead.phone ?? '',
    consulta: lead.inquiry_type ?? '',
    empresa: lead.extra?.company ?? '',
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

// El editor visual de plantillas guarda HTML directamente (vía contentEditable),
// pero plantillas viejas todavía tienen texto plano guardado — esta función
// detecta cuál es cuál para no perder los saltos de línea de las viejas.
function looksLikeHtml(text: string): boolean {
  return /<\/?(p|div|br|b|i|strong|em|a|span|ul|ol|li|h[1-6])[\s>]/i.test(text)
}

export function ensureHtml(text: string): string {
  return looksLikeHtml(text) ? text : textToHtml(text)
}

// Convierte HTML a texto plano para mandar como alternativa junto al HTML.
// No es solo estético: un email multipart (html + text) sin la parte de texto
// es una señal clásica de spam para Gmail/Outlook — esto ayuda a la entregabilidad
// tanto como al lector que tiene el cliente de correo configurado en texto plano.
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Layout compartido por todos los emails que salen del CRM (leads, digests,
// avisos de cuenta). Usa tablas en vez de flex/grid porque Outlook de escritorio
// solo renderiza bien ese modelo — es la forma estándar de maquetar HTML de
// email. Colores fijos en vez de las variables de Tailwind porque los clientes
// de correo no leen hojas de estilo externas ni custom properties.
export function wrapBrandedEmail(
  bodyHtml: string,
  branding: Pick<WorkspaceBranding, 'logo_url' | 'primary_color' | 'signature_name' | 'signature_role'> | null | undefined,
  workspaceName: string
): string {
  const color = branding?.primary_color || '#f98105'
  const logoUrl = branding?.logo_url
  const signatureName = branding?.signature_name
  const signatureRole = branding?.signature_role

  const headerInner = logoUrl
    ? `<img src="${logoUrl}" alt="${workspaceName}" style="display:block; max-height:44px; max-width:240px;" />`
    : `<span style="color:#ffffff; font-size:20px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${workspaceName}</span>`

  const signatureBlock =
    signatureName || signatureRole
      ? `<tr><td style="padding:0 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #eeece8; padding-top:16px;">
            <p style="margin:0; font-size:14px; line-height:1.6; color:#151515; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              ${signatureName ? `<strong>${signatureName}</strong><br/>` : ''}
              ${signatureRole ? `<span style="color:#7d7b78;">${signatureRole}</span><br/>` : ''}
              <span style="color:${color}; font-weight:600;">${workspaceName}</span>
            </p>
          </td></tr></table>
        </td></tr>`
      : ''

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${workspaceName}</title>
</head>
<body style="margin:0; padding:0; background:#f4f1ec;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #eeece8;">
    <tr><td style="background:${color}; padding:28px 32px; text-align:center;">
      ${headerInner}
    </td></tr>
    <tr><td style="padding:32px 32px 28px; color:#151515; font-size:15px; line-height:1.65; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      ${bodyHtml}
    </td></tr>
    ${signatureBlock}
    <tr><td style="padding:18px 32px; background:#f4f1ec; border-top:1px solid #eeece8; text-align:center;">
      <p style="margin:0; font-size:12px; color:#7d7b78; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        Enviado por ${workspaceName} — gestionado con el CRM de <span style="color:#151515; font-weight:600;">Creative Center</span>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}
