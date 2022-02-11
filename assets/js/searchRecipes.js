function setupLunr(document){
  console.log('document', document)
  var recipes = document.recipes;
  document.idx = lunr(function() {
    this.field('id');
    this.field('title', { boost: 10 });
    this.field('category');
    this.field('tags');
    this.field('content');
    this.field('external_url');

    for (var key in recipes) { // Add the data to lunr
      var document = recipes[key]
      console.log('tags', document.tags)
      this.add({
        'id': key,
        'title': document.title,
        'category': document.category,
        'tags': document.tags,
        'content': document.content,
        'external_url': urlToSearchTokens(document.external_url)
      });
    }
  });
}

function urlToSearchTokens(url) {
  if (url === undefined || url === null || url == "") {
    return url
  }

  try {
    var parsed = new URL(url)
    var paths = parsed.pathname.split('/')
    var result = [parsed.hostname].concat(paths).filter(function(val){if(val)return val})
    console.log('urlToSearchTokens: produced <', result, '> from ', url)
    return result
  } catch(e) {
    console.warn(`${e} error encountered, skipping URL:`, url)
    return url
  }
}

function searchWithLunr() {
  var searchTerm = document.getElementById("search-box").value

  if (searchTerm === undefined || searchTerm === null || searchTerm == "") {
    document.getElementById('search-results').innerHTML = ""
    return
  }

  var results = document.idx.search(searchTerm); // Get lunr to perform a search
  console.log('term', searchTerm, 'results', results)
  displaySearchResults(results, document.recipes); // We'll write this in the next section
}

function displaySearchResults(results, store) {
  var searchResults = document.getElementById('search-results');

  if (results.length) { // Are there any results?
    var appendString = '<ol>';

    for (var i = 0; i < results.length; i++) {  // Iterate over the results
      var item = store[results[i].ref];
      appendString += '<li><a href="' + item.url + '"><h3>' + item.title + '</h3></a>';
      appendString += '<p>' + item.content.substring(0, 150) + '...</p></li>';
      appendString += '<p> Tags: ' + item.tags.join(" ") + '</p>'
    }

    searchResults.innerHTML = appendString + "</ol>";
  } else {
    searchResults.innerHTML = '<li>No results found</li>';
  }
}

document.addEventListener('readystatechange', (event) => {
  if (document.readyState === 'complete') {
    setupLunr(document)
  }
});