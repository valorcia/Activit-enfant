# Prompts de production des e-books

Prompts prêts à coller dans Claude ou ChatGPT (mode copier-coller du studio ou production directe).
Chaque e-book se produit en trois temps :

1. **Contenu** (texte structuré en JSON) : prompt « Contenu » ci-dessous.
2. **Illustrations** : d'abord la planche de personnage (cohérence), puis une image par élément listé dans le JSON (champ `illustration_prompt`).
3. **Fiche boutique** : le JSON contient déjà la section `boutique`, à importer via l'API ou à recopier dans l'admin.

| E-book | Fichier |
|---|---|
| Chasse au trésor des dinosaures | `chasse-au-tresor-dinosaures.md` |
| Mission astronaute | `mission-astronaute.md` |
| Lutins farceurs : 30 idées pour Noël | `lutins-farceurs-noel.md` |
| Charte d'illustration commune | `style-illustrations.md` |
| Prompts d'images ChatGPT (3 e-books) | `images-openai.md` |
| Dinosaures : toutes les images en une demande | `dinosaures-images-tout-en-un.md` |
