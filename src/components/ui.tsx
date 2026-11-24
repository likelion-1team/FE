import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { ApiError } from '../api/client'

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  return <button type={type} className={`button ${variant} ${className}`} {...props} />
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}
export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="page-title">
      <h1>{title}</h1>
      <p>{description || '본인 대화와 피드백만 표시됩니다.'}</p>
    </header>
  )
}
export function Notice({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </Card>
  )
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      불러오는 중입니다.
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'
  return (
    <Card className="error-state">
      <h2>
        {error instanceof ApiError && error.status === 403
          ? '접근 권한을 확인해주세요'
          : '자료를 불러오지 못했습니다'}
      </h2>
      <p role="alert">{message}</p>
      {retry && <Button onClick={retry}>다시 시도</Button>}
    </Card>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const hintId = useId()
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        {hint && isValidElement(children)
          ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
              'aria-describedby': hintId,
            })
          : children}
      </label>
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label={`${title} 닫기`}>
          닫기
        </Button>
      </div>
      {children}
    </dialog>
  )
}
export function FeaturePending({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pending">
      <strong>{title}</strong>
      <p>{children || '아직 사용할 수 없습니다. 준비가 완료되면 안내하겠습니다.'}</p>
    </div>
  )
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <Notice tone="error">
      {error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'}
    </Notice>
  ) : null
}
export function formatNumber(value: number | null | undefined, percent = false) {
  return value == null || !Number.isFinite(value)
    ? '미측정'
    : percent
      ? `${(value * 100).toFixed(1)}%`
      : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value)
}
export function formatDate(value: string | null | undefined) {
  if (!value) return '미설정'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
}
export function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((type) => parts.find((p) => p.type === type)?.value).join('-')
}
