# Brancher un domaine sur un univers

Une seule application (un projet Vercel, une base) sert tous les univers. L'univers d'une requête est choisi par `src/proxy.ts`, dans cet ordre :

1. **domaine exact** d'un univers Actif, puis Test (`www.` ignoré : `finileauverte.fr` couvre aussi `www.finileauverte.fr`) ;
2. **sous-domaine du domaine hub** : `<slug>.<HUB_DOMAIN>` (variable d'environnement facultative, ex. `HUB_DOMAIN=boutiques.valorcia.com`), y compris pour un univers en Test ;
3. **aperçu** : `/?site=<slug>` pose le cookie `site_preview` (7 jours) pour un univers Actif ou Test ; `/?site=` le retire ;
4. sinon **l'univers par défaut** (La Malle à Jeux).

Un univers **Test** est servi sur ses domaines et en aperçu, mais jamais indexé (`robots.txt` bloque tout, balise `noindex`, absent de l'API publique des moteurs) : on peut vérifier DNS, TLS et rendu avant l'ouverture. Un univers **Archivé** n'est plus servi.

## Checklist pour un nouvel univers

### 1. Créer l'univers (5 min)
- [ ] Admin → **Univers & domaines** → *Nouvel univers* : nom, slug, audience, préréglage (`guide-expert` pour un guide adulte, `recettes`, `sciences-enfants`, `kit-enfants`), statut **Test**. Les catégories de départ du préréglage sont créées.
- [ ] Sélectionner l'univers dans le menu de l'admin, puis **Apparence** (logo, couleurs, accueil) et **Paramètres → SEO / Analytics** : ces écrans affichent « Univers : … » et ne modifient que lui.
- [ ] Créer les produits (admin, CSV avec l'univers sélectionné, ou API avec `siteSlug`).
- [ ] Vérifier en aperçu : bouton *Aperçu* (`/?site=<slug>`).

### 2. Domaine sur Vercel (10 min)
- [ ] Acheter le domaine (registraire au choix, ou Vercel Domains).
- [ ] Vercel → projet de la boutique (Root Directory `apps/shop`) → **Settings → Domains** → ajouter `exemple.fr` **et** `www.exemple.fr`. Choisir celui qui redirige vers l'autre (recommandé : apex → `www`).
- [ ] DNS chez le registraire, valeurs affichées par Vercel :
  - apex `exemple.fr` : enregistrement **A** → `76.76.21.21` ;
  - `www` : **CNAME** → `cname.vercel-dns.com`.
  (Ou déléguer les serveurs de noms à Vercel : `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.)
- [ ] Attendre « Valid Configuration » et le certificat TLS (quelques minutes, jusqu'à 48 h selon le TTL).

### 3. Rattacher le domaine à l'univers (2 min)
- [ ] Admin → Univers & domaines → modifier l'univers : **Domaines** `exemple.fr` (un par ligne), **Domaine principal** `www.exemple.fr` si c'est la version canonique (c'est lui qui sert aux liens des emails, au sitemap, aux URLs de retour Stripe et à l'API `publicUrl`).
- [ ] Passer le statut à **Actif**.
- [ ] Contrôler : `https://www.exemple.fr/` (accueil de l'univers), `/boutique`, une fiche produit, `/sitemap.xml` (URLs absolues sur le domaine), `/robots.txt` (indexation autorisée si SEO → indexation cochée).

### 4. Meta (15 min, par univers)
- [ ] Business Manager → Paramètres → **Brand Safety → Domaines** → *Ajouter* `exemple.fr` → méthode **balise méta** → copier le contenu de `facebook-domain-verification`.
- [ ] Admin (univers sélectionné) → Paramètres → SEO → *Vérification Meta* → coller, enregistrer, puis cliquer *Vérifier* chez Meta.
- [ ] Pixel : celui de l'audience de l'univers (ou un pixel dédié) dans Paramètres → Analytics, univers sélectionné. Événements web : prioriser `Purchase` pour le domaine.
- [ ] Page Facebook / Instagram de l'audience connectée et rattachée à l'audience (Marketing social → Connecteurs).

### 5. Google (facultatif)
- [ ] Search Console → propriété de domaine (TXT DNS) ou préfixe d'URL (balise : Paramètres → SEO → *Vérification Google*).
- [ ] Soumettre `https://www.exemple.fr/sitemap.xml`.

### 6. Stripe
Rien à configurer : le libellé bancaire (`statement_descriptor_suffix`) reprend le nom de l'univers (22 caractères max), la session porte `metadata.siteId`, les URLs de succès/annulation utilisent le domaine de l'univers, et le webhook unique (`/api/stripe/webhook` sur l'adresse de l'application) livre la commande avec les emails de son univers.

## Développement local

```bash
curl -H "Host: finileauverte.test" http://localhost:3000/        # domaine d'un univers actif
open "http://localhost:3000/?site=fini-l-eau-verte"               # aperçu (cookie)
HUB_DOMAIN=localtest.me pnpm dev  # puis http://fini-l-eau-verte.localtest.me:3000 (résout vers 127.0.0.1)
```

## Supprimer ou retirer un univers
- **Archiver** (statut Archivé) : plus servi, données conservées (commandes, factures, accès aux téléchargements restent valides).
- **Supprimer** : seulement sans produits, packs ni commandes (univers de test) ; ses catégories, collections, pages, articles et abonnés sont supprimés. L'univers par défaut ne peut être ni archivé ni supprimé.
- Retirer ensuite le domaine dans Vercel.
