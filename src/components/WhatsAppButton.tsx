import { whatsappLink } from '../lib/whatsapp'

export default function WhatsAppButton({ phone, className = '' }: { phone: string | null; className?: string }) {
  const href = whatsappLink(phone)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Escribir por WhatsApp"
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full bg-[#25D366] text-white shrink-0 hover:opacity-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.7.7-2.7-.2-.3A8 8 0 1 1 12 20Zm4.4-5.7c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5.1-1.3-.6-2.2-1.1-3-2.5-.1-.2-.1-.4.1-.5.2-.2.4-.5.6-.7.1-.2.1-.4 0-.5-.1-.2-.6-1.4-.8-1.9-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9 1-.9 2.3s.9 2.6 1.1 2.8c.2.2 1.7 2.6 4.1 3.6 2 .8 2.4.6 2.8.6.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .2-1.1-.1-.1-.2-.2-.4-.3Z" />
      </svg>
    </a>
  )
}
