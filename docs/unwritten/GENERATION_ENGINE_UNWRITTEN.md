# GENERATION_ENGINE_UNWRITTEN — Phase 3 : moteur éditorial (première version)

> Statut : **cœur du moteur de composition livré et testé** ; la chaîne complète « commande → livre » reste à construire (§ 6).
> Code : `apps/studio/src/lib/editorial/`. Design system : `DESIGN_SYSTEM_UNWRITTEN.md`.
> Contrainte respectée : **aucun changement de rendu ni de comportement pour La Malle à Jeux** (§ 5).

## 1. Ce qui est fait

```
Manuscrit structuré (JSON validé par Zod) + format + mode (impression / numérique)
        │
        ▼
 1. Collecte  ── chaque gabarit déclare les textes à mesurer (TextBank)
 2. Mesure    ── Chromium : coupures de lignes réelles (ProseView + polices embarquées)
 3. Pagination ─ veuves / orphelines, intertitres, flottants (paginate.ts, fonction pure)
 4. Séquence  ── pages liminaires, sauts de chapitre sur page impaire, pages blanches, parité
 5. Gabarits  ── blocs positionnés en mm, folios, titres courants, sommaire définitif
        │
        ▼
 BuiltPage[] / PageLayout  ──►  PageRenderer (aperçu, éditeur, /print/books/[id])
                               ──►  renderBookPdf (Chromium) ──► PDF
                               ──►  Contrôle qualité éditorial (qa.ts) sur le même rendu
```

### 1.1 Modules (`src/lib/editorial/`)

| Fichier | Rôle |
|---|---|
| `manuscript.ts` | Schéma du manuscrit : titre, sous-titre, destinataire, auteur, dédicace, épigraphe, chapitres (paragraphes, intertitres, changements de scène, citations dans le texte ou pleine page, illustrations pleine page ou figure, activités, souvenirs), conclusion signée, quatrième, couverture, édition, **données de personnalisation attendues** |
| `compose.ts` | Entrée de haut niveau `composeBook(manuscrit, { format, mode, measurer, date })` → `{ pages: BuiltPage[], theme, grid, pageFormat, expectations, stats }` |
| `measure.ts` | Mesure réelle dans Chromium (`createChromiumMeasurer`), document autonome avec les polices lues sur le disque |
| `paginate.ts` | Pagination pure d'un flux mesuré (testée sans navigateur) |
| `blocks.ts` | Fabrique des blocs, registre des mesures (`TextBank`), identifiants déterministes |
| `covers.ts` | 9 directions de couverture, quatrièmes, aplats d'illustration par collection |
| `grid.ts` | Grilles des formats A5, A4, carré, 3:4 ; échelle typographique |
| `typography.ts` | Microtypographie française et anglaise, italique `*…*`, découpe des segments |
| `palette.ts` | Palette, tons dérivés, calcul de contraste WCAG |
| `fonts.ts` | Déclarations des polices OFL embarquées |
| `theme.ts` | Thème `unwritten` au format `BookThemeSchema` existant |
| `labels.ts` | Libellés FR / EN (sommaire, chapitres, colophon, dates) |
| `qa.ts` | Contrôle qualité sur le rendu Chromium |

Composant partagé : `src/components/editorial/prose-view.ts` (rendu du texte composé, **le même** pour la mesure et pour l'impression).

### 1.2 Flux de texte paginé avec mesure réelle

- Chaque paragraphe est rendu par `ProseView` dans la largeur exacte de la colonne, avec les polices embarquées, dans Chromium. On relève le caractère qui ouvre chaque ligne et si la coupure précédente est une **césure** (le glyphe du trait d'union généré est rattaché au caractère suivant : on lit son dernier rectangle).
- L'algorithme de coupure de Chromium est **glouton** (ligne par ligne). Un fragment de paragraphe recomposé dans la même largeur reproduit donc exactement les mêmes lignes : on peut couper un paragraphe entre deux pages sans estimation. Le fragment qui continue page suivante a sa dernière ligne justifiée (`text-align-last: justify`) et, si la coupure tombait dans un mot, le trait d'union est écrit (U+2010).
- Toutes les propriétés qui influencent la composition sont posées en ligne par `ProseView` (aucune dépendance à la feuille de style globale), ce qui garantit l'identité mesure / rendu. Le contrôle qualité **revérifie** sur le rendu final que chaque fragment a le nombre de lignes mesuré (`LINES_MISMATCH`).
- Les textes de gabarit de plusieurs lignes (titres, consignes, citations, dédicace, résumé) sont mesurés de la même façon : centrage optique, empilement et alignement sur la grille sans estimation.
- `estimateTextHeightMm` (moteur des kits) n'est **pas** utilisée.

**Coût mesuré** (démonstration, 26 à 28 pages) : composition 0,1 à 0,7 s (la première inclut le lancement de Chromium), PDF 1,3 à 6 s (la première compile la route dans `next dev`).

### 1.3 Pagination

- Veuves et orphelines : minimum 2 lignes ; un paragraphe de 3 lignes est reporté entier.
- Intertitres et ornements toujours suivis de 2 lignes ; espace avant supprimé en haut de page.
- Flottants : une illustration « figure » ouvre la page suivante (texte dessous, capacité réduite) ; citations, activités et souvenirs pleine page sont insérés à la prochaine fin de page **tombant entre deux paragraphes** (pas au milieu d'une phrase) ; une illustration pleine page peut s'insérer n'importe où.
- Mode impression : pages liminaires classiques (faux-titre, blanc, titre, colophon, dédicace, épigraphe, sommaire), chapitres sur page impaire, nombre pair de pages intérieures. Mode numérique : aucune page blanche, colonne centrée.
- Folios en chiffres elzéviriens, centrés en pied ; titres courants (verso : livre, recto : chapitre). Les folios sont écrits dans les blocs : la numérotation existante (`numberPages`) n'est pas utilisée pour ces livres.

### 1.4 Formats

`PAGE_FORMATS` (`src/lib/schemas/activity.ts`) gagne `A5_PORTRAIT` (148 × 210) et `PORTRAIT_3_4` (180 × 240), marqués `editorialOnly` : ils ne sont **pas** proposés dans les assistants de création La Malle à Jeux (filtre `isClassicPageFormat`). Les clés existantes sont inchangées.

### 1.5 Extensions rétrocompatibles du rendu

Toutes optionnelles ; absentes, le HTML produit est identique octet pour octet (test de non-régression).

- `TextStyleSchema` : `italic`, `weightNum`, `letterSpacingEm`, `uppercase`, `valign`, `features`, `hyphenate`, `lang`, `paragraphGapMm`, `noAutofit`, `strokeMm`, `opacity`, `balance`, `rotateDeg`.
- `ShapeBlockSchema` : forme `rule` (filet horizontal ou vertical).
- Nouveau bloc `prose` (texte composé) dans l'union `BlockSchema`.
- `PageLayoutSchema.editorial` (optionnel) : gabarit, folio, recto / verso, langue, page blanche volontaire, page aérée, fin de chapitre, zone de sécurité. `PageRenderer` en fait des attributs `data-ed-*` et `lang` (césure par page).

### 1.6 Contrôle qualité éditorial (`qa.ts`)

Collecte dans la page rendue (`collectQaSnapshot`, exécutée dans Chromium) puis analyse pure (`analyzeQa`). Chaque défaut a une sévérité, une page, un folio, un gabarit et souvent un bloc.

| Code | Sévérité | Contrôle |
|---|---|---|
| `EMPTY_PAGE` | critique | Page sans contenu visible, hors page blanche volontaire |
| `NEAR_EMPTY`, `LARGE_GAP` | avertissement | Remplissage < 25 % de la hauteur utile, ou espace vide > 38 % (pages non aérées, hors fins de chapitre ; une ligne d'écriture compte comme espace à remplir) |
| `SHORT_CHAPTER_END` | avertissement | Fin de chapitre de moins de 3 lignes |
| `OVERFLOW`, `AUTOFIT` | critique / avert. | Texte qui déborde (mesure réelle) ; texte réduit automatiquement |
| `OUT_OF_PAGE`, `OUTSIDE_SAFE` | critique / avert. | Bloc hors page ; encre hors colonne ou à moins de 6 mm de la coupe (8 mm en couverture) |
| `WIDOW`, `ORPHAN` | critique | Ligne isolée en haut ou en bas de page (comptée sur le rendu) |
| `LINES_MISMATCH` | critique | Le rendu ne reproduit pas la composition mesurée |
| `FOLIO_SEQUENCE`, `FOLIO_SIDE`, `FOLIO_TEXT`, `FOLIO_START` | critique / avert. | Pagination continue, recto impair, folio imprimé exact |
| `CHAPTER_VERSO`, `ODD_PAGE_COUNT` | critique / avert. | Impression : chapitre sur page paire, nombre impair de pages |
| `CONTRAST` | critique | Contraste WCAG du texte sur son fond effectif (fond propre, forme ou aplat dessous, page) |
| `TEXT_ON_IMAGE` | avertissement | Texte posé sur une image : contraste à vérifier |
| `FONT_ERROR`, `FONT_FALLBACK` | critique | Police non chargée ou remplacée |
| `PERSONALIZATION_MISSING` | critique | Donnée de personnalisation introuvable dans le livre (avec les pages où chacune apparaît) |

Le contrôle a été utile dès la démonstration : il a détecté un débordement réel (jambages de Fraunces au-delà du cadre des titres), corrigé depuis.

### 1.7 Démonstration

`apps/studio/scripts/unwritten-demo.ts` compose trois livres (un par collection), rédigés à la main, sans image ni appel d'IA :

| Livre | Collection | Langue | Format | Couverture | Pages (impression / numérique) |
|---|---|---|---|---|---|
| *The Lighthouse Keeper's Secret* | The Secret Book | anglais | A5 | Le sceau | 28 / 21 |
| *Before It's Too Late* | Before It's Too Late | français | carré 210 | La lettre | 26 / 20 |
| *Une vie en plan large* | The Movie of My Life | français | 3:4 | L'affiche | 26 / 20 |

**Méthode de rendu retenue : le vrai chemin du studio.** Le script démarre `next dev` sur un port libre (base de développement de `.env`, Postgres local), enregistre chaque livre dans la base (`Book` + `BookPage`, après un aller-retour par `PageLayoutSchema` qui échoue si un champ était perdu), imprime le PDF avec `renderBookPdf` sur `/print/books/[id]` (PageRenderer → Chromium), exécute le contrôle qualité sur cette même route, fait les captures PNG (deviceScaleFactor 1) et une planche de toutes les pages, puis arrête le serveur. Les livres de démonstration restent dans la base de développement (repérés par `brief = "unwritten-demo:<collection>:<mode>"`).

Résultat de la dernière exécution : **0 défaut critique, 0 avertissement** sur les 6 rendus ; toutes les données de personnalisation retrouvées.

### 1.8 Tests (`tests/editorial.test.ts`, 23 tests)

Pagination (veuves, orphelines, report d'un paragraphe de 3 lignes, intertitres, figures, pages pleines entre deux paragraphes) ; livre composé (chapitres sur page impaire, pas de page blanche en numérique, parité, folios continus) ; gabarits (tous présents, schéma valide, blocs dans la page, texte dans la colonne, petit fond côté reliure, texte intégral présent une fois, dans les 4 formats) ; sommaire ; couvertures ; découpe d'un fragment et césure ; typographie FR / EN ; contrastes ; polices ; contrôle qualité (page vide, contraste, veuve, orpheline, débordement, pagination, personnalisation, grand vide) ; **intégration Chromium** (mesure réelle, rendu PageRenderer, contrôle qualité sans défaut critique, détection d'une page vide et d'un contraste insuffisant sur le rendu réel) ; **non-régression La Malle à Jeux** (§ 5).

## 2. Limites connues

- **Pages courtes** : éviter veuves et orphelines laisse parfois une page d'une ou deux lignes plus courte que sa voisine. Pas encore de « page longue d'une ligne » ni d'ajustement de l'interlettrage pour rattraper.
- **Fin de chapitre** : une fin de chapitre peut tenir en quelques lignes sur sa page (signalé sous 3 lignes) ; aucun rééquilibrage des dernières pages.
- **Figure en fin de chapitre** : si le chapitre se termine avant la page suivante, l'illustration « figure » devient une pleine page.
- **Dernière ligne de paragraphe** : un mot seul en fin de paragraphe reste possible (`text-wrap: pretty` romprait la reproductibilité de la coupure gloutonne).
- **Impression** : pas encore de fond perdu de 3 mm ni de repères de coupe ; le PDF n'est pas « prêt pour l'imprimeur » tant que ses spécifications ne sont pas validées. La couverture est une page du PDF intérieur, pas un fichier de couverture avec dos.
- **Versions de Chromium** : la mesure et l'impression doivent utiliser le même Chromium (c'est le cas : `getBrowser()` dans le worker). Le contrôle `LINES_MISMATCH` est le garde-fou.
- **Studio** : un livre éditorial n'a pas encore d'écran dédié. Le bouton « Reconstruire les pages » d'un livre classique ne connaît pas ces livres ; ils se consultent par l'aperçu, l'éditeur de pages et l'export, qui fonctionnent.
- **Langues** : français et anglais ; d’autres langues demandent leurs libellés, leur microtypographie et une vérification de la césure de Chromium pour chacune.

## 3. Contrats d'utilisation

```ts
import { composeBook } from "@/lib/editorial/compose";
import { createChromiumMeasurer } from "@/lib/editorial/measure";
import { runEditorialQa } from "@/lib/editorial/qa";

const measurer = await createChromiumMeasurer();
const book = await composeBook(manuscrit, { format: "A5", mode: "print", measurer });
// book.pages → BookPage (layout validé par PageLayoutSchema), book.theme → Book.theme, book.pageFormat → Book.pageFormat
// … export PDF habituel, puis sur la page /print/books/[id] chargée :
const rapport = await runEditorialQa(page, { expect: book.expectations, mode: "print" });
if (!rapport.ok) { /* blocage : régénération ciblée ou file humaine */ }
```

## 4. Fichiers ajoutés et modifiés

- **Ajoutés** : `src/lib/editorial/*` (13 modules), `src/components/editorial/prose-view.ts`, `src/lib/demo/unwritten/*` (3 manuscrits), `scripts/unwritten-demo.ts`, `public/fonts/unwritten/*` (polices et licences), `tests/editorial.test.ts`, `tests/helpers/malle-reference.ts`, `tests/helpers/malle-render.ts`, `tests/fixtures/malle-*.golden.json`.
- **Modifiés (rétrocompatibles)** : `src/lib/schemas/layout.ts`, `src/components/page-renderer.tsx`, `src/lib/schemas/activity.ts` (formats), `src/components/book-wizard.tsx` et `src/components/kits/kit-wizard.tsx` (filtre des formats éditoriaux), `src/app/globals.css` (`@font-face`), `vitest.config.ts` (JSX des composants dans les tests).

## 5. Non-régression La Malle à Jeux

- Les gabarits des kits (`src/lib/kits/pages*.ts`) et le moteur des livres d'activités (`src/lib/layout/engine.ts`) ne sont ni modifiés ni appelés par le moteur éditorial.
- **Référence figée avant tout changement** : `tests/fixtures/malle-pages.golden.json` (pages de 7 types de livres et kits en A4 et carré) et `tests/fixtures/malle-render.golden.json` (empreinte SHA-256 du HTML de chacune de ces pages produit par `PageRenderer`). Les tests vérifient l'égalité exacte après les modifications.
- Les assistants de création ne proposent pas les nouveaux formats ; les modèles graphiques existants sont inchangés (test).
- Les 170 tests existants du studio restent verts.

## 6. Ce qui reste à construire

### 6.1 Pipeline par commande (étapes de `ARCHITECTURE_UNWRITTEN.md` § 3)
A Brief normalisé → B Architecture narrative → C Rédaction (sortie : **ce manuscrit structuré**) → D Bible visuelle → E Illustrations → F Composition (**fait**) → G Contrôle qualité (**fait pour la mise en page**) → H Export. À faire : type de tâche pg-boss `editorial_compose` dans le worker, `Book.origin = ORDER`, reprise par étape, blocage de la livraison sur défaut critique, régénération ciblée (un chapitre trop long, une illustration au mauvais contraste).

### 6.2 Bible visuelle
Par livre : personnages (âge, traits, vêtements), palette d'illustration dérivée de la collection, style, lieux, objets récurrents ; planche de référence générée une fois et passée à chaque illustration ; contrôle de cohérence par un modèle de vision. Les aplats actuels donnent la composition attendue (cadrage, place du texte) que les illustrations devront respecter.

### 6.3 Échelonnement des modèles
Haiku 5.5 (effort `low`) : extraction et normalisation du questionnaire, contrôles textuels simples ; Sonnet 5.5 : architecture narrative, bible visuelle, rédaction STANDARD ; Opus 5.5 : rédaction PREMIUM et révision finale (effort `medium`). Le studio n'utilise aujourd'hui qu'un modèle par livre (`lib/ai/registry.ts`) : il faut un choix par étape.

### 6.4 Profils ECO / STANDARD / PREMIUM
Réglages par profil : modèles par étape, effort, nombre et qualité des illustrations, budget maximal bloquant, nombre de régénérations (2 au plus). Les contrôles de qualité minimale et de sécurité ne dépendent jamais du profil. L'aperçu avant paiement est toujours ECO.

### 6.5 API Batch
Les commandes tolèrent quelques minutes : rédaction et révision envoyées par l'API Batch d'Anthropic (−50 % sur le texte), avec mise en cache des consignes stables (charte de collection, règles d'écriture). À prévoir : file de lots, reprise sur échec partiel, suivi du coût par commande (`GenerationLog` + `OrderCost`).

### 6.6 Composition
Fond perdu et fichiers imprimeur, doubles pages, QR codes (The Secret Book) avec contrôle de décodage, photos clients (The Movie of My Life) avec contrôle de résolution, rééquilibrage des fins de chapitre, écran du studio dédié aux livres éditoriaux, profil de couleur pour l'impression.
