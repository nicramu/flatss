const express = require('express')
const cors = require('cors')
const http = require('http');
const fs = require('fs');
const path = require('path');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const got = require('got');
const { pipeline } = require('stream/promises');
const cron = require('node-cron');

const app = express()
const port = 3000

//secret token
const token = "123"

const streetData = [
  '/flatss/overpass_data/streets_wroclaw_overpass-turbo.json',
  '/flatss/overpass_data/streets_krakow_overpass-turbo.json',
  '/flatss/overpass_data/streets_gdansk_overpass-turbo.json'
]

const urls = [
  'https://www.olx.pl/d/nieruchomosci/mieszkania/wynajem/wroclaw/?search[order]=created_at%3Adesc',
  'https://www.olx.pl/d/nieruchomosci/mieszkania/wynajem/krakow/?search[order]=created_at%3Adesc',
  'https://www.olx.pl/d/nieruchomosci/mieszkania/wynajem/gdansk/?search[order]=created_at%3Adesc'
]

let scheduled = cron.schedule('0 4 * * *', async () => {
  console.log('running cron')
  await start()
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

app.use(express.static("build"));

app.use(cors());

http.createServer(app).listen(port);

app.get('/get', async (req, res) => {
  if (req.query.token && req.query.token === token) {

    let processedRes = await start()

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Max-Age', 2592000); // 30 days
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    //res.end(JSON.stringify(data));
    res.end(JSON.stringify(processedRes));
  } else {
    console.error("no token given")
    res.end("all good")
  }
})


async function start() {

  //add folder
  fs.mkdir("/flatss/build/fetched_data/images/", (err) => {
    if (err) {
      return console.error(err);
    }
    console.log('Directory created successfully!');
  })

  //delete images
  const directory = "/flatss/build/fetched_data/images/"
  fs.readdir(directory, (err, files) => {
    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
      });
    }
  });

  //scrap
  let merged = []
  for (let iter = 0; iter < urls.length; iter++) {
    let data = await scrap(urls[iter])
    merged = merged.concat(data)
  }

  //write to file
  fs.writeFileSync("/flatss/build/fetched_data/data_original.json", JSON.stringify(merged), (err) => {
    if (err) { console.log(err); }
  });
  console.log("Fetched data file written successfully")

  //process static file
  let processed = await processStatic()

  //write to file
  fs.writeFileSync("/flatss/build/fetched_data/data_processed.json", JSON.stringify(processed), (err) => {
    if (err) { console.log(err); }
  });
  console.log("Processed data file written successfully")

  //last scrap date
  fs.writeFileSync("/flatss/build/fetched_data/scrap_date.json", '"' + new Date().toLocaleString('pl-PL') + '"', (err) => {
    if (err) { console.log(err); }
  });
  console.log("Scrap date file written successfully")

  return processed
}


async function scrap(url) {

  console.log("scrapping started for " + url.substring(url.indexOf("wynajem/") + 8, url.indexOf("/?")))
  let jsondata = await got(url).then(response => {
    const dom = new JSDOM(response.body);
    //getting raw data and parsing it
    let rawdata = dom.window.document.querySelector('script#olx-init-config').text
    let rawdatacleanup = rawdata.match(/window.__PRERENDERED_STATE__\s*=\s*(.*)$/mi)[1].slice(0, -1)
    let jsondata = JSON.parse(JSON.parse(rawdatacleanup))
    return jsondata
  }).catch(err => {
    console.log(err);
  });

  //count all pages
  let allPages = jsondata.listing.listing.totalPages

  //loop trough pages
  let items = null //items per page
  let data = []

  //process first page without number, first ?page=2
  items = Object.keys(jsondata.listing.listing.ads).length;
  console.log("items per page: " + items + " | page: 1 out of all pages: " + allPages + " | city: " + url.substring(url.indexOf("wynajem/") + 8, url.indexOf("/?")))

  //loop trough items per page
  for (let i = 0; i < items; i++) {

    //check for duplicate
    let index = data.findIndex(x => x.link == jsondata.listing.listing.ads[i].url);
    if (index === -1) {

      let oneItem = {}
      //download img to local storage
      async function downloadimg(i) {
        if (jsondata.listing.listing.ads[i].photos[0]) {
          filename = Date.now().toString(36)
          saveto = '/flatss/build/fetched_data/images/' + filename + '.jpg'
          filepath = './fetched_data/images/' + filename + '.jpg'
          const readStream = got.stream(jsondata.listing.listing.ads[i].photos[0] + ";q=50", { throwHttpErrors: false })
          await pipeline(readStream, fs.createWriteStream(saveto))
          return filepath
        }
      }

      oneItem = {
        id: jsondata.listing.listing.ads[i].id,
        title: jsondata.listing.listing.ads[i].title,
        price: jsondata.listing.listing.ads[i].price.displayValue,
        rent: jsondata.listing.listing.ads[i]?.params[5]?.value,
        city: jsondata.listing.listing.ads[i].location.cityNormalizedName,
        location: jsondata.listing.listing.ads[i].location.districtName,
        added: new Date(jsondata.listing.listing.ads[i].createdTime).toLocaleString('pl'),
        refreshed: new Date(jsondata.listing.listing.ads[i].lastRefreshTime).toLocaleString('pl'),
        description: jsondata.listing.listing.ads[i].description,
        img: await downloadimg(i),
        geo: {
          isAccurate: jsondata.listing.listing.ads[i].map.show_detailed,
          lat: jsondata.listing.listing.ads[i].map.show_detailed ? jsondata.listing.listing.ads[i].map.lat : jsondata.listing.listing.ads[i].map.lat + Math.random() * (0.005 - 0.003) + 0.003,
          lon: jsondata.listing.listing.ads[i].map.show_detailed ? jsondata.listing.listing.ads[i].map.lon : jsondata.listing.listing.ads[i].map.lon + Math.random() * (0.005 - 0.003) + 0.003
        },
        link: jsondata.listing.listing.ads[i].url,
      }

      data.push(oneItem)
    } else {
      console.log("object already exists");
      continue;
    }

  }

  //process the rest of the pages, numbered form ?page=2
  for (let currentPage = 2; currentPage < allPages + 1; currentPage++) {

    jsondata = await got([url.slice(0, url.lastIndexOf('/')), `/?page=${currentPage}`, url.slice(url.lastIndexOf('/') + 1)].join('')).then(response => {
      const dom = new JSDOM(response.body);
      //getting raw data and parsing it
      let rawdata = dom.window.document.querySelector('script#olx-init-config').text
      let rawdatacleanup = rawdata.match(/window.__PRERENDERED_STATE__\s*=\s*(.*)$/mi)[1].slice(0, -1)
      let jsondata = JSON.parse(JSON.parse(rawdatacleanup))
      return jsondata
    }).catch(err => {
      console.log(err);
    });

    items = Object.keys(jsondata.listing.listing.ads).length;
    console.log("items per page: " + items + " | page: " + currentPage + " out of all pages: " + allPages + " | city: " + url.substring(url.indexOf("wynajem/") + 8, url.indexOf("/?")))

    //loop trough items per page
    for (let i = 0; i < items; i++) {
      //check for duplicate
      let index = data.findIndex(x => x.link == jsondata.listing.listing.ads[i].url);
      if (index === -1) {

        let oneItem = {}
        //download img to local storage
        async function downloadimg(i) {
          if (jsondata.listing.listing.ads[i].photos[0]) {
            filename = Date.now().toString(36)
            saveto = '/flatss/build/fetched_data/images/' + filename + '.jpg'
            filepath = './fetched_data/images/' + filename + '.jpg'
            const readStream = got.stream(jsondata.listing.listing.ads[i].photos[0] + ";q=50", { throwHttpErrors: false })
            await pipeline(readStream, fs.createWriteStream(saveto))
            return filepath
          }
        }

        oneItem = {
          id: jsondata.listing.listing.ads[i].id,
          title: jsondata.listing.listing.ads[i].title,
          price: jsondata.listing.listing.ads[i].price.displayValue,
          rent: jsondata.listing.listing.ads[i]?.params[5]?.value,
          city: jsondata.listing.listing.ads[i].location.cityNormalizedName,
          location: jsondata.listing.listing.ads[i].location.districtName,
          added: new Date(jsondata.listing.listing.ads[i].createdTime).toLocaleString('pl'),
          refreshed: new Date(jsondata.listing.listing.ads[i].lastRefreshTime).toLocaleString('pl'),
          description: jsondata.listing.listing.ads[i].description,
          img: await downloadimg(i),
          geo: {
            isAccurate: jsondata.listing.listing.ads[i].map.show_detailed,
            lat: jsondata.listing.listing.ads[i].map.show_detailed ? jsondata.listing.listing.ads[i].map.lat : jsondata.listing.listing.ads[i].map.lat + Math.random() * (0.005 - 0.003) + 0.003,
            lon: jsondata.listing.listing.ads[i].map.show_detailed ? jsondata.listing.listing.ads[i].map.lon : jsondata.listing.listing.ads[i].map.lon + Math.random() * (0.005 - 0.003) + 0.003
          },
          link: jsondata.listing.listing.ads[i].url,
        }

        data.push(oneItem)

      } else {
        console.log("object already exists");
        continue;
      }
    }

  }

  return data

}

async function processStatic() {
  console.log("processing scrapped with overpass data start")
  //json with street names and coordinates per city
  let streetDataCurrent = ''

  const data = JSON.parse(fs.readFileSync('/flatss/build/fetched_data/data_original.json'))
  let incl = []
  for (let i = 0; i < data.length; i++) {

    switch (data[i].city) {
      case 'wroclaw':
        streetDataCurrent = JSON.parse(fs.readFileSync(streetData[0]))
        break;
      case 'krakow':
        streetDataCurrent = JSON.parse(fs.readFileSync(streetData[1]))
        break;
      case 'gdansk':
        streetDataCurrent = JSON.parse(fs.readFileSync(streetData[2]))
        break;
      default:
        console.log("no city info found")
        streetDataCurrent = JSON.parse(fs.readFileSync(streetData[0]))
    }

    if (data[i].description && data[i].title && !data[i].geo.isAccurate) { //if geo.isAccurate == true skip processing

      //first search with prefix in title
      let regex = /(?<!(ale\s))(?<=(\s|\W)(ul. |ul |ul.|ul|pl|pl. |pl.|pl |al|al |al.|al. |ulicy ))[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{4,}/img;
      let found = data[i].title.match(regex)
      if (found) {
        let cleanup = []
        for (let n = 0; n < streetDataCurrent.features.length; n++) {
          //for each name from json file check if it includes found string
          if (streetDataCurrent.features[n].properties.name.includes(found[0])) {
            cleanup.push({
              title: data[i].title,
              geo: {
                extractedName: found[0],
                foundName: streetDataCurrent.features[n].properties.name,
                lat: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][1] + Math.random() * (0.0005 - 0.0001) + 0.0001,
                lon: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][0] + Math.random() * (0.0005 - 0.0001) + 0.0001
              }
            })
          }
        }
        //get middle value of geo coordinates - it'll center the pin on street
        incl.push(cleanup[Math.floor(cleanup.length / 2)])
      }

      //if not found, search with prefix in description
      found = data[i].description.match(regex)
      if (found) {
        let cleanup = []
        for (let n = 0; n < streetDataCurrent.features.length; n++) {
          //for each name from json file check if it includes found string
          if (streetDataCurrent.features[n].properties.name.includes(found[0].slice(0, -3))) {
            cleanup.push({
              title: data[i].title,
              geo: {
                extractedName: found[0],
                foundName: streetDataCurrent.features[n].properties.name,
                lat: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][1] + Math.random() * (0.0005 - 0.0001) + 0.0001,
                lon: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][0] + Math.random() * (0.0005 - 0.0001) + 0.0001
              }
            })
          }
        }
        //get middle value of geo coordinates - it'll center the pin on street
        incl.push(cleanup[Math.floor(cleanup.length / 2)])


        //if not found, serach for whole world in description TODO


      }
    }
  }
  let merged = [];

  for (let i = 0; i < data.length; i++) {
    merged.push({
      ...data[i],
      ...(incl.find((itmInner) => itmInner?.title === data[i]?.title))
    }
    );
  }

  //if not found, search for whole world in title
  cleanup = []
  for (let i = 0; i < merged.length; i++) {
    found = merged[i].title.replace(/,|\.|\/|-/g, ' ').replace('  ', ' ').split(" ")
    for (let n = 0; n < streetDataCurrent.features.length; n++) {
      for (let x = 0; x < found.length; x++) {
        if (found[x] === streetDataCurrent.features[n].properties.name && Object.keys(merged[i].geo).length === 0) {
          cleanup.push({
            title: merged[i].title,
            geo: {
              extractedName: found[x],
              foundName: streetDataCurrent.features[n].properties.name,
              lat: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][1] + Math.random() * (0.0005 - 0.0001) + 0.0001,
              lon: streetDataCurrent.features[n].geometry.coordinates[Math.floor(streetDataCurrent.features[n].geometry.coordinates.length / 2)][0] + Math.random() * (0.0005 - 0.0001) + 0.0001
            }
          })
        }
      }
    }
  }
  incl.push(cleanup[Math.floor(cleanup.length / 2)])

  let merged2 = [];

  for (let i = 0; i < merged.length; i++) {
    merged2.push({
      ...merged[i],
      ...(incl.find((itmInner) => itmInner?.title === merged[i]?.title))
    }
    );
  }

  console.log("processing scrapped with overpass data stop")

  return merged2
}