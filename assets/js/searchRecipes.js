function loadLunrIndex() {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = () => {
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      if (httpRequest.status === 200) {
        document.recipesSearch.recipes = JSON.parse(httpRequest.responseText)
        setupLunr(document)
      } else {
        console.error('There was a problem with the request.');
      }
    }
  };
  httpRequest.open('GET', document.recipesSearch.indexURL, true);
  httpRequest.send();
}

function setupLunr(document){
  var recipes = document.recipesSearch.recipes;
  document.recipesSearch.idx = lunr(function() {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('category');
    this.field('tags');
    this.field('content');
    this.field('external_url');
    this.field('author', { boost: 5 });
    this.field('source');

    for (var key in recipes) { // Add the data to lunr
      var recipe = recipes[key]
      this.add({
        'id': key,
        'title': recipe.title,
        'category': recipe.category,
        'tags': recipe.tags,
        'content': recipe.content,
        'external_url': urlToSearchTokens(recipe.external_url),
        'author': recipe.author,
        'source': recipe.source,
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

  var results = document.recipesSearch.idx.search(searchTerm); // Get lunr to perform a search
  console.log('term', searchTerm, 'results', results)
  displaySearchResults(results, document.recipesSearch.recipes); // We'll write this in the next section
}

function displaySearchResults(results, store) {
  var searchResults = document.getElementById('search-results');

  if (results.length) { // Are there any results?
    var appendString = '<ol>';

    for (var i = 0; i < results.length; i++) {  // Iterate over the results
      var item = store[results[i].ref];
      appendString += '<li>' + formatSearchResult(item) + '</li>';
    }

    searchResults.innerHTML = appendString + '</ol>';
  } else {
    searchResults.innerHTML = '<li>No results found</li>';
  }
}

function formatSearchResult(item) {
  var appendString = '';
  if (item.url != '') {
    appendString += '<a href="' + item.url + '"><h3>' + item.title + '</h3></a>';
    if (item.content != '') {
      appendString += '<p>' + item.content.substring(0, 190) + ' ...</p>';
    }
  } else {
    appendString += `<h3>${item.title}</h3>`;
    appendString += `<p>${item.source} by ${item.author}</p>`;
  }

  appendString += '<p> Tags: ' + item.tags.join(" ") + '</p>';
  return appendString
}

document.addEventListener('readystatechange', (event) => {
  if (document.readyState === 'complete') {
    loadLunrIndex(document)
  }
});
