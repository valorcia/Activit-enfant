# Activit-enfant

Monorepo pnpm regroupant deux applications :

| Dossier | Application | Rôle |
|---|---|---|
| `apps/shop` | **Boutique** (Capitaine Coquelicot) | Site e-commerce premium : vitrine, landing pages produits, back-office, Stripe Checkout, livraison numérique, marketing, API d'importation. Hébergée sur Vercel. |
| `apps/studio` | **Inventor Studio** | Studio de création assistée par IA de livres d'activités (génération, illustration, mise en page, export PDF). |

Les deux applications sont indépendantes (bases de données, déploiements) et communiquent par l'API d'importation de la boutique (`apps/shop/docs/API.md`) : un e-book produit par le studio peut être envoyé en brouillon dans la boutique, puis validé et publié depuis le back-office.

## Démarrage

```bash
pnpm install
pnpm --filter shop dev       # boutique sur http://localhost:3000
pnpm --filter inventor-studio dev
```

Voir `apps/shop/README.md` et `apps/studio/README.md` pour la configuration détaillée.
