import type { Lead } from '../types/database'

function normalizeEmail(email: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

// Cuando el mismo email aparece en más de un lead, nos quedamos con el más
// reciente (suele tener los datos más actualizados) y el resto se considera
// "duplicado". Leads sin email nunca se consideran duplicados entre sí.
export function dedupeLeads(leads: Lead[]): Lead[] {
  const latestByEmail = new Map<string, Lead>()
  const withoutEmail: Lead[] = []
  for (const lead of leads) {
    const email = normalizeEmail(lead.email)
    if (!email) {
      withoutEmail.push(lead)
      continue
    }
    const current = latestByEmail.get(email)
    if (!current || new Date(lead.created_at) > new Date(current.created_at)) {
      latestByEmail.set(email, lead)
    }
  }
  return [...latestByEmail.values(), ...withoutEmail]
}

// IDs de los leads "extra" que dedupeLeads descartaría (todos menos el que
// queda por cada email repetido).
export function duplicateLeadIds(leads: Lead[]): Set<string> {
  const keptIds = new Set(dedupeLeads(leads).map((l) => l.id))
  const duplicates = new Set<string>()
  for (const lead of leads) {
    if (!keptIds.has(lead.id)) duplicates.add(lead.id)
  }
  return duplicates
}
