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
  for(const childNode of searchResults.childNodes) {
    searchResults.removeChild(childNode)
  }

  if (results.length) { // Are there any results?
    const resultsList = document.createElement('ol')

    for (var i = 0; i < results.length; i++) {  // Iterate over the results
      const item = store[results[i].ref];
      const listItem = document.createElement('li')
      formatSearchResult(listItem, item)
      resultsList.appendChild(listItem)
    }

    searchResults.appendChild(resultsList)
  } else {
    const noResultsFound = document.createElement('li')
    noResultsFound.innerText = 'No results found.'
    searchResults.appendChild(noResultsFound)
  }
}

function formatSearchResult(listItemEl, item) {
  const titleH3 = document.createElement('h3')
  if (item.url && item.url != '') {
    const titleLink = document.createElement('a')
    titleLink.href = document.recipesSearch.baseURL + item.url
    titleLink.appendChild(document.createTextNode(item.title))
    titleH3.appendChild(titleLink)
    listItemEl.appendChild(titleH3)

    if (item.content != '') {
      const contentEl = document.createElement('p')
      contentEl.innerText = item.content.substring(0, 190) + ' ...'
      listItemEl.appendChild(contentEl)
    }
  } else {
    titleH3.innerText = item.title
    const source = document.createElement('p')
    source.classList.add('no-bottom-margin')
    source.innerText = `${item.source} by ${item.author}`
    listItemEl.appendChild(titleH3)
    listItemEl.appendChild(source)
  }

  if (item.drive_url && item.drive_url != ''){
    const driveURLIconLink = document.createElement('a')
    driveURLIconLink.title = `View ${item.title} on Google Drive`
    driveURLIconLink.href = item.drive_url
    driveURLIconLink.innerText = ` △`
    titleH3.appendChild(driveURLIconLink)
  }

  const tags = item.tags || []
  if (tags.length > 0) {
    const tagsWithHash = tags.map((tag) => `#${tag}`)
    const tagsListEl = document.createElement('p')
    tagsListEl.innerText = `Tags: ${tagsWithHash.join(' ')}`
    listItemEl.appendChild(tagsListEl)
  }
}

document.addEventListener('readystatechange', (event) => {
  if (document.readyState === 'complete') {
    loadLunrIndex(document)
  }
});
