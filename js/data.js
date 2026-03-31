const DATA= {
  niederoesterreich: {
    name: "Niederösterreich",
    startplaetze: {
      "hohe-wand": {
        name: "Hohe Wand",
        description: "Klassisches Kalksteinplateau mit mehreren Startpunkten.",
        operator: {
          name: "Soaring Club Hohe Wand",
          url: "https://www.sc-hw.at"
        },
        parking: "Gasthof Postl",
        airspaces: ["TMA Wien"],
        webcam: "https://www.bergfex.at/hohewand/webcams/",
        flightOptions: ["Soaring", "Thermik", "Streckenflug"],

        startpunkte: [
          {
            name: "Oststart",
            id: "oststart",
            coordinates: { lat: 47.82925, lon: 16.04175 },
            startHeight: 935,
            heightDifference: 506,
            launchDirections: ["O", "SO"],
            difficulty: "mittel",
            startRating: 3,
            windSensitivity: "Rotor bei S-Wind",
            notes: "Breiter Wiesenstart."
          },
          {
            name: "Südstart",
            id: "suedstart",
            coordinates: { lat: 47.825, lon: 16.035 },
            startHeight: 870,
            heightDifference: 590,
            launchDirections: ["SO", "S"],
            difficulty: "mittel",
            startRating: 3,
            windSensitivity: "NO-O Rotor möglich",
            notes: "Diffizieler Platz – wenig Länge."
          }
        ],

        landeplaetze: [
          {
            name: "Weide-Maiersdorf",
            id: "maiersdorf",
            coordinates: { lat: 47.820, lon: 16.050 },
            height: 580,
            difficulty: "leicht",
            notes: "Große Landefläche."
          },
          {
            name: "Mautstation",
            id: "mautstation",
            coordinates: { lat: 47.82522, lon: 16.05944 },
            height: 500,
            difficulty: "mittel",
            notes: "Bei SO-Wind anspruchsvoll."
          }
        ]
      }
    }
  }
};
