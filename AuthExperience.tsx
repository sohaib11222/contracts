import type { ReactNode } from 'react';
import './auth-experience.css';

/** Presentation only: forms, validation, sessions and redirects stay in each portal. */
export default function AuthExperience({ children, language, languageControl, image, admin = false }: {
  children: ReactNode; language: string; languageControl: ReactNode; image: string; admin?: boolean;
}) {
  const it = language === 'it';
  return <div className={`ve-auth${admin ? ' ve-auth--admin' : ''}`}>
    <aside className="ve-auth-story" aria-label={it ? 'Vista Express 360, il tuo mondo ottico' : 'Vista Express 360, your optical world'}>
      <img className="ve-auth-photo" src={image} alt="" fetchPriority="high" />
      <div className="ve-auth-shade" />
      <div className="ve-auth-wordmark"><span className="ve-auth-mark">360</span><span>VISTA EXPRESS<span className="ve-auth-edition">{admin ? 'PLATFORM ADMINISTRATION' : 'BUSINESS MANAGEMENT'}</span></span></div>
      <div className="ve-auth-editorial">
        <span className="ve-auth-eyebrow">{it ? 'UNA VISIONE PIÙ CHIARA' : 'A CLEARER PERSPECTIVE'}</span>
        <h2>{admin ? (it ? 'Una visione completa. Ogni giorno.' : 'The full picture. Every day.') : (it ? 'Più attenzione alle persone. Più spazio alla tua visione.' : 'More focus on people. More room for your vision.')}</h2>
        <p>{admin ? (it ? 'Negozi, accessi e attività. Il controllo della piattaforma, in un unico posto.' : 'Shops, access and operations. Your platform, thoughtfully connected.') : (it ? 'Clienti, cura della vista e attività del negozio. Tutto connesso, in un unico spazio.' : 'Customers, optical care and everyday business. Connected in one considered workspace.')}</p>
        <div className="ve-auth-caption"><span>VISTA EXPRESS 360</span><span>{it ? 'La tua attività, a fuoco.' : 'Your business, in focus.'}</span></div>
      </div>
    </aside>
    <section className="ve-auth-main">
      <header className="ve-auth-toolbar"><span>Vista Express <strong>360</strong>{admin && <small>Admin</small>}</span>{languageControl}</header>
      <main className="ve-auth-form">{children}</main>
      <footer className="ve-auth-footer">© {new Date().getFullYear()} Vista Express 360 <span>{it ? 'Uno spazio dedicato alla tua attività.' : 'A workspace dedicated to your business.'}</span></footer>
    </section>
  </div>;
}
