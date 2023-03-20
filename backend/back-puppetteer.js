const http = require('https');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const got = require('got');
require('request');

const options = {
  key: fs.readFileSync(path.resolve('key.pem')),
  cert: fs.readFileSync(path.resolve('cert.pem'))
};


const url = 'https://www.olx.pl/d/nieruchomosci/mieszkania/wynajem/wroclaw/?search[order]=created_at%3Adesc';

http.createServer(options, async (request, res) => {
  if (request.method === "GET") {

    got('https://www.olx.pl/d/oferta/3-pokoje-taras-miejsce-postojowe-wroclaw-ul-gorlicka-psie-pole-CID3-IDMsav8.html').then(response => {
      const dom = new JSDOM(response.body);
      console.log(dom.window.document.querySelector('script#olx-init-config').text);
    }).catch(err => {
      console.log(err);
    });

  //  let data = await scrap()
  //  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });

  //  res.end(JSON.stringify(data));
  } else {
    console.error("error")
    res.end("error")
  }
}).listen(3000, () => {
  console.log(`server started`);
});



async function scrap() {
  console.log("scrapping started")
  const browser = await puppeteer.launch({
    //dumpio: true //output browser logs to server
    //headless: false
  });
  const page = await browser.newPage();

  console.time('opening page')

  await page.goto(url, { waitUntil: 'domcontentloaded' });


  // Wait for headers to appear
  //const itemTitle = 'h6.css-1pvd0aj-Text.eu5v0x0';
  // await page.waitForSelector(itemTitle);

  console.timeEnd('opening page')


  //count pages
  const pagesCount = await page.evaluate(() => {
    let length = document.querySelectorAll('li.pagination-item.css-brmwmy a').length
    return document.querySelectorAll('li.pagination-item.css-brmwmy a')[length - 1].innerText
  })
  console.log("Pages found: " + pagesCount)


  //loop trough pages
  let resu = await loopTroughItems()
  console.log("Items found: " + resu.length)

  async function loopTroughItems() {
    let data = []
    for (let currentPage = 1; currentPage < 2/*parseInt(pagesCount) + 1*/; currentPage++) {
      //change page
      await page.goto(url + `&page=${currentPage}`, { waitUntil: 'domcontentloaded' });

      //count items per page
      let count = await page.evaluate(() => { return document.querySelectorAll('div[data-cy="l-card"]').length })
      console.log("items per page found: " + count)

      //get links to items
      let links = await page.evaluate(() => { let ret = []; document.querySelectorAll('div[data-cy="l-card"] a').forEach(i => { ret.push(i.href) }); return ret })


      //loop trough items
      for (let i = 0; i < links.length; i++) {
        await page.goto(links[i], { waitUntil: 'load' })
        //await page.waitForTimeout(10000)

       // let htmlSource = await page.content()
        let url = page.url()
        let oneItem = {}


        //console.log(url+" "+htmlSource.includes('olx-init-config'))




        if (url.includes('olx')) {

          let asd = JSON.parse((await fetch(url).then(r => r.text())).match(/window.__PRERENDERED_STATE__\s*=\s*(.*)$/mi)[1].slice(0, -1))        
          
          console.log(asd)
          //let info = await page.$eval('#olx-init-config', el => el.text)
          //let infojson = JSON.parse(info.split('window.__PRERENDERED_STATE__= "')[1].substring(0,info.split('window.__PRERENDERED_STATE__= "')[1].indexOf('window.')-11))
  
          oneItem = {
            title: await page.$eval('h1',el => el.innerText),
            price: await page.$eval('h3',el => el.innerText),
            rent: await page.$$eval('p.css-xl6fe0-Text.eu5v0x0',el => {return  el.map(e => e.textContent).filter(word=>word.includes('Czynsz'))[0]}),
            location: infojson['ad']['ad']['location']['districtName'],
            added: infojson['ad']['ad']['createdTime'],
            refreshed: infojson['ad']['ad']['lastRefreshTime'],
            description: infojson['ad']['ad']['description'],
            img: await page.$eval('img',el => el.src),
            geo: { lat: infojson['ad']['ad']['map']['lat'], lon: infojson['ad']['ad']['map']['lon'] },
            link: page.url(),
          }
        } else {
          //if offer is from partner site
          oneItem = {
            title: 'partner site ' + page.url()
          }
        }
        data.push(oneItem)


        /* 
                let item = await page.evaluate(async(i) => {
                  let oneItem = {}
                  if (document.URL.includes('olx')) {
                    //if offer is from olx site
                    //check if rent exists
                    let rent = Array.from(document.querySelectorAll('p.css-xl6fe0-Text.eu5v0x0')).find(el => { return el.textContent.includes('Czynsz') });
                    //get id for details fetch
                    let id = document.querySelector('span.css-1aw4772-Text.eu5v0x0')?.innerText.split(':')[1].trim()
                    //id itemu fetch("https://www.olx.pl/api/v1/targeting/data/?page=ad&params%5Bad_id%5D=792643281").then(res => res.json()).then(data => console.log(data));
                    //details fetch
                    let userdId = await detailsFetch()
                    async function detailsFetch() {
                      const response = await fetch(`https://www.olx.pl/api/v1/targeting/data/?page=ad&params%5Bad_id%5D=${id}`);
                      const json = await response.json();
                      return json.data.targeting.seller_id
                    }
                    let coordinates = await detailsFetch2()
                    async function detailsFetch2() {
                      const response = await fetch(`https://www.olx.pl/api/v1/offers/?user_id=${userdId}&offset=0&limit=1`);
                      const json = await response.json();
                      return json.data[0]?.map
                    }
        
                    oneItem = {
                      id: id,
                      userid: userdId,
                      title: document.querySelector('h1').innerText,
                      price: document.querySelector('h3').innerText,
                      rent: rent?.innerText,
                      location: document.querySelector('p.css-7xdcwc-Text.eu5v0x0').innerText,
                      added: document.querySelector('span.css-19yf5ek').innerText,
                      description: document.querySelector('div.css-g5mtbi-Text').innerText,
                      img: document.querySelector('img')?.src,
                      geo: {lat: coordinates?.lat, lon: coordinates?.lon, asd:'asd'},
                      link: document.URL,
                    }
                  } else {
                    //if offer is from partner site
                    oneItem = {
                      title: 'partner site ' + document.URL
                    }
                  }
                  return oneItem
                }, i)
                data.push(item) */
      }
      //data = data.concat(allItems)
      //loop trough every item
      /*       const items = await page.evaluate(() => {
      
              async function fetchGeo(streetregex) {
                return fetch('https://nominatim.openstreetmap.org/search.php?city=Wrocław&street=' + streetregex + '&format=jsonv2').then((res) => res.json()).then((data) => console.log(data))
              }
      
      
      
      
              let data2 = []
              document.querySelectorAll('div[data-cy="l-card"]')
                .forEach(i => data2.push({
                  title: i.querySelector('h6.css-1pvd0aj-Text.eu5v0x0').textContent,
                  price: i.querySelector('p.css-1q7gvpp-Text.eu5v0x0')?.innerText.includes('\n') ? i.querySelector('p.css-1q7gvpp-Text.eu5v0x0')?.innerText.replace('\n', ' (') + ')' : i.querySelector('p.css-1q7gvpp-Text.eu5v0x0')?.innerText,
                  location: i.querySelector('p.css-p6wsjo-Text.eu5v0x0').textContent.split('-')[0].trim(),
                  added: i.querySelector('p.css-p6wsjo-Text.eu5v0x0').textContent.split('-')[1].trim(),
                  img: i.querySelector('img').src,
                  link: i.querySelector('a').href,
                  street: findStreetRegex(i.querySelector('h6.css-1pvd0aj-Text.eu5v0x0').textContent)
                }))
              return data2
            }) */

      //data = data.concat(items)
    }
    return data
  }




  //close
  console.log("closing")
  await browser.close();
  return resu

}


async function findStreetRegex(string) {
  const regex = /(?:((ul|pl|al)\.?(\s|\S)))[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]*/img;
  let result = regex.exec(string)[0].toLowerCase()
  if (result.includes('ul') || result.includes('pl') || result.includes('al')) {
    return result.split(' ')[1].trim()
  } else { return null }
}