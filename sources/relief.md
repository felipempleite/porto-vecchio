# Portivechju en relief

Ouvrir `portivechju.blend` dans Blender 5.2. Le fichier contient un terrain, deux caméras, les textures incorporées et cinq états sur la ligne du temps. Les images 1 à 4 correspondent au Terrier, à la mission de 1951–52, à 1975 et à 2024. L’image 5 donne les volumes du bâti actuel. L’emprise couvre 9,2685–9,3032° E et 41,5774–41,6040° N. Le texte « Lire · Sources et méthode » dans le fichier détaille la provenance.

Les dates des photographies proviennent des graphes de mosaïquage de l’IGN à Porto-Vecchio. La mission corse s’étend du 23 mars 1951 au 13 juillet 1952. Le passage de 1975 date du 16 juillet. Les photographies de la mosaïque actuelle sont de juillet 2024, et les bâtiments proviennent de la BD TOPO consultée le 20 novembre 2026. [Mission de 1951–52](https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965.GRAPHE-MOSAIQUAGE:graphe&bbox=9.285,41.59,9.286,41.591,CRS:84&propertyName=nom,begin_date,end_date&outputFormat=application/json) · [Vol de 1975](https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ORTHOIMAGERY.ORTHOPHOTOS.GRAPHE.1965-1980:graphe_bdortho&bbox=9.285,41.59,9.286,41.591,CRS:84&propertyName=dep,pva,date_vol&outputFormat=application/json).

Dans `rivages.blend`, les images 1, 2 et 3 montrent la Marine et le quai de commerce en 1951–52, 1975 et 2024. La caméra et la lumière sont communes aux trois états. Le trait de rive, les îlots, les bassins et les principaux pontons suivent les photographies aériennes. La mer est représentée au niveau zéro et les hauteurs des ouvrages sont conventionnelles. La colline reprend le terrain actuel avec une échelle verticale doublée.

Les points de `rivages.json` sont exprimés en pixels depuis le coin supérieur gauche d’un détail des cartes `carte-*.webp`. Ajouter `cropOrigin` pour retrouver les coordonnées sur la photographie entière de 1536 × 1575 pixels. L’axe vertical de l’image suit la projection de Mercator. Les bandes des pontons sont définies par leur largeur en pixels et leur ligne médiane. `gridBounds` donne les bornes de la partie remplacée dans le terrain d’origine, en indices de sa grille. Le Terrier et la vue du bâti actuel utilisent la surface de référence.

Le plan de Petrucy et Charrier, daté de l’an XI (1802–03), se consulte comme un document indépendant dans le chapitre « Le sel ». Le détail couvre 520 × 600 pixels à partir de (100, 854) sur la reproduction de 1920 × 1568 pixels. Il montre la ville et les deux mentions « Salines ». La maquette du port s’appuie sur les trois missions photographiques ultérieures. [Notice de la BnF](https://catalogue.bnf.fr/ark:/12148/cb45412814f) · [Fac-similé](https://commons.wikimedia.org/?curid=120850042).

Le site se sert directement avec un serveur de fichiers. Les outils ci-dessous concernent la production des illustrations.

Depuis la racine du dépôt :

```sh
blender -b sources/portivechju.blend -P tools/export_relief.py -- /tmp/relief
blender -b -P tools/render_corkworks.py -- /tmp/relief
blender -b -P tools/render_citadelle.py -- /tmp/relief
gltfpack -i /tmp/relief/portivechju.glb -o assets/relief/portivechju.glb -cc -kn -km -kv -vtf
cp /tmp/relief/rivages.blend sources/rivages.blend
for an in 1951 1975 2024; do
  for vue in golfe ville port; do
    cwebp -quiet -q 85 -m 5 "/tmp/relief/$vue-$an.png" -o "assets/relief/$vue-$an.webp"
  done
done
node tools/check_relief.mjs
```

Le premier script réutilise les textures et les emprises du fichier Blender. Il appelle `tools/waterfront.py` pour remplacer le secteur du port, puis exporte le modèle web, les planches et la scène indépendante `rivages.blend`. Pour le cadre régional, il télécharge les dalles WGS84G de l’IGN une seule fois dans le répertoire de sortie. Les planches `golfe-*` et `ville-*` conservent la vue d’ensemble et le cadrage sur la ville. Les trois planches `port-*` montrent la rive vue depuis la mer. Encoder ces vues en WebP avec `cwebp -q 85 -m 5`. Les textures `carte-*.webp` proviennent des quatre images incorporées, ramenées à 1536 pixels de large. Le module web se sert des noms de matériaux, des noms d’objets et des coordonnées UV du modèle compacté.

Le GLB est compacté avec gltfpack@0.25.0. L’option `-vtf` préserve les coordonnées de la photographie commune aux différentes pièces. Le contrôle Node (`npm run check`) utilise la même version de Three.js que la page et vérifie la position de chaque sommet à un pixel près.

## La maquette de la page

La page est une seule scène Three.js placée derrière le texte. Les sources sont dans `src/` : `scenes.js` (la partition : caméra, lumière, époque et légendes de chaque étape), `stage.js` (la maquette) et `main.js` (le défilement, les photographies, les légendes, la version en images fixes). Elles sont compilées en un fichier, `js/lettre.min.js`, qui est versionné puisque le site est servi tel quel.

```sh
npm install
npm run build   # three@0.180.0 et esbuild@0.25.11
npm run dev     # serveur local avec recompilation ; relancer `npm run build` avant de valider
```

La page charge `portivechju.glb`, puis les cartes `carte-*.webp` à mesure que le récit les demande. Le Terrier et les trois photographies aériennes s’impriment sur le même relief ; les rives de 1951–52, 1975 et 2024 se relaient au même moment. Les volumes des bâtiments sont posés sur le terrain dans le navigateur, ce qui permet de les faire monter.

Le pays autour de la dalle vient de `assets/relief/region.png`, de Quenza à Santa Giulia (9,08–9,42° E, 41,50–41,80° N, environ 50 m par point). `tools/build_region.py` le produit à partir des dalles d’altitude de l’IGN (RGE ALTI, WMTS `ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`, WGS84G niveau 11). Les altitudes sont stockées sur 16 bits, octet fort dans le rouge et octet faible dans le vert, par pas de 0,25 m. Les hauteurs sont doublées, comme sur la dalle.

```sh
python3 tools/build_region.py   # numpy ; met les dalles en cache dans .cache-ign/
```

Sans WebGL 2, avec `prefers-reduced-motion` ou avec `?fixe` dans l’adresse, la page montre les planches de `assets/relief/` et les photographies à la place de la maquette. `?net` supprime l’amortissement du défilement, pour les captures.
