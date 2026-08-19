*WEATHERSTATION*

> A live weather dashboard built as an "instrument panel" — dial gauges, a monospace digital readout, and an animated hourly trend chart instead of plain text stats.

> Built on top of the WeatherAPI forecast.json endpoint, Weatherstation pulls current conditions, a 3-day forecast, hourly temperatures, and air quality data for any city, postcode, or GPS coordinate, then renders it as a dark, atmospheric control room rather than a typical weather card.

> Features
  * Analog dial gauges for UV index, wind, humidity, pressure, visibility, and gust speed — animated needles sweep to value on   load
  * 24-hour temperature trend rendered as an SVG line chart with the current hour marked
  * 3-day forecast strip with condition icons and rain-chance badges
  * Air quality index with EPA-level color coding, not just a raw pollutant number
  * Sunrise/sunset, feels-like temperature, and daily high/low
  * Geolocation support — one click to fetch weather at your current position
  * °C/°F unit toggle that re-scales every gauge and chart, not just the headline number
  * Recent searches and last-viewed city persisted with localStorage
  * Custom hand-drawn SVG weather icons (day/night variants) — no emoji or stock icon packs
  * Background mood shifts subtly for day/night and rainy conditions
  * Fully responsive, keyboard-accessible, and respects prefers-reduced-motion
    Stack

> Plain HTML, CSS, and vanilla JavaScript — no build step, no framework, no dependencies. Deploys as a zero-config static site.

> Setup
  * Clone the repo
  * Add your WeatherAPI key in script.js
