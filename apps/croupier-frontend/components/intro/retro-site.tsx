const NAV = ["Startsida", "Om företaget", "Produkter", "Fantasy Sport", "Live Casino", "Pressmeddelanden", "Gästbok", "Länkar", "Kontakta oss"]

const COUNTER = ["0", "0", "0", "4", "7", "1"]

/**
 * The "curtain": a deliberately dated Scout Gaming homepage, framed in a Windows 95 desktop.
 * Pure markup so it can be cloned into strips; every animation runs off --elapsed so the
 * clones pick up exactly where the static copy was.
 */
export function RetroSite() {
  return (
    <div className="retro">
      <div className="retro-window">
        <div className="retro-title">
          <span className="retro-ie" />
          <span className="retro-title-text">Scout Gaming Group AB - Välkommen! - Microsoft Internet Explorer</span>
          <span className="retro-title-btns">
            <span className="retro-btn">_</span>
            <span className="retro-btn">▫</span>
            <span className="retro-btn">×</span>
          </span>
        </div>
        <div className="retro-menu">
          <span>
            <u>A</u>rkiv
          </span>
          <span>
            <u>R</u>edigera
          </span>
          <span>
            <u>V</u>isa
          </span>
          <span>
            <u>G</u>å
          </span>
          <span>
            <u>F</u>avoriter
          </span>
          <span>
            <u>H</u>jälp
          </span>
        </div>
        <div className="retro-toolbar">
          <span className="retro-toolbtn">◄ Bakåt</span>
          <span className="retro-toolbtn retro-dim">► Framåt</span>
          <span className="retro-toolbtn">Stopp</span>
          <span className="retro-toolbtn">Uppdatera</span>
          <span className="retro-toolbtn">Start</span>
          <span className="retro-sep" />
          <span className="retro-toolbtn">Sök</span>
          <span className="retro-toolbtn">Favoriter</span>
          <span className="retro-toolbtn">Skriv ut</span>
        </div>
        <div className="retro-address">
          <span>
            A<u>d</u>ress:
          </span>
          <span className="retro-address-field">http://www.scoutgaming.se/index.htm</span>
        </div>

        <div className="retro-page">
          <div className="retro-content">
            <h1 className="retro-h1">Välkommen till Scout Gaming Group på Internet!</h1>
            <div className="retro-marquee">
              <span>
                *** NYHET! Nu lanserar vi FANTASY SPORT online *** Digitalt blackjackbord kommer 1999 *** Sidan ses
                bäst i Netscape Navigator 4.0 eller Internet Explorer 4.0 vid 800x600 *** Skriv gärna i vår gästbok! ***
              </span>
            </div>
            <hr className="retro-hr" />

            <table className="retro-layout">
              <tbody>
                <tr>
                  <td className="retro-nav">
                    <div className="retro-nav-head">MENY</div>
                    {NAV.map((item) => (
                      <span key={item} className="retro-nav-link">
                        » {item}
                        {item === "Live Casino" && <span className="retro-blink retro-new"> NYTT!</span>}
                      </span>
                    ))}
                    <div className="retro-nav-foot">
                      Sidan uppdaterades
                      <br />
                      senast 1998-03-14
                    </div>
                  </td>
                  <td className="retro-main">
                    <div className="retro-construction">
                      <span>UNDER UPPBYGGNAD</span>
                    </div>
                    <p>
                      Scout Gaming Group AB utvecklar <b>spel- och tävlingslösningar</b> för Internet.
                      Denna nostalgiska startsida är en animation som leder vidare till dagens blackjackpilot.
                    </p>
                    <h2 className="retro-h2">Våra produkter</h2>
                    <table className="retro-grid">
                      <tbody>
                        <tr>
                          <th>Produkt</th>
                          <th>Status</th>
                          <th>Plattform</th>
                        </tr>
                        <tr>
                          <td>Fantasy Sport</td>
                          <td>
                            <span className="retro-ok">Lanserad</span>
                          </td>
                          <td>Windows 95 / Netscape</td>
                        </tr>
                        <tr>
                          <td>Oddsspel</td>
                          <td>
                            <span className="retro-ok">Lanserad</span>
                          </td>
                          <td>Windows 95 / Netscape</td>
                        </tr>
                        <tr>
                          <td>Live Casino med croupier</td>
                          <td>
                            <span className="retro-soon">Kommer 1999</span>
                          </td>
                          <td>Kräver 56k-modem</td>
                        </tr>
                      </tbody>
                    </table>
                    <p>
                      <span className="retro-blink retro-new">NYTT!</span> Ladda hem vårt informationsblad om Fantasy Sport
                      (Word 6.0, 234 kB) eller skriv till webmaster.
                    </p>
                    <div className="retro-counter">
                      Du är besökare nummer:
                      <span className="retro-digits">
                        {COUNTER.map((digit, index) => (
                          <span key={index}>{digit}</span>
                        ))}
                      </span>
                    </div>
                    <div className="retro-badges">
                      <span className="retro-badge retro-badge-ns">Netscape NOW!</span>
                      <span className="retro-badge retro-badge-ie">Bäst i IE 4.0</span>
                      <span className="retro-badge retro-badge-res">800 x 600</span>
                      <span className="retro-badge retro-badge-html">HTML 3.2</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <hr className="retro-hr" />
            <p className="retro-footer">
              © 1998 Scout Gaming Group AB. Alla rättigheter förbehållna. · webmaster@scoutgaming.se ·
              Sidan är optimerad för 800x600 och 256 färger.
            </p>
          </div>
        </div>

        <div className="retro-status">
          <span className="retro-status-text">Öppnar sida http://www.scoutgaming.se/live-casino/astrid.htm ...</span>
          <span className="retro-progress">
            <i />
          </span>
          <span className="retro-status-zone">Internet-zon</span>
        </div>
      </div>

      <div className="retro-taskbar">
        <span className="retro-start">
          <span className="retro-flag" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Start
        </span>
        <span className="retro-task">
          <span className="retro-ie" />
          Scout Gaming Group AB - Vä...
        </span>
        <span className="retro-tray">
          <span className="retro-tray-icon" />
          <span className="retro-tray-icon retro-tray-icon-2" />
          14:07
        </span>
      </div>
    </div>
  )
}
