import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ImageDialogProps {
  src: string
  alt: string
  caption?: string
  onClose: () => void
}

/** Imagem ampliada em diálogo modal simples: Esc e clique fora fecham; o foco vai ao botão e volta ao gatilho. */
export const ImageDialog = ({ src, alt, caption, onClose }: ImageDialogProps) => {
  // Estados
  const closeRef = useRef<HTMLButtonElement>(null)

  // Effects
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      // Único elemento focável: mantém o foco dentro do diálogo.
      if (event.key === 'Tab') {
        event.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Return
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Fundo clicável para fechar; fora da ordem de Tab (o teclado usa Esc ou o botão Fechar). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 cursor-default bg-foreground/80"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        className="relative z-10 flex max-h-full max-w-5xl flex-col gap-2 rounded-xl bg-card p-3"
      >
        <Button ref={closeRef} variant="outline" size="sm" className="self-end" onClick={onClose}>
          <X aria-hidden="true" />
          Fechar
        </Button>
        <img src={src} alt={alt} className="max-h-[75vh] min-h-0 rounded-md object-contain" />
        {caption && <p className="text-[13px] text-muted-foreground">{caption}</p>}
      </div>
    </div>
  )
}
