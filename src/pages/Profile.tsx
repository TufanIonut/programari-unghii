import { useAuth } from '../auth/context'

export function Profile() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <section>
      <span className="eyebrow">Contul meu</span>
      <h1>Bună, {user.firstName}!</h1>
      <p className="muted">{user.email}</p>

      <div className="info-grid">
        <div className="info-tile">
          <strong>Fișa de cunoaștere</strong>
          <span className="muted">Urmează: detaliile despre unghii și designul dorit.</span>
        </div>
        <div className="info-tile">
          <strong>Programările mele</strong>
          <span className="muted">Urmează: calendarul cu orele disponibile.</span>
        </div>
        <div className="info-tile">
          <strong>Card de fidelitate</strong>
          <span className="muted">Urmează: codul QR și vizitele bifate.</span>
        </div>
      </div>
    </section>
  )
}
