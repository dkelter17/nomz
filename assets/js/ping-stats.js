function populatePingStats(document, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = () => {
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      if (httpRequest.status === 200) {
        const data = JSON.parse(httpRequest.responseText)
        callback(document, data)
      } else {
        console.error('There was a problem with the request.')
        console.error(httpRequest.status, httpRequest.responseText, httpRequest)
      }
    }
  };
  const countsURLSearchParams = new URLSearchParams()
  countsURLSearchParams.append('host', document.location.hostname)
  countsURLSearchParams.append('path', document.location.pathname)
  const countsURL = new URL('https://ping.parkermoo.re/counts')
  countsURL.search = `?${countsURLSearchParams.toString()}`
  httpRequest.open('GET', countsURL.toString(), true);
  httpRequest.send();
}

/**
 * Write visit and visitor counts to HTML
 *
 * @param document The current page's document
 * @param data An object containing 'visits' and 'visitors' keys with values as integers
 */
function writePingStatsToHTML(document, data) {
  const text = `Views: ${data.views} | Visitors: ${data.visitors}`
  console.log(text)
  document.getElementById("stats").innerText = text
}

(function(){
  document.addEventListener('readystatechange', (event) => {
    if (document.readyState === 'complete') {
      populatePingStats(document, writePingStatsToHTML)
    }
  });
})()