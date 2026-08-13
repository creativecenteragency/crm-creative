export default function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 4a20 20 0 1 0 12.6 35.6l5.4 2a1.2 1.2 0 0 0 1.5-1.5l-2-5.4A20 20 0 0 0 24 4Z"
        stroke="currentColor"
        strokeWidth="3.2"
      />
      <circle cx="15.5" cy="24" r="3.4" fill="#F98105" />
      <circle cx="24" cy="24" r="3.4" fill="#F98105" />
      <circle cx="32.5" cy="24" r="3.4" fill="#F98105" />
    </svg>
  )
}
