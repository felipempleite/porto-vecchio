# Portivechju en relief

Ouvrir `portivechju.blend` dans Blender 5.2. Le fichier contient un terrain, deux caméras, les textures incorporées et cinq états sur la ligne du temps. Les images 1 à 4 correspondent au Terrier, à la mission de 1951–52, à 1975 et à 2024. L’image 5 donne les volumes du bâti actuel. L’emprise couvre 9,2685–9,3032° E et 41,5774–41,6040° N. Le texte « Lire · Sources et méthode » dans le fichier détaille la provenance.

Les dates des photographies proviennent des graphes de mosaïquage de l’IGN à Porto-Vecchio. La mission corse s’étend du 23 mars 1951 au 13 juillet 1952. Le passage de 1975 date du 16 juillet. Les photographies de la mosaïque actuelle sont de juillet 2024, et les bâtiments proviennent de la BD TOPO consultée le 20 novembre 2026. [Mission de 1951–52](https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ORTHOIMAGERY.ORTHOPHOTOS.1950-1965.GRAPHE-MOSAIQUAGE:graphe&bbox=9.285,41.59,9.286,41.591,CRS:84&propertyName=nom,begin_date,end_date&outputFormat=application/json) · [Vol de 1975](https://data.geopf.fr/wfs/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ORTHOIMAGERY.ORTHOPHOTOS.GRAPHE.1965-1980:graphe_bdortho&bbox=9.285,41.59,9.286,41.591,CRS:84&propertyName=dep,pva,date_vol&outputFormat=application/json).

Le site se sert directement avec un serveur de fichiers. Les outils ci-dessous concernent la production des illustrations ; le site publié ne les exécute pas.

Depuis la racine du dépôt :

```sh
blender -b sources/portivechju.blend -P tools/export_relief.py -- /tmp/relief
blender -b -P tools/render_corkworks.py -- /tmp/relief
blender -b -P tools/render_citadelle.py -- /tmp/relief
gltfpack -i /tmp/relief/portivechju.glb -o assets/relief/portivechju.glb -cc -kn -kv
```

Le premier script réutilise les textures et les emprises du fichier Blender, exporte le modèle web et crée les vues des chapitres. Pour le cadre régional, il télécharge les dalles WGS84G de l’IGN une seule fois dans le répertoire de sortie. Encoder les nouvelles planches en WebP avec `cwebp -q 83`. Les planches des autres époques sont rendues depuis les deux caméras du fichier source. Les textures `carte-*.webp` proviennent des quatre images incorporées, ramenées à 1536 pixels de large. Conserver l’attribut UV au compactage : ces textures sont posées à la demande.

Le module facultatif est compilé depuis `tools/relief-viewer.js` avec three@0.180.0 et esbuild@0.25.11 (`esbuild tools/relief-viewer.js --bundle --format=esm --minify --legal-comments=eof --outfile=js/relief-viewer.min.js`). Le GLB est compacté avec gltfpack@0.25.0. L’atlas ne charge ce module, le modèle et la carte demandée qu’à l’ouverture de la vue 3D.
