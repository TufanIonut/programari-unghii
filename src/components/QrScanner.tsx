import { useEffect, useRef, useState } from 'react'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike

/**
 * Scanează un cod QR cu camera din spate.
 * Folosește cititorul din browser (BarcodeDetector) unde există — Chrome pe Android —
 * și jsQR în rest (Safari pe iPhone), încărcat doar când e nevoie.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Browserul nu permite accesul la cameră aici. Scrie codul de pe card.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Nu ai permis accesul la cameră. Îl poți activa din setările browserului sau poți scrie codul de pe card.'
            : 'Nu am găsit o cameră. Scrie codul de pe card.',
        )
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())

      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
      const jsQR = detector ? null : (await import('jsqr')).default

      const tick = async () => {
        if (stopped) return
        if (video.readyState >= 2 && video.videoWidth) {
          let text: string | undefined
          if (detector) {
            text = (await detector.detect(video).catch(() => []))[0]?.rawValue
          } else if (jsQR && ctx) {
            // cadru micșorat: mai rapid, iar un QR ținut în fața camerei rămâne lizibil
            const scale = Math.min(1, 640 / video.videoWidth)
            canvas.width = Math.round(video.videoWidth * scale)
            canvas.height = Math.round(video.videoHeight * scale)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data
          }
          if (text && !stopped) {
            stopped = true
            navigator.vibrate?.(60)
            onResultRef.current(text)
            return
          }
        }
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    start()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label="Scanează cardul de fidelitate">
      <div className="scanner-box">
        {error ? (
          <p className="scanner-error">{error}</p>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            <span className="scanner-frame" aria-hidden="true" />
            <p className="scanner-hint">Ține codul QR al clientei în chenar</p>
          </>
        )}
      </div>
      <button type="button" className="btn btn-secondary scanner-close" onClick={onClose}>
        Închide
      </button>
    </div>
  )
}
