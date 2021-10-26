// This is an example of loading a beryl gbfs data onto a mapbox map.
// you'll need a mapbox accessToken.
// https://docs.mapbox.com/help/glossary/access-token/
mapboxgl.accessToken = `<YOUR_MAPBOX_TOKEN>`;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  center: [-1.849634547032906, 52.5473807294093],
  zoom: 10,
});

map.scrollZoom.disable();
map.addControl(new mapboxgl.NavigationControl());

map.on("load", async () => {
  const stationsUrl =
    "https://gbfs.beryl.cc/v2/West_Midlands/station_information.json";
  const regionsUrl =
    "https://gbfs.beryl.cc/v2/West_Midlands/geofencing_zones.json";

  // Get some data from beryls gbfs feed.
  const [responseBounderies, responseStations] = await Promise.all([
    fetch(regionsUrl).then((res) => res.json()),
    fetch(stationsUrl).then((res) => res.json()),
  ]);

  // this stores <description>: [lat, long]
  // so that look ups via the <button> eventListner
  // are simple.
  const geoJSONCache = {}

  const regionsGeoJson =
    responseBounderies.data.geofencing_zones.features.reduce(
      (acc, feature) => {
        feature.properties.description =
          feature.properties.name + " region";
        acc.features.push(feature);

        const coordinates = feature.geometry.coordinates[0][0][0].slice(0, 2);
        geoJSONCache[feature.properties.description] = coordinates;
        return acc;
      },
      {
        type: "FeatureCollection",
        features: [],
      }
    );

  const stationsGeoJson = responseStations.data.stations.sort((a, b) => {
    // This ensures the tab order from top-to-bottom.
    if (a.lat < b.lat) {
      return 1
    } else if (a.lat > b.lat) {
      return -1
    } else {
      return 0
    }
  }).reduce(
    (acc, station, index) => {
      // build station geojson from station response.
      const feature = {
        type: "Feature",
        properties: {
          id: station.id,
          name: station.name,
          capacity: station.capacity,
          description: station.name + " station",
          tabindex: index,
        },
        geometry: {
          type: "Point",
          coordinates: [station.lon, station.lat],
        },
      };

      acc.features.push(feature);
      const coordinates = feature.geometry.coordinates;
      geoJSONCache[feature.properties.description] = coordinates;

      return acc;
    },
    {
      type: "FeatureCollection",
      features: [],
    }
  );

  map.addLayer({
    id: "stations",
    type: "symbol",
    source: {
      type: "geojson",
      data: stationsGeoJson,
    },
    layout: {
      "icon-image": "bicycle-share",
    },
  });

  map.addLayer({
    id: "regions",
    type: "line",
    source: {
      type: "geojson",
      data: regionsGeoJson,
    },
    layout: {},
    paint: {
      "line-color": "#fb406f",
      "line-width": 3,
    },
  });

  map.addControl(
    new MapboxAccessibility({
      // A string value representing a property key in the data. This
      // will be used as the text in voiceover.
      accessibleLabelProperty: "description",
      // The layers within the style that
      // 1. Contain the `accessibleLabelProperty` value as a key
      // 2. Should be used for voiceover.
      layers: ["stations", "regions"],
    })
  );

  const eventHandler = (e) => {
    const description = e.target.ariaLabel;
    const coordinates = geoJSONCache[description]

    const popup = new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(description)
      .addTo(map);

    popup.on('close', () => {
      // Focus back on the feature that opened the popup.
      e.target.focus()
    })
  };

  const container = map.getContainer()

  // click load the popup.
  container.addEventListener("click", (e) => {
    // Note there is a easier way to do this 
    // via the map.on('click') api however
    // this is simpler way to share behaviour with keydown.
    // something mapbox events don't support.
    if (
      e.target.className === "mapboxgl-accessibility-marker"
    ) {
      e.preventDefault();
      eventHandler(e)
    }
  });

  // give keyboard user the same behaviour as mouse.
  container.addEventListener("keydown", (e) => {
    if (
      e.which === 13 &&
      e.target.className === "mapboxgl-accessibility-marker"
    ) {
      e.preventDefault();
      eventHandler(e)
    }
  });

  const mapDescription = document.createTextNode(`The map displays the ${regionsGeoJson.features.length} regions and ${stationsGeoJson.features.length} stations of Beryl bike share scheme in West Midlands.`);
  container.appendChild(mapDescription);
});
