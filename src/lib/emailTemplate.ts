import type { Lead } from '../types/database'

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
