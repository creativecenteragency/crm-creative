import iconPositive from '../assets/brand/icon-positive.png'

export default function BrandMark({ className = 'h-7 w-7' }: { className?: string }) {
  return <img src={iconPositive} alt="Creative Center" className={`object-contain ${className}`} />
}
