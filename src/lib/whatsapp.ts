// Heurística para números argentinos: la mayoría de los leads llegan sin código de
// país. wa.me necesita el número completo, así que asumimos +54 cuando no está y
// quitamos el 0 de discado local (ej: "011..." -> "11...").
export function whatsappLink(phone: string | null): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith('54')) digits = `54${digits}`
  return `https://wa.me/${digits}`
}
