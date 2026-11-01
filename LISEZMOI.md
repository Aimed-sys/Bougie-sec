# BougieSec — site web (version 2)

## Ce qui change dans cette version

- **Design** : feuille de style `style.css` entièrement retravaillée (même identité verte / dorée, plus soignée), menu qui s'allège au défilement, lien actif dans le menu, couture « de sac » en pointillé comme signature, formulaire et commande plus lisibles, mobile revu.
- **Produits** : seuls 7 produits sont **disponibles** — tous les autres sont **indisponibles** (grisés, non sélectionnables) :
  Lentilles rouges décortiquées · Riz basmati étuvé · Haricots rouges LSB · Lentilles royales · Haricot blanc · Pois chiches · Riz étuvé.
  Nouvelle catégorie **Riz** (nouvelle carte N°4 + nouvelle fiche).
- **WhatsApp** : inchangé. Le formulaire ouvre toujours WhatsApp avec un message pré-rempli (produits, formats, quantités, poids total).
- **Admin** : refait, avec un onglet **Commandes** (base de données) et un onglet **Produits**.
- Les listes de produits sont maintenant **générées automatiquement** depuis `products-data.js` (ou la base) : plus besoin de copier-coller du HTML pour ajouter un produit.

## Fichiers

```
index.html            la page du site
style.css             tous les styles
script.js             le comportement (commande, formulaire, WhatsApp)
config.js             ← VOS identifiants Supabase (à remplir)
db.js                 communication avec la base de données
products-data.js      catalogue par défaut (noms, catégories, disponibilité)
supabase-setup.sql    à exécuter une fois dans Supabase
images/               (votre dossier actuel, inchangé — non inclus dans ce zip)
admin/                espace d'administration (index.html, style.css, script.js)
```

⚠ **Gardez votre dossier `images/` actuel.** Ce zip n'en contient pas : copiez simplement ces fichiers par-dessus votre projet (même dossier que l'ancien `index.html`).
Le dossier `admin/` de ce zip **remplace** l'ancien.

## Mot de passe de l'administration

- Adresse : `https://votre-site/admin/`
- **Mode test** (config.js vide) : mot de passe `18062008`, défini en haut de `admin/script.js`. Il est lisible dans le code : à utiliser seulement pour tester.
- **Mode base de données** (recommandé) : le mot de passe n'est **pas** dans le code. C'est le mot de passe du compte administrateur que vous créez dans Supabase (étape 3 ci-dessous) ; vous pouvez y mettre `18062008`.

## Base de données des commandes (Supabase) — étapes

Sans cette étape, le site marche mais les commandes ne sont gardées que dans le navigateur de la personne qui teste. Pour les recevoir dans `/admin` depuis n'importe quel appareil :

1. **Projet** : sur supabase.com, ouvrez votre projet `bougiesec`.
2. **Clés** : *Project Settings → API*. Copiez le **Project URL** et la clé **anon / publishable** (jamais la clé `service_role`).
3. **Compte admin** : *Authentication → Users → Add user* : votre email + mot de passe (confirmez l'email automatiquement si la case existe).
4. **Fermer les inscriptions** : *Authentication → Sign In / Providers → Email* → désactivez **Allow new users to sign up** (important : sinon n'importe qui pourrait créer un compte).
5. **Tables** : ouvrez `supabase-setup.sql`, remplacez `VOTRE_EMAIL_ADMIN` (une seule fois, dans la fonction) par l'email du compte admin, puis *SQL Editor → New query → collez → Run*.
6. **Config du site** : ouvrez `config.js` et remplissez `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `ADMIN_EMAIL`.
7. **Publiez** les fichiers (GitHub → Netlify, comme d'habitude).
8. **Première fois** : allez sur `/admin`, connectez-vous (seulement le mot de passe), onglet **Produits** → **Enregistrer**. Cela copie le catalogue dans la base.

## À tester après publication

- [ ] Le site affiche 7 produits disponibles, les autres grisés « Indisponible »
- [ ] Choisir un format + une quantité met à jour le récapitulatif
- [ ] Le formulaire sans nom / prénom / téléphone affiche l'erreur
- [ ] Le formulaire rempli ouvre WhatsApp avec le message pré-rempli
- [ ] `/admin` : la commande de test apparaît dans l'onglet Commandes
- [ ] Changer un prix ou une disponibilité dans Produits → Enregistrer → rafraîchir le site

## Rappels

- `<link rel="canonical">` dans `index.html` : remplacez `votre-domaine-a-definir.com` par votre vrai domaine.
- Prix : tant qu'un prix est vide, le site affiche « Prix sur demande ». Dès que tous les produits d'une commande ont un prix, une estimation en DA apparaît dans le récapitulatif et le message WhatsApp.
- Pour modifier un nom, un prix ou une disponibilité au quotidien, utilisez l'**admin** : inutile de toucher au code.
