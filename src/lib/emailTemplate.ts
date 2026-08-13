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

export function wrapBrandedEmail(
  bodyHtml: string,
  branding: Pick<WorkspaceBranding, 'logo_url' | 'primary_color' | 'signature_name' | 'signature_role'> | null | undefined,
  workspaceName: string
): string {
  const color = branding?.primary_color || '#EA6A2A'
  const logoUrl = branding?.logo_url
  const signatureName = branding?.signature_name
  const signatureRole = branding?.signature_role

  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; background:#ffffff; border:1px solid #eee;">
  <div style="background:${color}; padding:20px 24px; text-align:center;">
    ${
      logoUrl
        ? `<img src="${logoUrl}" alt="${workspaceName}" style="max-height:40px; max-width:220px;" />`
        : `<span style="color:#ffffff; font-size:18px; font-weight:600;">${workspaceName}</span>`
    }
  </div>
  <div style="padding:24px; color:#26221c; font-size:14px; line-height:1.6;">
    ${bodyHtml}
  </div>
  ${
    signatureName || signatureRole
      ? `<div style="padding:0 24px 24px; border-top:1px solid #eee;">
          <p style="margin:16px 0 0; font-size:14px; color:#26221c;">
            ${signatureName ? `<strong>${signatureName}</strong><br/>` : ''}
            ${signatureRole ? `<span style="color:#6b7280;">${signatureRole}</span><br/>` : ''}
            <span style="color:${color}; font-weight:600;">${workspaceName}</span>
          </p>
        </div>`
      : ''
  }
</div>`.trim()
}
