import './App.css';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet'
import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";

function Search(props) {

  let timer = null
  const [results, setResults] = useState([])

  const inputChanged = e => {

    clearTimeout(timer)

    //show results from nominatim fetch after 500ms when user stops typing
    const newTimer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?q=${e.target.value}&format=json`, {
      }).then((response) => response.json())
        .then((res) => {
          setResults(res);
        })
    }, 500)

    timer = newTimer
  }

  //replace marker coordinates with these fetched
  function handleClick(item) {
    props.data2.map((obj, index) => {
      if (obj.title == props.data.current.item.title) {
        obj.geo.lat = parseFloat(item.lat);
        obj.geo.lon = parseFloat(item.lon);
      }
    })
    props.setPosition([parseFloat(item.lat), parseFloat(item.lon)])
  }

  return (
    <>
      <div className='search-input'>
        <input id='search' autoComplete='off' onFocus={(e) => e.target.value = ""} onChange={inputChanged}></input>
        <span style={{ cursor: "pointer" }} onClick={() => { document.getElementById("modal-search").style.display = "none" }}>×</span>
      </div>
      <div className='search-result'>
        {results.map(item => (
          <li style={{ cursor: "pointer" }} key={item.place_id} onClick={() => { handleClick(item); document.getElementById("modal-search").style.display = "none" }}>
            {item.display_name}
          </li>
        ))}
      </div>
    </>
  )
}


function App() {

  const [data, setData] = useState([])
  const [fetchedTime, setFetchedTime] = useState('')
  const [markers, setMarkers] = useState()
  const [visibleMarkers, setVisibleMarkers] = useState();
  const mapRef = useRef();

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(Infinity);
  const [sorting, setSorting] = useState()

  const [filteredData, setFilteredData] = useState(data)

  //define centers of cities here, "value" must match scrapped "city" value
  const citiesCenter = [
    { label: 'Wrocław', value: 'wroclaw', lat: 51.1089776, lon: 17.0326689 },
    { label: 'Kraków', value: 'krakow', lat: 50.0619474, lon: 19.9368564 },
    { label: 'Gdańsk', value: 'gdansk', lat: 54.3706858, lon: 18.61298210330077 },
  ]
  const [selectedCity, setSelectedCity] = useState(citiesCenter[0])
  const [position, setPosition] = useState(null)


  function filterData() {
    //filtering by price and time added, also current selected city
    let filtered = data.filter((item) => {
      return item.city === selectedCity.value && parseFloat(item?.price?.replace(' ', '')) >= minPrice && parseFloat(item?.price?.replace(' ', '')) <= maxPrice
    })
    switch (sorting) {
      case 'priceDesc':
        filtered.sort((a, b) => {
          const priceA = parseFloat(a?.price?.replace(' ', ''));
          const priceB = parseFloat(b?.price?.replace(' ', ''));
          return priceB - priceA;
        });
        break
      case 'priceAsc':
        filtered.sort((a, b) => {
          const priceA = parseFloat(a?.price?.replace(' ', ''));
          const priceB = parseFloat(b?.price?.replace(' ', ''));
          return priceA - priceB;
        });
        break
      case 'dateAsc':
        filtered.sort((a, b) => {
          let datea = a?.added?.split(".")
          let dateb = b?.added?.split(".")
          const dateA = new Date(datea[1] + " " + datea[0] + " " + datea[2])
          const dateB = new Date(dateb[1] + " " + dateb[0] + " " + dateb[2])
          return dateA - dateB;
        });
        break
      case 'dateDesc':
        filtered.sort((a, b) => {
          let datea = a?.added?.split(".")
          let dateb = b?.added?.split(".")
          const dateA = new Date(datea[1] + " " + datea[0] + " " + datea[2])
          const dateB = new Date(dateb[1] + " " + dateb[0] + " " + dateb[2])
          return dateB - dateA;
        });
        break
      default:
        break
    }
    setFilteredData(filtered)
  }

  const handleMinPrice = event => {
    let val = event.target.value == "" ? 0 : event.target.value
    setMinPrice(val);
  };

  const handleMaxPrice = event => {
    let val = event.target.value == "" ? Infinity : event.target.value
    setMaxPrice(val);
  };

  const handleSorting = event => {
    setSorting(event.target.value);
  };

  useEffect(() => {
    fetch('fetched_data/data_processed.json').then((res) => res.json()).then((data) => {
      setData(data)
    })
    fetch('fetched_data/scrap_date.json').then((res) => res.json()).then((data) => {
      setFetchedTime(data)
    })
    //setData(require('../public/fetched_data/data_processed.json'))
    // setFetchedTime(require('./fetched_data/scrap_date.json'))
    document.querySelector('.leaflet-tooltip-pane').style.display = 'none'
  }, [])

  useEffect(() => {
    filterData()
  }, [minPrice, maxPrice, sorting, selectedCity])

  useEffect(() => {
    setFilteredData(data)
    filterData()
  }, [data])

  const [refreshPins, setRefreshPins] = useState(true)

  useEffect(() => {
    const map = mapRef.current
    if (map && filteredData) {
      console.log("refresh2 " + map + JSON.stringify(map.getBounds()))
      const markers2 = filteredData.filter(m => map.getBounds().contains([m.geo.lat, m.geo.lon]));
      setMarkers(markers2);
    }
  }, [mapRef.current, filteredData])

  useEffect(() => {
    return markers !== undefined ? setRefreshPins(false) : setRefreshPins(true)
  }, [markers, visibleMarkers])

  //markers icons
  const pins = [
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png"
  ]

  var LeafIcon = L.Icon.extend({
    options: {
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41]
    }
  });

  var greenIcon = new LeafIcon({ iconUrl: pins[0] }),
    redIcon = new LeafIcon({ iconUrl: pins[1] }),
    blueIcon = new LeafIcon({ iconUrl: pins[2] });

  let popupRef = useRef({});

  let currentPin = useRef()
  let currenti = useRef()
  const [centerMap, setCenterMap] = useState(false)

  function HandleChanges(props) {
    const map = mapRef.current

    if (centerMap) { map.flyTo([selectedCity.lat, selectedCity.lon], 13); setCenterMap(false) }
    if (position) {
      map.flyTo([position[0], position[1]], 17)
    }
    const mapEvents = useMapEvents({
      moveend: () => {
        const markers2 = filteredData.filter(m => map.getBounds().pad(0.1).contains([m.geo.lat, m.geo.lon]));
        setMarkers(markers2);

      }, zoomend: () => {
        const markers2 = filteredData.filter(m => map.getBounds().pad(0.1).contains([m.geo.lat, m.geo.lon]));
        setMarkers(markers2);

        if (position) {
          setTimeout(() => props.popup.current[currenti.current].openPopup(), 500)
          setPosition(null)
        }

        let zoom = map.getZoom();
        if (zoom >= 15) {
          map.getPane('tooltipPane').style.display = 'block';
        } else {
          map.getPane('tooltipPane').style.display = 'none';
        }
      }
    });
    return null
  }


  useEffect(() => {
    if (markers) {
      console.log("markers")
      let vmarkers = markers.map((item, i) => {
        return (
          <Marker
            icon={item?.geo?.foundName ? greenIcon : item?.geo?.isAccurate ? redIcon : blueIcon}
            eventHandlers={{
              click: (e) => {
                window.location = `#${item.id}`
              },
              // popupclose: () => {},
              // popupopen: () => {}
            }}
            key={item.id}
            ref={(m) => { popupRef.current[item.id] = m }}
            position={[item?.geo?.lat, item?.geo?.lon]}
          >
            <Tooltip direction="top" offset={[0, -35]} opacity={1} permanent   >
              {item.rent ? (parseFloat(item.price.replace(" ", "")) + parseFloat(item.rent.replace(" ", ""))).toLocaleString('de-DE') : parseFloat(item.price.replace(" ", "")).toLocaleString('de-DE')}
            </Tooltip>
            <Popup>
              <div className='img' style={{ backgroundImage: `url('${item.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              <h1 className="title"><a href={item.link}>{item.title}</a></h1>
              <h2 className='location'>
                {item?.geo?.foundName ? <a href={`#${item.id}`} >
                  {item.location}<>, </>
                  {item?.geo?.foundName}
                </a> : <a href={`#${item.id}`} >{item.location}</a>}
                <button type='button' onClick={() => { currentPin.current = { item }; document.getElementById("modal-search").style.display = "flex"; document.getElementById("search").focus(); }}>przenieś</button>
              </h2>
              <p className='pin' dangerouslySetInnerHTML={{ __html: item.description }}></p>

              <div className='added'>
                <h3>
                  {item.added ? <><label className='addedLabel'>dodano: </label><p className='addedp'>{item.added}</p></> : null}
                  {item.refreshed ? <><label className='addedLabel'>odświeżono: </label><p className='addedp'>{item.refreshed}</p></> : null}
                </h3>
              </div>

              <div className='price'>
                <p className='mainprice'>{item.price}</p>
                {item.rent ? <p className='rent'>czynsz:<br></br>
                  {item.rent}</p> : null}
              </div>
            </Popup>
          </Marker>
        )
      })
      setVisibleMarkers(vmarkers)
    }
  }, [markers])


  return (
    <div className="App">
      {refreshPins ? <div id='loading'>ładuję</div> : null}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
        integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
        crossOrigin=''
      />

      <div id="modal">
        <p>
          ostatnia akutualizacja ogłoszeń: {fetchedTime}
        </p>
        <p>
          ikony: <a href='https://github.com/pointhi/leaflet-color-markers'>https://github.com/pointhi/leaflet-color-markers</a>
        </p>
        <button type='button' onClick={() => { document.getElementById("modal").style.display = "none" }}>close</button>
      </div>

      <div id='modal-search'>
        <Search data={currentPin} data2={filteredData} setPosition={setPosition} />
      </div>

      <div className="Map">
        <MapContainer
          ref={mapRef}
          preferCanvas={true} //optimization
          updateWhenZooming={false} //optimization
          updateWhenIdle={true} //optimization
          center={[selectedCity.lat, selectedCity.lon]}
          zoom={13}
          scrollWheelZoom={true} >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {visibleMarkers}
          <HandleChanges popup={popupRef} currenti={currenti} />
        </MapContainer>
      </div>

      <div className='list'>
        <div className='filters' id='filters'>
          <form>
            znalezionych ogłoszeń: {data.length} /
            wyfiltrowanych ogłoszeń: {filteredData.length}
            <div className='city'>
              <label htmlFor='city'>Miasto:</label>
              <select id='city' value={selectedCity?.label.value} onChange={e => { setSelectedCity(JSON.parse(e.target.value)); setCenterMap(true) }}>
                {citiesCenter.map((option) => (
                  <option value={JSON.stringify(option)}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className='price-header'>
              <label>Cena:</label>
            </div>
            <div className='filter-price'>
              <div className='price-maxmin'>
                <input id='price-min' placeholder='MIN' type={'number'} inputMode={'numeric'} onChange={handleMinPrice}></input>
              </div>
              <div className='price-maxmin'>
                <input id='price-max' placeholder='MAX' type={'number'} inputMode={'numeric'} onChange={handleMaxPrice}></input>
              </div>
            </div>
            <div className='sort'>
              <label htmlFor='sort'>Sortowanie:</label>
              <select id='sort' value={sorting} onChange={handleSorting}>
                {[{ value: '', label: '' },
                { value: 'priceAsc', label: 'najtańsze' },
                { value: 'priceDesc', label: 'najdroższe' },
                { value: 'dateAsc', label: 'najstarsze' },
                { value: 'dateDesc', label: 'najnowsze' }].map((option) => (
                  <option value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <p className='legend'>
              <img width={16} height={24} src={pins[1]} />pewna lokalizacja
              <img width={16} height={24} src={pins[0]} />przypuszczalna lokalizacja
              <img width={16} height={24} src={pins[2]} />lokalizacja na podstawie dzielnicy
            </p>
            <button type='button' onClick={() => { document.getElementById("modal").style.display = "flex" }}>info</button>
          </form>
        </div>
        <div className='ads'>
          {filteredData?.map((item, i) => (
            <div className='item' id={`${item.id}`} key={item.id}>
              <div className='img' style={{ backgroundImage: `url('${item.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              <div className='info'>
                <h1 className='title'><a href={item.link}>{item.title}</a></h1>
                <h2 className='location'>
                  {item?.geo?.foundName ? <img className='smallPin' src={pins[0]} /> : item?.geo?.isAccurate ? <img className='smallPin' src={pins[1]} /> : <img className='smallPin' src={pins[2]} />}
                  {item?.geo?.foundName ? <a href={`#${item.id}`} onClick={() => { setPosition([item.geo.lat, item.geo.lon]); popupRef.current = item; currenti.current = item.id }}>
                    {item.location}<>, </>
                    {item?.geo?.foundName}
                  </a> : <a href={`#${item.id}`} onClick={() => { setPosition([item.geo.lat, item.geo.lon]); popupRef.current = item; currenti.current = item.id }}>{item.location}</a>}
                </h2>
                <div className='added'>
                  <h3>
                    {item.added ? <><label className='addedLabel'>dodano: </label><p className='addedp'>{item.added}</p></> : null}
                    {item.refreshed ? <><label className='addedLabel'>odświeżono: </label><p className='addedp'>{item.refreshed}</p></> : null}
                  </h3>
                </div>
              </div>
              <div className='price'>
                <p className='mainprice'>{item.price}</p>
                {item.rent ? <p className='rent'>czynsz:<br></br>
                  {item.rent}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div >
  );
}

export default App;
