# DESIGN_SYSTEM_UNWRITTEN — Phase 2 : identité éditoriale et règles de composition

> Statut : **première version appliquée**. Les valeurs de ce document sont celles du code (`apps/studio/src/lib/editorial/`) ; les tests (`apps/studio/tests/editorial.test.ts`) en vérifient une partie (contrastes, polices, grilles).
> Périmètre : les **livres** UNWRITTEN produits par le studio. La vitrine (`apps/shop`) attend l'arbitrage A1 ; elle reprendra la palette et les polices décrites ici.

## 1. Intention

UNWRITTEN est une maison d'édition de livres personnalisés. Chaque livre est écrit pour un seul lecteur ; la mise en page doit donc avoir la tenue d'un livre de librairie, pas celle d'un produit personnalisé.

- **Élégant et contemporain** : une typographie de titrage actuelle, des filets fins, beaucoup d'air, aucune décoration gratuite.
- **Émotionnel sans pathos** : la chaleur vient du papier ivoire, de l'italique et du rythme du texte, pas d'ornements sentimentaux.
- **Intemporel** : une grille classique (ligne de base, petit fond, descente de chapitre), qui vieillira bien.
- **Minimaliste sans être froid** : une seule couleur d'accent (champagne), utilisée avec parcimonie.

## 2. Palette

### 2.1 Couleurs imposées

| Nom | Hex | Usage |
|---|---|---|
| Ivoire | `#F7F4EE` | Papier de toutes les pages intérieures, fonds clairs de couverture |
| Noir profond (encre) | `#171717` | Texte courant, titres, fonds sombres de couverture, aplats |
| Champagne | `#C5A77B` | Accent discret : filets, ornements, pastilles ; **texte uniquement sur fond encre** |
| Gris pierre | `#A7A39B` | Filets d'écriture, cadres, aplats ; **jamais pour du texte sur fond clair** |
| Blanc | `#FFFFFF` | Cadres photo, papier « lettre » d'une couverture, ciel des aplats |

### 2.2 Tons fonctionnels dérivés

La pierre et le champagne purs n'atteignent pas 4,5:1 sur ivoire. Deux tons assombris, de même teinte, sont réservés au texte secondaire :

| Nom | Hex | Dérivé de | Usage |
|---|---|---|---|
| Graphite | `#6B675F` | pierre | Titres courants, folios, légendes, mentions |
| Bronze | `#7A6544` | champagne | Intitulés de chapitre, numéros du sommaire, étiquettes d'activité |

### 2.3 Contrastes (WCAG 2.2, calculés)

Rapport de contraste = (L1 + 0,05) / (L2 + 0,05) avec la luminance relative WCAG. Calcul dans `src/lib/editorial/palette.ts` (`contrastRatio`), repris par le contrôle qualité.

| Texte \ Fond | Ivoire | Encre | Blanc | Pierre |
|---|---|---|---|---|
| Encre `#171717` | **16,33** ✅ | — | **17,93** ✅ | **7,13** ✅ |
| Ivoire `#F7F4EE` | — | **16,33** ✅ | 1,10 ❌ | 2,29 ❌ |
| Champagne `#C5A77B` | 2,08 ❌ | **7,84** ✅ | 2,29 ❌ | 1,10 ❌ |
| Pierre `#A7A39B` | 2,29 ❌ | **7,13** ✅ | 2,51 ❌ | — |
| Graphite `#6B675F` | **5,13** ✅ | 3,18 ⚠ | **5,63** ✅ | 2,24 ❌ |
| Bronze `#7A6544` | **5,07** ✅ | 3,22 ⚠ | **5,57** ✅ | 2,21 ❌ |

✅ ≥ 4,5:1 (AA texte courant) · ⚠ ≥ 3:1 (AA grand texte seulement) · ❌ interdit pour du texte.

**Règles qui en découlent** : texte sur ivoire ou blanc en encre, graphite ou bronze ; texte sur encre en ivoire, champagne ou pierre ; texte sur pierre en encre. Le contrôle qualité bloque tout texte sous le seuil (3:1 au-dessus de 18 pt ou 14 pt gras, 4,5:1 sinon).

## 3. Polices (SIL Open Font License 1.1 uniquement)

| Rôle | Police | Fichiers embarqués | Licence |
|---|---|---|---|
| Titrage (couvertures, titres, citations) | **Fraunces** (Undercase Type), variable `opsz` 9–144, `wght` 100–900, romain et italique | `fraunces-latin[-ext]-opsz-{normal,italic}.woff2` | SIL OFL 1.1 — `OFL-Fraunces.txt` |
| Texte des livres | **Newsreader** (Production Type), variable `opsz` 6–72, `wght` 200–800, romain et italique | `newsreader-latin[-ext]-opsz-{normal,italic}.woff2` | SIL OFL 1.1 — `OFL-Newsreader.txt` |
| Interface (studio, vitrine) | **Inter** (Rasmus Andersson), variable `wght` 100–900 | `inter-latin[-ext]-wght-normal.woff2` | SIL OFL 1.1 — `OFL-Inter.txt` |

- **Provenance** : paquets npm `@fontsource-variable/fraunces`, `@fontsource-variable/newsreader`, `@fontsource-variable/inter` (version 5.3.0), récupérés par `npm pack` puis copiés ; **aucune dépendance d'exécution ajoutée**. Sous-ensembles latin et latin-ext (français, anglais, espagnol, allemand, italien, langues d'Europe centrale). Total : environ 880 ko (licences comprises).
- **Emplacement** : `apps/studio/public/fonts/unwritten/`, avec les trois fichiers de licence. Déclarations `@font-face` dans `src/app/globals.css`, générées par `fontFaceCss()` (`src/lib/editorial/fonts.ts`) ; un test vérifie qu'elles concordent.
- **Rendu sans réseau** : les polices sont servies par l'application ; la mesure dans Chromium les lit directement sur le disque.

### Pourquoi ces choix

- **Newsreader** a été dessinée pour la lecture longue à l'écran et sur papier ; ses tailles optiques (`opsz`) ajustent automatiquement le dessin au corps (plus robuste à 10 pt, plus fin en titrage), son italique est véritable, ses chiffres elzéviriens (`onum`) s'accordent au texte. Son gris typographique est chaleureux sans être daté.
- **Fraunces** est un « Old Style » contemporain : à grand corps et graisse légère (300), il a l'élégance d'un titrage de maison d'édition, avec une personnalité plus actuelle qu'un Garamond. Ses tailles optiques vont jusqu'à 144 : les titres de couverture sont dessinés pour leur taille.
- **Inter** est la référence des interfaces : lisible, neutre, complète ; elle ne sert jamais dans les livres.
- **Cormorant Garamond écartée** après essai : dans les fichiers Google Fonts (variables comme statiques), les accents graves (à, è, ù) sont mal positionnés dans Chromium. C'est rédhibitoire pour des livres en français ; le défaut a été vu sur les captures de la démonstration, puis confirmé sur un échantillon isolé.

### Graisses utilisées

Fraunces 300 (titres, citations), 350 (titres d'activité), 400 (monogrammes) ; Newsreader 400 (texte), 450–500 (capitales espacées de 7 à 9 pt, qui s'éclaircissent sinon). Pas de gras dans le texte courant : l'emphase est en italique.

## 4. Échelle typographique

Quarte juste (rapport 4:3), dérivée du corps du texte courant, arrondie au quart de point (`typeScale()` dans `grid.ts`).

| Niveau | Coefficient | A5 | A4 / carré | 3:4 | Usage |
|---|---|---|---|---|---|
| micro | 0,68 | 7 pt | 8,25 pt | 7,5 pt | Capitales espacées : titres courants, intitulés, mentions |
| caption | 0,82 | 8,5 pt | 9,75 pt | 9 pt | Folios, légendes, colophon |
| body | 1 | **10,25 pt** | **12 pt** | **11 pt** | Texte courant |
| lead | 1,2 | 12,25 pt | 14,5 pt | 13,25 pt | Épigraphes, sous-titres |
| h3 | 1,333 | 13,75 pt | 16 pt | 14,75 pt | Titres de gabarit, citations (× 1,3) |
| h2 | 2,37 | 24,25 pt | 28,5 pt | 26 pt | Titres de chapitre |
| h1 | 3,16 | 32,5 pt | 38 pt | 34,75 pt | Page de titre |
| display | 4,21 | 43,25 pt | 50,5 pt | 46,25 pt | Couvertures (× 0,7 à 0,9 selon la direction) |

**Interlignages** : texte courant sur la ligne de base (13,6 pt en A5, soit 1,33) ; titrage 1,06 à 1,12 ; citations et dédicace 1,32 à 1,42 ; capitales espacées sur une ligne de la grille.

**Approches** : capitales espacées de 0,2 à 0,34 em ; attaque de chapitre (trois premiers mots) en petites capitales espacées de 0,07 em.

## 5. Grilles par format

Toutes les mesures en millimètres. La hauteur de la colonne est un **multiple exact de l'interligne** : chaque page pleine a le même nombre de lignes, alignées d'une page à l'autre et en vis-à-vis. Le **petit fond** (marge intérieure) est côté reliure : à gauche sur les pages impaires (recto), à droite sur les paires (verso). En sortie numérique, la colonne est centrée.

| Format | Page | Tête | Pied | Petit fond | Grand fond | Colonne | Ligne de base | Lignes | Signes / ligne | Descente de chapitre |
|---|---|---|---|---|---|---|---|---|---|---|
| A5 (`A5_PORTRAIT`) | 148 × 210 | 18 | 24 | 19 | 16 | 113 × 168 | 4,8 (13,6 pt) | 35 | ≈ 68 | 13 lignes |
| A4 (`A4_PORTRAIT`) | 210 × 297 | 26 | 35 | 28 | 40 | 142 × 236 | 5,9 (16,7 pt) | 40 | ≈ 73 | 13 lignes |
| Carré (`SQUARE`) | 210 × 210 | 24 | 29,4 | 27 | 38 | 145 × 156,6 | 5,8 (16,4 pt) | 27 | ≈ 74 | 10 lignes |
| 3:4 (`PORTRAIT_3_4`) | 180 × 240 | 21 | 28,2 | 22 | 27 | 131 × 190,8 | 5,3 (15 pt) | 36 | ≈ 73 | 12 lignes |

- **Justification** : 60 à 75 signes par ligne, la plage de confort de lecture (vérifiée par un test).
- **Pourquoi un grand fond plus large que le petit en A4 et carré** : ces formats sont larges ; la marge extérieure généreuse ramène la ligne à une longueur lisible et donne une respiration de livre d'art.
- **Colonnes** : six colonnes, gouttière de 4 à 5 mm, pour placer illustrations, champs et cadres photo.
- **Titres courants** : 2,3 lignes au-dessus de la colonne. **Folio** : centré sous la colonne, à 42 % du pied.
- **Descente de chapitre** : le texte d'ouverture commence au tiers de la page ; l'ensemble intitulé + titre + filet (+ épigraphe) se termine 2,5 lignes au-dessus. Elle s'allonge automatiquement si le titre est long.

## 6. Règles de composition

| Règle | Application |
|---|---|
| Justification | Texte courant justifié, césure automatique selon la langue (`hyphens: auto` + attribut `lang`), au moins 6 lettres par mot coupé et 3 de chaque côté (`hyphenate-limit-chars: 6 3 3`). Les échelles de césures sont mesurées (statistique `maxConsecutiveHyphens`) |
| Veuves et orphelines | **Au moins 2 lignes** d'un paragraphe en bas et en haut de page. Un paragraphe de 3 lignes qui ne tient pas passe entier à la page suivante (page courte d'une ligne, admise) |
| Intertitres et ornements | Jamais seuls en bas de page : toujours suivis d'au moins 2 lignes ; l'espace avant disparaît en haut de page |
| Paragraphes | Retrait de 1 em, sans espace entre paragraphes ; pas de retrait après un titre, un ornement ou une citation |
| Attaque de chapitre | Trois premiers mots en petites capitales espacées ; pas de lettrine (mesure moins fiable, effet décoratif) |
| Changement de scène | Trois points champagne centrés sur deux lignes |
| Citation dans le texte | Italique, retrait de 2 em des deux côtés, une ligne avant et après |
| Titres | Lignes équilibrées (`text-wrap: balance`) : jamais un mot seul sur la dernière ligne d'un titre ou d'une citation |
| Chiffres | Elzéviriens proportionnels dans le texte et les folios |
| Français | Espace fine insécable (U+202F) avant `; ! ?` et à l'intérieur des guillemets `« »` ; espace insécable (U+00A0) avant `:` ; apostrophe `’` ; tiret de dialogue suivi d'une insécable ; espace fine entre un nombre et son unité |
| Anglais | Guillemets “ ” et ‘ ’, apostrophe ’, tiret cadratin sans espaces, points de suspension … |
| Chapitres | Ouverture sur page impaire en mode impression (page blanche ajoutée si nécessaire) ; nombre pair de pages intérieures |
| Pages sans folio | Couverture, faux-titre, page de titre, colophon, dédicace, épigraphe, citations et illustrations pleine page, pages blanches (folio « aveugle » : la page compte dans la pagination) |
| Titres courants | Verso : titre du livre ; recto : titre du chapitre ; jamais sur une ouverture de chapitre |

Ces règles sont appliquées par `src/lib/editorial/typography.ts` (microtypographie), `paginate.ts` (pagination) et `compose.ts` (gabarits), puis **vérifiées sur le rendu** par `qa.ts`.

## 7. Composants éditoriaux (gabarits)

| Gabarit (`templateKey`) | Contenu | Folio |
|---|---|---|
| `ed_cover` | Première de couverture (3 directions par collection, § 9) | non |
| `ed_half_title` | Faux-titre : titre en capitales espacées, filet champagne | non |
| `ed_title` | Page de titre : collection, titre, sous-titre, « Écrit pour », destinataire, auteur, marque | non |
| `ed_colophon` | Verso du titre : édition, date, polices et licence, droits | non |
| `ed_dedication` | Dédicace en italique, signature en capitales | non |
| `ed_epigraph` | Épigraphe du livre | non |
| `ed_contents` | Sommaire : numéro bronze, titre, folio aligné à droite, sans points de conduite | oui |
| `ed_chapter_opening` | Intitulé, titre, filet, épigraphe, puis texte | oui |
| `ed_text` | Texte courant, titre courant | oui |
| `ed_text_figure` | Illustration en tête de page, légende, texte dessous | oui |
| `ed_illustration` | Illustration pleine page à fond perdu, légende | non |
| `ed_quote` | Citation pleine page, centrée à hauteur optique | non |
| `ed_activity` | Étiquette, titre, consigne, cases à cocher ou lignes d'écriture (sur la ligne de base, pas de 2 lignes) | oui |
| `ed_memory` | Page souvenir : cadre photo, champs (date, lieu…), lignes | oui |
| `ed_conclusion` | Ouverture de conclusion, texte, signature alignée à droite | oui |
| `ed_back_cover` | Quatrième : résumé, filet, citation, édition personnelle, marque | non |
| `ed_blank` | Page blanche volontaire | non |

## 8. Illustrations

- Une illustration réelle est un bloc image à fond perdu (pleine page) ou sur la largeur de la colonne (figure).
- **En l'absence d'illustration**, chaque collection a son **aplat** (formes géométriques de la palette, sans dégradé) : cercle champagne sur encre (The Secret Book), horizon pierre et soleil champagne (Before It's Too Late), cadre cinémascope (The Movie of My Life). Ce sont des emplacements assumés, jamais des images inventées.
- Légendes en italique graphite, centrées.

## 9. Couvertures : trois directions par collection

Toutes sont composées de typographie, de filets et d'aplats ; chacune a sa quatrième assortie (claire ou sombre). Code : `src/lib/editorial/covers.ts`.

### The Secret Book (le secret, la transmission)
1. **Le sceau** (`secret-seal`) : fond encre, double cercle champagne et monogramme en italique, titre ivoire. Un pli cacheté.
2. **L'enveloppe** (`secret-envelope`) : ivoire, enveloppe tracée au filet pierre, rabat en filets obliques, pastille champagne au monogramme. La lettre qu'on n'ouvre qu'une fois.
3. **Le caviardage** (`secret-redacted`) : page de texte noircie dont une seule ligne reste lisible, le prénom ; titre en bas à gauche. Contemporain, graphique.

### Before It's Too Late (dire avant qu'il ne soit trop tard)
1. **L'horizon** (`before-horizon`) : ciel ivoire, terre pierre, ligne d'horizon champagne ; titre léger posé au-dessus.
2. **La lettre** (`before-letter`) : papier blanc, date, « Chère maman, » en italique, lignes encore vides. Une lettre commencée.
3. **La ligne de vie** (`before-timeline`) : fond encre, ligne de temps champagne jalonnée d'années, ouverte sur aujourd'hui.

### The Movie of My Life (une vie racontée comme un film)
1. **L'affiche** (`movie-poster`) : fond encre, cadre au format 2,39:1, titre en capitales fines, générique en pied.
2. **Le carton-titre** (`movie-title-card`) : bandes noires de cinémascope, carton ivoire, titre en italique et années.
3. **La planche-contact** (`movie-contact-sheet`) : douze photogrammes en attente de souvenirs, un seul cerclé de champagne.

## 10. Interdits

- **Dégradés artificiels**, ombres portées, reflets, textures « papier » simulées, effets de dorure ou de relief : l'ivoire et le champagne suffisent (pas de « faux luxe »).
- **Polices décoratives** : pas de script, pas de faux manuscrit, pas plus de deux familles dans un livre.
- **Gras** dans le texte courant ; **soulignement** ; capitales non espacées dans le texte.
- **Icônes** : aucune dans les livres (ni émoji, ni pictogramme). Dans l'interface, une seule famille cohérente (Lucide, déjà utilisée par le studio).
- **Texte en champagne ou en pierre sur fond clair** (contraste insuffisant, § 2.3).
- **Grands vides involontaires** : page presque vide, grand espace au milieu d'une page de texte, page blanche non prévue. Les pages aérées par nature (couverture, faux-titre, dédicace, citation) et les fins de chapitre sont admises ; le contrôle qualité signale le reste.
- **Images générées présentées comme des photos ou des documents**, et souvenirs non vérifiés présentés comme des faits (« Tu racontes que… »).
- **Texte réduit pour tenir** : la composition est mesurée ; une réduction automatique est un défaut signalé.

## 11. Ce qui reste à faire

- Appliquer la palette et les polices à la vitrine (après l'arbitrage A1) et à l'interface du studio pour les livres UNWRITTEN.
- Fond perdu de 3 mm et repères de coupe pour l'imprimeur choisi (spécifications à valider).
- Doubles pages (illustration sur deux pages en vis-à-vis), lettrines, notes.
- Ornements propres à chaque collection (aujourd'hui, un seul ornement de scène).
