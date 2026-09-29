"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ArrowDown, ArrowUpRight, Play, Plus, X } from "lucide-react"

// These are editorial themes, not identities or job titles of the pictured people.
const perspectives = [
  { title: "Nyfikenhet", line: "Allt börjar med en bra fråga.", text: "Tänk om nästa spelupplevelse kunde kännas helt annorlunda? Det är där nya idéer börjar.", x: 13, y: 53, top: 34, left: 5, width: 14, height: 45, maskX: 12.5, maskY: 57 },
  { title: "Gemenskap", line: "Bättre upplevelser, tillsammans.", text: "Spel får en annan dimension när det finns någon att dela ögonblicket med.", x: 35, y: 64, top: 46, left: 27, width: 19, height: 33, maskX: 35, maskY: 65 },
  { title: "Teknik", line: "Idéer som blir verklighet.", text: "Från en första skiss till en upplevelse som fungerar. Tekniken ger nyfikenheten en plats att ta form.", x: 55, y: 53, top: 33, left: 49, width: 13, height: 44, maskX: 55, maskY: 55 },
  { title: "Spelglädje", line: "Det där lilla extra.", text: "Spänningen före nästa giv. Känslan efter ett smart val. Ögonblicken som gör att vi vill spela igen.", x: 71, y: 55, top: 33, left: 65, width: 12, height: 48, maskX: 71, maskY: 57 },
  { title: "Framåtanda", line: "Nästa kapitel börjar nu.", text: "Erfarenhet ger oss en stadig grund. Ambitionen att prova nytt håller oss i rörelse.", x: 89, y: 50, top: 31, left: 81, width: 17, height: 40, maskX: 90, maskY: 51 },
]

export function AboutLounge() {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [filmOpen, setFilmOpen] = useState(false)
  const [filmError, setFilmError] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const filmTriggerRef = useRef<HTMLButtonElement>(null)
  const active = hovered ?? selected
  const perspective = active === null ? null : perspectives[active]

  useEffect(() => {
    const stage = stageRef.current
    const scene = sceneRef.current
    if (!stage || !scene) return
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    let frame = 0
    let x = 0
    let y = 0
    const paint = () => {
      frame = 0
      if (motion.matches || !finePointer.matches) {
        scene.style.removeProperty("transform")
        return
      }
      const rect = stage.getBoundingClientRect()
      const scroll = Math.max(-14, Math.min(14, -rect.top * 0.035))
      scene.style.transform = `translate3d(${x}px, ${y + scroll}px, 0) scale(1.025)`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint) }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      const rect = stage.getBoundingClientRect()
      x = ((event.clientX - rect.left) / rect.width - 0.5) * -12
      y = ((event.clientY - rect.top) / rect.height - 0.5) * -8
      schedule()
    }
    const leave = () => { x = 0; y = 0; schedule() }
    stage.addEventListener("pointermove", move, { passive: true })
    stage.addEventListener("pointerleave", leave)
    window.addEventListener("scroll", schedule, { passive: true })
    motion.addEventListener("change", schedule)
    finePointer.addEventListener("change", schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      stage.removeEventListener("pointermove", move)
      stage.removeEventListener("pointerleave", leave)
      window.removeEventListener("scroll", schedule)
      motion.removeEventListener("change", schedule)
      finePointer.removeEventListener("change", schedule)
      scene.style.removeProperty("transform")
    }
  }, [])

  useEffect(() => {
    if (!filmOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      filmTriggerRef.current?.focus()
    }
  }, [filmOpen])

  const clearFocus = () => { setHovered(null); setSelected(null) }
  const togglePerspective = (index: number) => {
    setHovered(null)
    setSelected((current) => current === index ? null : index)
  }

  return (
    <section className="about-lounge" aria-labelledby="about-title" onKeyDown={(event) => { if (event.key === "Escape") clearFocus() }}>
      <div className="about-lounge-stage" ref={stageRef}>
        <div className="about-lounge-scene" ref={sceneRef}>
          <Image className="about-lounge-image" src="/about/scout-lounge.png" alt="Fem personer samlade i en varm lounge under Scout Gaming-skylten." fill sizes="100vw" priority />
          <div className={`about-focus-shade${perspective ? " is-active" : ""}`} aria-hidden="true" style={perspective ? { "--focus-x": `${perspective.maskX}%`, "--focus-y": `${perspective.maskY}%` } as CSSProperties : undefined} />
          <div className="about-person-zones" onPointerLeave={() => setHovered(null)}>
            {perspectives.map((item, index) => (
              <button
                key={item.title}
                className={`about-person-zone${active === index ? " is-active" : ""}`}
                style={{ left: `${item.left}%`, top: `${item.top}%`, width: `${item.width}%`, height: `${item.height}%`, "--dot-x": `${(item.x - item.left) / item.width * 100}%`, "--dot-y": `${(item.y - item.top) / item.height * 100}%` } as CSSProperties}
                aria-label={`Utforska ${item.title.toLowerCase()}`}
                aria-pressed={selected === index}
                aria-controls="lounge-perspective"
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(index) }}
                onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(null) }}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={() => togglePerspective(index)}
              >
                <span className="about-person-dot"><Plus size={15} aria-hidden="true" /></span>
                <span className="about-person-label">{item.title}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="about-lounge-vignette" aria-hidden="true" />
        <div className="about-lounge-top"><span className="about-kicker"><span className="about-live-dot" />VÄLKOMMEN IN I SCOUT</span><span className="about-lounge-edition">EST. 2013 / ETT NYTT KAPITEL</span></div>
        <div className={`about-hero-copy${perspective ? " has-perspective" : ""}`}>
          <span className="about-kicker">MÄNNISKOR. IDÉER. MÖJLIGHETER.</span>
          <h1 id="about-title">Nästa kapitel.<br /><em>Tillsammans.</em></h1>
          <p>Vi bygger framtidens spelupplevelser.<br />Och allt börjar med människor.</p>
        </div>
        <div className={`about-perspective${perspective ? " is-visible" : ""}`} id="lounge-perspective" aria-live="polite" aria-atomic="true">
          {perspective && <><div className="about-perspective-heading"><span className="about-kicker">0{active! + 1} / {perspective.title}</span><button onClick={clearFocus} aria-label="Stäng perspektivet"><X size={18} aria-hidden="true" /></button></div><h2>{perspective.line}</h2><p>{perspective.text}</p></>}
        </div>
        <div className="about-lounge-bottom"><a href="#var-historia" className="about-scroll-link"><span><ArrowDown size={16} aria-hidden="true" /></span>Vår historia</a><span className="about-hover-hint">Fem perspektiv. Utforska personerna i bilden.</span><button className="about-film-trigger" ref={filmTriggerRef} onClick={() => { setFilmError(false); setFilmOpen(true) }}><Play size={13} fill="currentColor" aria-hidden="true" />Se loungen<span>0:10</span></button></div>
      </div>
      <div className="about-mobile-perspectives" aria-label="Utforska våra perspektiv">
        {perspectives.map((item, index) => <button key={item.title} aria-pressed={selected === index} aria-controls="lounge-perspective" onClick={() => togglePerspective(index)}><span>0{index + 1}</span>{item.title}<ArrowUpRight size={13} aria-hidden="true" /></button>)}
      </div>
      <dialog className="about-film-dialog" ref={dialogRef} aria-labelledby="lounge-film-title" onCancel={() => setFilmOpen(false)} onClose={() => setFilmOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setFilmOpen(false) }}>
        <div className="about-film-inner"><div className="about-film-heading"><h2 id="lounge-film-title">Välkommen till loungen.</h2><button autoFocus onClick={() => setFilmOpen(false)} aria-label="Stäng filmen"><X size={24} aria-hidden="true" /></button></div>
          {filmOpen && <video src="/about/scout-lounge.mp4" controls autoPlay muted playsInline preload="none" aria-label="Scout-loungen, en tio sekunder lång film utan ljud" onError={() => setFilmError(true)} />}
          {filmError && <p role="alert">Filmen kunde inte laddas. <a href="/about/scout-lounge.mp4">Öppna videofilen direkt</a>.</p>}
          <p className="about-film-caption">SCOUT GAMING / LOUNGE FILM / 10 SEKUNDER · UTAN LJUD</p>
        </div>
      </dialog>
    </section>
  )
}
