# Rose Noire — site vitrine

Site de **Rose Noire**, fleuriste artisanale au Châtelain : Rue Américaine 160, 1050 Ixelles
(Fleur Concept SRL, BCE 0891.549.170). Sophie compose des fleurs fraîches de saison, des fleurs
séchées et artificielles, des gerbes et couronnes, des fleurs de mariage, et livre dans les
19 communes de Bruxelles, du mardi au dimanche.

**En ligne : https://michprk.github.io/rose-noire.be/**

Objectif : convertir la clientèle **professionnelle** (bureaux, hôtels, restaurants, agences,
événements) sans perdre les particuliers. Deux conversions : **demande de devis** (action
principale) et **commande de bouquet**, plus l’appel / WhatsApp en un clic.

## Direction artistique

Inspirée du gabarit « Premium 3D Glass » : une page cinématique où un objet en **verre optique**
(Three.js, réfraction et dispersion réelles) éclate en quatre fragments au défilement puis se
recompose. Ici l’objet est **la rose de la marque**, dessinée pour l’occasion (`assets/shapes/rose.svg`).

- Fond encre `#08060a`, rose vif `#ff4f8b` réservé aux actions, dégradé rose → corail pour
  les mots en italique, papier rosé `#fbf3f6` pour les sections claires.
- Titres en **Instrument Serif** (l’italique porte l’émotion), texte et interface en
  **Space Grotesk** (la police du gabarit de référence). Polices auto-hébergées.
- Verre partout : la rose 3D, la dalle de verre liquide derrière le formulaire (WebGL), les
  cartes « bento » en verre dépoli, l’en-tête qui devient une pilule de verre.

## Structure

```
index.html              accueil : scène 3D (4 chapitres), secteurs, offres entreprises, boutique,
                        atelier, références (Maison Blanche, ELLE, L’Éventail, avis), FAQ, contact
confidentialite.html    politique de confidentialité (RGPD) + cookies
cgu.html                conditions d’utilisation + mentions légales + crédits
404.html                « Cette page a perdu ses pétales » : devine la bonne section depuis
                        les anciennes adresses WordPress (fleuriste-ixelles, livraison…, nl/…)
partials/               blocs communs (en-tête, menu, pied de page, cookies, icônes)
assets/css/main.css     tout le style : couleurs, typographie, animations, responsive
assets/js/boot.js       chargé en premier (dans le <head>) : force le HTTPS, préchargeur
assets/js/app.js        interactions, animations au défilement, formulaires, cookies, mesure d’audience
assets/js/glass.js      la scène 3D (facultative) : rose en verre, fond, dalle du formulaire
assets/shapes/rose.svg  la silhouette de la rose (un seul contour, validé sans croisement)
assets/vendor/          Three.js r160 (version minifiée officielle) et son lecteur SVG
assets/fonts/           Instrument Serif, Space Grotesk (aucun appel à Google Fonts)
assets/img/             photos de la boutique compressées en WebP à plusieurs tailles
api/                    API des formulaires, hors du site (PHP pour Hostinger, ou Cloudflare Workers)
licenses/               licences Three.js (MIT) et polices (OFL)
favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png, icon-*.png, site.webmanifest
og.jpg                  image de partage (réseaux sociaux, WhatsApp…) 1200 × 630
robots.txt, sitemap.xml référencement
.htaccess, _headers     HTTPS forcé, en-têtes de sécurité, redirection des anciennes adresses
.well-known/security.txt contact sécurité
scripts/                build.sh, check-links.sh, export-hostinger.sh
```

Aucune dépendance à installer : HTML, CSS et JavaScript simples.

## Modifier le site

Les blocs communs sont écrits **une seule fois** dans `partials/` puis recopiés dans chaque page
entre `<!--#include nom-->` et `<!--/include-->`. Après toute modification (page, bloc commun,
`boot.js`, `main.css`, `app.js` ou `glass.js`) :

```bash
bash scripts/build.sh        # blocs communs, empreinte CSP, versions des fichiers
bash scripts/check-links.sh  # aucun lien ni aucune image cassés
```

Photos : les originaux viennent du site actuel (dossier `GitHub/_rose-noire-src/wp/`) ;
`_rose-noire-src/tool.html` les recadre et les compresse en WebP, `_rose-noire-src/brand.html`
produit les icônes, l’image de partage et l’image de secours de la rose.

## Animations (chacune est différente)

- **Préchargeur** : compteur 0 → 100 % et la rose qui respire.
- **Scène 3D** : la rose en verre tourne avec la souris, éclate en quatre fragments, se recompose,
  change de teinte à chaque chapitre (magenta, violet, corail, nacré) ; pollen lumineux ; titres
  qui montent de leur masque ; chiffres qui comptent ; curseur réticule qui affiche la progression.
- **Bande des secteurs** : défile en continu, accélère et change de sens avec le défilement.
- **Offres entreprises** : cartes de verre distribuées comme un jeu de cartes, inclinaison et
  reflet qui suivent la souris.
- **Boutique** : piste horizontale épinglée (ordinateur) ou au doigt (mobile), parallaxe des photos.
- **Atelier** : la photo de Sophie grandit jusqu’à remplir l’écran, puis sa citation apparaît ;
  badge circulaire qui tourne ; galerie en trois colonnes à vitesses différentes.
- **Références** : la lettre de la Maison Blanche se redresse ; la citation s’allume mot à mot.
- **Contact** : dalle de verre liquide (WebGL) derrière le formulaire, onglets à encre glissante.
- **Pied de page** : « Rose Noire » géant, lettres qui se lèvent et passent en italique au survol.

Toutes les animations sont actives pour tous les visiteurs. Le bouton « Réduire les animations »
du pied de page passe en version statique (image de la rose, fondus doux) ; choix mémorisé
(`rn_motion`). Aussi : `?motion=reduce`. Sans WebGL 2, la version statique s’affiche d’elle-même.

## Formulaires

- **Devis sur mesure** (entreprises, événements, mariages) : besoin, société, date ou rythme,
  nom, e-mail, téléphone, message. Les cartes d’offres présélectionnent le besoin.
- **Commander un bouquet** : occasion, livraison (15 €) ou retrait, budget, date, adresse, style,
  et le produit choisi dans la boutique.
- **Validation** en français sous chaque champ (pas de livraison le lundi, date passée, adresse…),
  correction des fautes de frappe d’e-mail (« gmial.com »), erreurs lues par les lecteurs d’écran.
- **Anti-spam** : champ piège invisible, envoi refusé en moins de 3 secondes, une demande par
  minute, un seul lien autorisé, limite par adresse IP côté API.
- **Envoi** : sans API, la messagerie du visiteur s’ouvre avec la demande pré-remplie vers
  rosenoire160@hotmail.com. Avec l’API (dossier `api/`, clés côté serveur uniquement), l’e-mail
  part directement : renseigner `data-api` dans les pages (automatique avec l’export Hostinger).

## Cookies et mesure d’audience

Aucun cookie publicitaire. La bannière demande l’accord (« Tout refuser » et « Tout accepter »
ont le même poids) ; « Gérer les cookies » permet de changer d’avis. Google Analytics 4 ne se
charge qu’après accord : coller l’identifiant `G-XXXXXXX` dans l’attribut `data-ga` de la balise
`<html>` de chaque page. Tant qu’il est vide, **aucune requête** ne part vers un service tiers.
Événements suivis : devis, commande, appels, WhatsApp, e-mail, itinéraire, Instagram, produits,
FAQ, erreurs de formulaire, page 404.

## HTTPS, sécurité, liens cassés

- `boot.js` redirige de `http://` vers `https://` ; GitHub Pages : *Enforce HTTPS* activé.
- `.htaccess` (Apache) et `_headers` (Netlify / Cloudflare) : redirection côté serveur, HSTS,
  CSP stricte (aucun script tiers sans accord), anti-iframe, cache long des fichiers versionnés.
- Les anciennes adresses du site WordPress (`/fleuriste-ixelles/`, `/livraison-de-fleurs-bruxelles/`,
  `/nl/…`, `/wp-…`) sont redirigées vers la bonne section ; la page 404 devine la page recherchée.

## Référencement et performance

Titres et descriptions uniques, Open Graph, données structurées `Florist` (adresse, horaires,
coordonnées GPS, TVA), `sitemap.xml` avec images, `robots.txt`, textes alternatifs sur toutes les
photos, polices préchargées (65 Ko), photos WebP à la bonne taille (`srcset`) chargées au dernier
moment, scène 3D en pause quand elle est cachée, contrastes AA.

> La maquette est en `noindex` pour ne pas apparaître dans Google avant l’accord de la boutique.
> `bash scripts/export-hostinger.sh` prépare la version finale pour rose-noire.be (sans noindex,
> adresses à la racine, formulaires reliés à `api/contact.php`).

## À confirmer avec la boutique

- Rythmes « chaque semaine ou à la quinzaine » des fleurs d’accueil, et facturation entreprise.
- Les textes de la Maison Blanche (lettre du 21 octobre 2014) et des avis City Plug, repris du site actuel.
- Frais de livraison 15 € (le site actuel affiche 15 € sur une page et 11 € sur d’anciennes pages).
- Ancienne adresse rue Antoine Dansaert 127 (mentionnée sur d’anciennes pages) : toujours active ?
- Autorisation d’utiliser les photos du site actuel ; photos récentes en haute définition bienvenues.
- Version néerlandaise (le site actuel en a une), identifiant Google Analytics, nom de domaine.
