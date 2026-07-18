# Arukone

Ein Arukone-Puzzle (auch bekannt als Numberlink) für den Browser — ohne
Frameworks, ohne Build-Schritt, komplett in Vanilla-JavaScript.

**Spielen:** https://bric.github.io/arukone/

## Spielregeln

Verbinde alle gleichen Zahlenpaare durch Linien auf dem Gitter:

- Linien verlaufen waagerecht oder senkrecht von Feld zu Feld.
- Linien dürfen sich nicht kreuzen oder überlappen.
- **Alle** Felder müssen genutzt werden — das Rätsel ist erst gelöst,
  wenn das ganze Gitter gefüllt ist.

Gezogen wird per Maus oder Finger: An einem Endpunkt starten, über die
Felder zum Partner-Endpunkt ziehen. Zurückziehen kürzt die Linie,
Loslassen vor dem Ziel verwirft sie. Ein Timer misst die Lösungszeit.

Feldgrößen: 5×5 bis 10×10 (die zuletzt gewählte Größe wird gespeichert).

## Rätselqualität

Jedes Rätsel wird lokal im Browser erzeugt und erfüllt garantiert:

- **Eindeutig lösbar** — es gibt genau eine Lösung.
- **Abkürzungsfrei** — es existiert keine Verbindung aller Paare, die
  Felder frei lässt. Das wird nicht heuristisch geprüft, sondern exakt
  bewiesen (Frontier-Methode: dynamische Programmierung über die
  Gitterfront mit Mate-Kodierung der Pfadfragmente).
- **Wenige Paare** — z. B. nur 6 Paare auf 10×10. Ein Backbite-
  Hügelsteigen formt dafür einen Hamiltonpfad in wenige straffe
  Segmente um; anschließende Mutationen auf Partitionsebene machen die
  Lösung verwinkelter, und aus mehreren bewiesenen Kandidaten gewinnt
  der mit dem höchsten Schwierigkeits-Score.

Die Erzeugung großer Felder kann darum einige Sekunden dauern — ein
Hinweis mit Spinner zeigt an, dass noch gerechnet wird.

## Lokal starten

Einfach einen statischen Server im Projektverzeichnis starten, z. B.:

```
python3 -m http.server 8000
```

und http://localhost:8000 öffnen. Es gibt keine Abhängigkeiten.

## Projektstruktur

```
index.html               Seitengerüst und Toolbar
styles.css               Layout, Farben (hell/dunkel), Banner, Timer
js/palette.js            Farbpalette der Paare
js/grid-model.js         Spielzustand: Gitter, Pfade, Zugregeln, Siegprüfung
js/puzzle-generator.js   Rätselerzeugung und exakte Verifikation
js/renderer.js           Aufbau und Zeichnen des Spielfelds
js/input-controller.js   Maus-/Touch-Eingabe (Pointer Events)
js/storage.js            Speichern der Feldgröße (localStorage)
js/app.js                Verdrahtung von UI, Generator und Spielzustand
.github/workflows/       Deployment auf GitHub Pages
```

## Deployment

Jeder Push auf `main` veröffentlicht die Seite über GitHub Actions auf
GitHub Pages (`.github/workflows/pages.yml`).
