# flatss
node.js olx flats ads scrapper with frontend React page and leaflet openstreetmaps mapping

Node.js backend is scrapping flats ads from olx site. Then found ads are scanned with search for street names. They're compared with static file generated from https://overpass-turbo.eu/. Schema is as follows:
```
[out:json][timeout:25];
// fetch area “Gdańsk” to search in
{{geocodeArea:Gdańsk}}->.searchArea;
// gather results
(
  // query part for: “highway=*”
  way["highway"]["name"](area.searchArea);
);
out geom;
```

This way the marker is placed in more plausible location. It's also possible to move marker with address search based on data from https://nominatim.org/.

Leaflet dynamic markers loading is based on: https://stackblitz.com/edit/react-kcegra?file=index.html (rewritten into functional components).

demo:
<video src="https://user-images.githubusercontent.com/110261550/226462573-3ba2d1b3-c88a-4515-929b-00161ed9650a.mp4" />
