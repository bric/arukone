# Arukone — Projektgedächtnis

Arukone/Numberlink im Browser: Vanilla-JS, kein Build-Schritt, keine
Abhängigkeiten. Spielregeln und Bedienung stehen im README — hier steht, was
man beim Ändern wissen muss und was schon erfolglos probiert wurde.

## Nicht verhandelbar

Die Rätselqualität ist der Kern des Projekts. Diese drei Eigenschaften sind
teuer erarbeitet und dürfen nicht aufgeweicht werden:

1. **Exakt bewiesene Abkürzungsfreiheit.** Es darf keine Verbindung aller
   Paare geben, die Felder frei lässt. Geprüft wird das mit der Frontier-DP
   (`createShortcutCheck`), nicht heuristisch. Vorher kam das per DFS-"Jagden"
   und hat nachweislich fehlerhafte Rätsel durchgelassen — zweimal vom Nutzer
   im Spiel gefunden. Die DFS-Jagden (`HUNT_PLAN`) sind nur noch ein billiger
   Vorfilter; **akzeptiert wird ausschließlich ein `clean`-Urteil der DP**.
2. **Eindeutige Lösung.** Folgt in der Praxis aus 1 (nachgemessen: alle
   geprüften Rätsel hatten genau eine Voll-Lösung).
3. **Die Gewinnbedingung verlangt das volle Brett** (`isSolved`). Wer das
   lockert, macht Punkt 1 bedeutungslos.

Wenn eine Änderung diese Garantien gegen Rechenzeit eintauschen will: nicht
stillschweigend tun, sondern nachfragen.

## Architektur

Globales `window.Arukone`-Objekt, Dateien werden in dieser Reihenfolge per
`<script>` geladen (siehe `index.html`):

| Datei | Rolle |
|---|---|
| `js/palette.js` | Farben der Paare (20 Stück) |
| `js/grid-model.js` | Spielzustand: Gitter, Pfade, Zugregeln, Siegprüfung |
| `js/puzzle-generator.js` | Erzeugung + Verifikation (größte Datei, ~980 Zeilen) |
| `js/renderer.js` | Brett aufbauen und zeichnen |
| `js/input-controller.js` | Pointer-Events (Maus + Touch) |
| `js/storage.js` | Feldgröße in `localStorage` |
| `js/app.js` | Verdrahtung, Timer, Banner |

Feldgrößen: **6–9** (`ALLOWED_SIZES` in `js/app.js`), Standard 7.
Paarzahl: `max(3, round(size * 0.6))` → 6×6 und 7×7 je 4 Paare, 8×8 und 9×9
je 5.

**5×5 und 10×10 wurden bewusst entfernt** — nicht vergessen, nicht
"hilfsbereit" wieder einbauen: 10×10 brauchte am längsten und war am
leichtesten (Paarzahl wächst langsamer als die Fläche), 5×5 blieb trivial,
weil man 25 Felder überblickt.

## Die Erzeugungspipeline

`createSearch(size)` liefert eine resumierbare Suche; `step()` arbeitet ein
Häppchen ab, `generateAsync` bündelt Schritte in 40-ms-Ticks, damit der
Browser rendern kann. Pro Kandidat:

1. `generateHamiltonianPath` — zufälliger Hamiltonpfad (Warnsdorff-artig).
2. `optimizePath` — Backbite-Hügelsteigen, bis der Pfad in höchstens `target`
   **straffe** Segmente zerfällt (`cutPathForced` schneidet, wo sich ein
   Segment selbst berühren würde). Zufallspfade zerfallen von sich aus in 12+
   Segmente — ohne diesen Schritt gäbe es keine Rätsel mit wenigen Paaren.
3. `mutatePartition` — Endzellen-Transfers zwischen benachbart endenden
   Pfaden. Erhält Abdeckung, Straffheit, Paarzahl und Mindestlänge, verschiebt
   aber Endpunkte und löst die Lösung aus der Zwiebelring-Form. Schlägt
   bevorzugt Züge vor, die einen Rand-Endpunkt auflösen.
4. DFS-Jagden (`greedy`, `anti`) als billiger Vorfilter.
5. Frontier-DP `createShortcutCheck` — der eigentliche Beweis.

Unter den bewiesen sauberen Kandidaten entscheidet die Rangfolge:
**Rand-Endpunkte (Ecken doppelt) → Suchaufwand → Form.** Gesammelt wird, bis
`BESTOF_MAX_CANDIDATES` (60), Stagnation oder `BESTOF_EXTRA_MS` greifen.

Zwei Zeitventile, falls nichts Sauberes gefunden wird (beide frieren ein,
sobald ein Rätsel vorliegt): alle `ESCALATE_EDGE_MS` (6 s) wird ein
Rand-Endpunkt mehr erlaubt, erst nach `ESCALATE_AFTER_MS` (90 s) steigt die
Paarzahl — ein Endpunkt am Rand ist das kleinere Übel.

Typische Dauer (Node; Browser ähnlich): 6×6 ~4 s, 7×7 3–5 s, 8×8 7–11 s,
9×9 13–21 s. Dass es dauert, ist erwartet — dafür gibt es den Spinner.

## Gemessene Sackgassen

Alles hier wurde ausprobiert und ist belegt gescheitert. Nicht wiederholen:

- **Null Endpunkte am Rand geht nicht.** Endet kein Pfad am Rand, lassen sich
  die Paare im Inneren verbinden und der Randring bleibt frei → abkürzbar.
  7×7 gemessen: 0 % sauber bei 0 Rand-Endpunkten, 5–8 % bei 1–2, 66 % bei 4.
- **Weniger Paare geht nicht beliebig.** 5×5 mit 2 Paaren: 384 von 384
  Kandidaten abkürzbar. Dasselbe Muster erzwingt die Paarzahl-Formel oben.
- **Segmente zusammenführen statt Pfad optimieren**: 0 von 10 sauber.
- **Zwangszug-Propagation als Trivialitätsmaß**: löst nur 2 % der Rätsel —
  misst also nicht, was Rätsel leicht macht. Stattdessen zählt `searchEffort`
  die DFS-Knoten bis zur Lösung (5×5 gemessen: 38–4955, Median 591).
- **Höheres `STATE_CAP`**: 400k ließ die DP 6,3 s pro Kandidat rechnen (7
  Kandidaten/45 s); 150k senkt das auf 1,4 s (20 Kandidaten) — mehr Durchsatz
  schlägt gründlichere Einzelprüfung. 60k brachte nichts mehr.
- **Zusätzliche Vorfilter** (Ringvermeidung, `inner`-Suchmodus): fingen ~5 %
  der Abkürzungen und zahlten ihre Kosten nicht. Wieder entfernt.

## Prüfen statt hoffen

**Generator in Node** (kein Browser nötig):

```js
global.window = global;
global.window.setTimeout = setTimeout;
require('./js/palette.js');
require('./js/puzzle-generator.js');
var PG = window.Arukone.PuzzleGenerator;
PG.generate(7);                              // komplettes Rätsel
PG.hasShortcutSolution(7, pairs, 2000000);   // 'clean' | 'shortcut' | ...
```

`grid-model.js` lässt sich genauso laden und Züge direkt durchspielen.

**Verifizierer gegen Brute Force kreuzvalidieren**, wenn an
`verifyOnlyFullSolutions` oder der Frontier-DP etwas geändert wird: zufällige
kleine Instanzen (3×3–5×5, 2–4 Paare) mit einer unabhängigen
Alle-Pfade-Suche vergleichen. Das hat einen echten Kodierungsfehler gefunden
(Kollision zwischen Paar-Labels und Mate-Slots ab 7 Paaren). Zuletzt: 6000
Instanzen, 0 Abweichungen.

**Browser** (Playwright und Chromium sind installiert — nicht neu
herunterladen, `playwright install` ist unnötig):

```js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
```

Keinen `executablePath` setzen: Playwright findet Chromium über
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` selbst. Ein fest verdrahteter
Pfad bricht beim nächsten Container — die Version wandert und sogar der
Ordnername ändert sich (zuletzt `chromium-1194/chrome-linux` →
`chromium-1243/chrome-linux64`). Im Zweifel `chromium.executablePath()`
fragen.

Statische Seite mit `python3 -m http.server` ausliefern. Beim Warten auf die
Erzeugung `state: 'attached'` nutzen (`#generating-hint[hidden]` ist unsichtbar,
sonst läuft der Selektor in den Timeout).

**Sichtbarkeit immer über `getComputedStyle` prüfen, nie nur über das
`hidden`-Attribut.** Genau daran ist ein Bug durchgerutscht: `.generating-hint`
setzt `display: flex`, und eine Autorenregel schlägt die Browser-Regel
`[hidden] { display: none }` — das Attribut war korrekt gesetzt, der Hinweis
blieb trotzdem sichtbar. Deshalb gibt es die explizite Regel
`.generating-hint[hidden] { display: none }` in `styles.css`.

## Konventionen

- **Vanilla JS im ES5-Stil**: `var`, `function`, IIFE pro Datei, kein
  Transpiler, keine Module, keine Abhängigkeiten. Bitte so weiterführen.
- **Oberfläche und Kommentare auf Deutsch**, Bezeichner im Code englisch.
- Kommentare erklären das *Warum* (besonders bei den Generator-Heuristiken),
  nicht das Offensichtliche.
- Spielfeedback nicht stillschweigend weglassen: Sind alle Paare verbunden,
  aber Felder frei, erscheint ein oranges Banner — ohne das wirkte der
  fehlende Gewinn wie ein Fehler.
- Eine fertige Verbindung darf beim Überziehen nicht gelöscht werden
  (`continueDrag` ignoriert Verlängerungen ab dem Endpunkt; Zurückziehen
  kürzt weiterhin).

## Umgebung & Deployment

- Push geht direkt auf `main`; es gibt keinen PR-Workflow.
- **Vorsicht beim Sessionstart:** Der Container checkt mitunter einen alten
  Feature-Branch aus. Vor der ersten Änderung `git log --oneline -1` gegen
  `origin/main` prüfen und notfalls `git checkout main` — sonst arbeitet man
  auf einem Stand von vor Monaten. Ist hier schon zweimal passiert.
- Jeder Push auf `main` deployt via GitHub Actions nach
  https://bric.github.io/arukone/ (`.github/workflows/pages.yml`).
- GitHub Pages cacht bis zu 10 Minuten — beim Nachstellen von Nutzerberichten
  hart neu laden.
