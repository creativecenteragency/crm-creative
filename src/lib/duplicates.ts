import type { Lead } from '../types/database'

function normalizeEmail(email: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

// Los teléfonos llegan con formatos distintos (+54 9 11 1234-5678, 11 1234 5678,
// 0111512345678…): se comparan por los últimos 10 dígitos. Con menos de 8 dígitos
// no alcanza para identificar a nadie y se ignora.
function normalizePhone(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length < 8 ? '' : digits.slice(-10)
}

// Cuando el mismo email o el mismo teléfono aparece en más de un lead, nos
// quedamos con el más reciente (suele tener los datos más actualizados) y el
// resto se considera "duplicado". Leads sin email ni teléfono nunca se
// consideran duplicados entre sí.
export function dedupeLeads(leads: Lead[]): Lead[] {
  const newestFirst = [...leads].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const seenEmails = new Set<string>()
  const seenPhones = new Set<string>()
  const kept = new Set<string>()
  for (const lead of newestFirst) {
    const email = normalizeEmail(lead.email)
    const phone = normalizePhone(lead.phone)
    if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) continue
    if (email) seenEmails.add(email)
    if (phone) seenPhones.add(phone)
    kept.add(lead.id)
  }
  return leads.filter((l) => kept.has(l.id))
}

// IDs de los leads "extra" que dedupeLeads descartaría (todos menos el que
// queda por cada email o teléfono repetido).
export function duplicateLeadIds(leads: Lead[]): Set<string> {
  const keptIds = new Set(dedupeLeads(leads).map((l) => l.id))
  const duplicates = new Set<string>()
  for (const lead of leads) {
    if (!keptIds.has(lead.id)) duplicates.add(lead.id)
  }
  return duplicates
}
