import logo from '../assets/brand/toki-logo.png'
import wordmark from '../assets/brand/toki-wordmark.png'

export function BrandLogo({ full = false }: { full?: boolean }) {
  return (
    <img
      className={`brand-logo${full ? ' brand-logo-full' : ''}`}
      src={full ? logo : wordmark}
      alt="TOKI"
      width={full ? 2006 : 635}
      height={full ? 808 : 281}
      draggable={false}
    />
  )
}
