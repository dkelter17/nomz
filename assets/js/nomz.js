"use strict";

function main(document) {
  interactiveChecklists(document) // Enable interactive checklists.
  setRandomizerPlaceholder('Loading recipes...')
  setSearchBoxPlaceholder('Loading recipes...')
  loadRecipesIndexIfNeeded(document)
    .then(() => {
      loadLunrIndex(document) // Load the lunr index.
      setupRandomizer(document)
    })
    .catch(error => {
      console.error('Error loading recipes index:', error)
      setRandomizerPlaceholder('Error loading recipes. Randomizer disabled.')
      setSearchBoxPlaceholder('Error loading recipes. Search disabled.')
    })
}

function interactiveChecklists(document) {
  const checkboxes = document.querySelectorAll(".task-list .task-list-item-checkbox")
  if (checkboxes && checkboxes.length > 0) {
    checkboxes.forEach((el) => el.removeAttribute("disabled"))
  }
}

function loadLunrIndex(document) {
  const numRecipes = document.nomzRecipes.recipes.indexed.size
  setupLunr(document)
  populateSearchIntoQ()
  populateQIntoSearchBox()
  setSearchBoxPlaceholder(`Search ${numRecipes} recipes...`)
}

// Gets the recipes index URL and version from the first <link> tag with rel="recipesSearchIndex".
// Returns an object with indexURL and version properties.
function getRecipesIndexPathAndVersion() {
  // 1. Get the indexURL from the first <link> tag with rel="recipesSearchIndex".
  const indexLink = document.querySelector('link[rel="recipesSearchIndex"]')
  if (!indexLink) {
    console.warn('No recipes index link found in the document.')
    return {
      indexURL: '',
      version: 'unknown'
    }
  }

  // 2. Get the href attribute of the indexLink.
  const indexURL = indexLink.getAttribute('href')
  console.log('Recipes index URL:', indexURL)

  // 3. Extract the ?version query parameter from the indexURL if it exists.
  const url = new URL(indexURL, document.nomzRecipes.baseAbsoluteURL || window.location.href)
  const version = url.searchParams.get('version')

  // 4. Return the indexURL and version.
  return {
    indexURL: indexURL,
    version: version || 'unknown'
  }
}

// Checks if the recipes index is already loaded in localStorage.
function isRecipesIndexLoaded() {
  const loadedHash = localStorage.getItem('recipesHash')
  const current = getRecipesIndexPathAndVersion()
  console.log('Loaded recipes hash:', loadedHash, 'Current version:', current.version)
  console.log('Is recipes index loaded:', loadedHash !== null && loadedHash === current.version, 'LocalStorage recipesJSON exists:', localStorage.getItem('recipesJSON') !== null)
  return loadedHash !== null && loadedHash === current.version && localStorage.getItem('recipesJSON') !== null
}

// Loads the recipes from the network into local storage.
function loadRecipesIndex() {
  // 1. Get the indexURL and version.
  const indexData = getRecipesIndexPathAndVersion()
  if (indexData.indexURL === '') {
    return Promise.reject(new Error('No recipes index URL found'))
  }
  // 2. Load the index from the indexURL and store it in localStorage.
 return fetch(indexData.indexURL)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    })
    .then(data => {
      localStorage.setItem('recipesHash', indexData.version)
      localStorage.setItem('recipesJSON', JSON.stringify(data))
      null
    })
}

// Loads the recipes index from localStorage if it exists, otherwise loads it from the network.
// Returns a Promise that resolves when the index is loaded.
// If the index is already loaded, it resolves immediately.
// The index can be read from document.nomzRecipes.
function loadRecipesIndexIfNeeded(document) {
  // Check if the index is already loaded.
  if (isRecipesIndexLoaded()) {
    console.log('Recipes index loaded from local storage.')
    document.nomzRecipes.recipes = buildRecipesIndexFromJSON(localStorage.getItem('recipesJSON'))
    return Promise.resolve()
  } else {
    console.log('Loading recipes index from network...')
    return loadRecipesIndex()
      .then(() => {
        document.nomzRecipes.recipes = buildRecipesIndexFromJSON(localStorage.getItem('recipesJSON'))
        console.log('Recipes index loaded successfully.')
      })
      .catch(error => {
        console.error('Error loading recipes index:', error)
      })
  }
}

function buildRecipesIndexFromJSON(recipesJSONStr) {
  const recipes = JSON.parse(recipesJSONStr)
  if (!recipes || typeof recipes !== 'object') {
    console.error('Invalid recipes JSON format:', recipesJSONStr)
    return {
      indexed: new Map(),
      all: [],
    }
  }
  const entries = Object.entries(recipes)
  const allRecipes = Array.from(entries, (recipeData, index) => {
    const slug = recipeData[0]
    const recipe = recipeData[1]
    recipe.slug = slug
    return recipe
  })
  return {
    indexed: new Map(allRecipes.map((recipe, index) => {
      return [recipe.slug, recipe]
    })),
    all: allRecipes,
  }
}

function setupLunr(document){
  const recipes = document.nomzRecipes.recipes.all
  document.nomzRecipes.idx = lunr(function() {
    this.ref('id')
    this.field('title', { boost: 10 })
    this.field('category')
    this.field('tags')
    this.field('content')
    this.field('external_url')
    this.field('author', { boost: 5 })
    this.field('source')

    for (var idx in recipes) { // Add the data to lunr
      var recipe = recipes[idx]
      this.add({
        'id': recipe.slug,
        'title': recipe.title,
        'category': recipe.category,
        'tags': recipe.tags,
        'content': recipe.content,
        'external_url': urlToSearchTokens(recipe.external_url),
        'author': recipe.author,
        'source': recipe.source,
      })
    }
  })
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

  var results = document.nomzRecipes.idx.search(searchTerm) // Get lunr to perform a search
  displaySearchResults(results, document.nomzRecipes.recipes.indexed) // We'll write this in the next section
}

function displaySearchResults(results, store) {
  var searchResults = document.getElementById('search-results')
  // Remove all child nodes from an element
  while (searchResults.firstChild) {
    searchResults.removeChild(searchResults.firstChild)
  }

  const searchResultsHeader = document.createElement('h2')
  searchResultsHeader.innerText = 'Search Results'
  searchResults.appendChild(searchResultsHeader)

  if (results.length) { // Are there any results?
    const resultsList = document.createElement('ol')

    for (var i = 0; i < results.length; i++) {  // Iterate over the results
      const item = store.get(results[i].ref)
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
    titleLink.href = document.nomzRecipes.baseURL + item.url
    titleLink.appendChild(document.createTextNode(item.title))
    titleH3.appendChild(titleLink)
    listItemEl.appendChild(titleH3)

    if (item.content != undefined && item.content != '') {
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

  const categoryTagsListEl = document.createElement('p')

  if (item.category != undefined && item.category != '') {
    const categoryEl = document.createElement('span')
    categoryEl.innerText = item.category
    categoryEl.classList.add('btn')
    categoryEl.classList.add('pill')
    categoryEl.classList.add('dark')
    categoryTagsListEl.appendChild(categoryEl)
  }

  const tags = item.tags || []
  if (tags.length > 0) {
    for (const tag of tags) {
      const tagEl = document.createElement('span')
      tagEl.innerText = tag
      tagEl.classList.add('btn')
      tagEl.classList.add('pill')
      categoryTagsListEl.appendChild(tagEl)
    }
  }

  if (categoryTagsListEl.childNodes.length > 0){
    listItemEl.appendChild(categoryTagsListEl)
  }
}

function populateSearchIntoQ() {
  document.getElementById("search-box").addEventListener('input', function() {
    var searchTerm = document.getElementById("search-box").value
    var searchParams = new URLSearchParams(window.location.search)
    searchParams.set('q', searchTerm)
    window.history.replaceState({}, '', `${window.location.pathname}?${searchParams}`)
  })
}

function populateQIntoSearchBox() {
  document.getElementById("search-box").value = new URLSearchParams(window.location.search).get('q')
  searchWithLunr()
}

function setSearchBoxPlaceholder(newPlaceholder) {
  const searchBox = document.getElementById("search-box")
  if (searchBox) {
    searchBox.placeholder = newPlaceholder
  }
}

function setRandomizerPlaceholder(newPlaceholder) {
  const randomizerSubmit = document.getElementById('randomizer-submit')
  if (randomizerSubmit) {
    randomizerSubmit.value = newPlaceholder
  }
}

function setupRandomizer(document) {
  setRandomizerPlaceholder('Randomize')
  const randomizerSubmit = document.getElementById('randomizer-submit')
  if (!randomizerSubmit) {
    return
  }
  randomizerSubmit.addEventListener("click", (event) => {
    console.warn("randomize clicked", event)
    const randomizerQuery = {
      category: document.getElementById("randomizer-category").value || "dinner",
      numResults: document.getElementById("randomizer-numResults").value || 10,
      maxWeekendRecipes: document.getElementById("randomizer-maxWeekendRecipes").value || 1,
      maxVegetarianRecipes: document.getElementById("randomizer-maxVegetarianRecipes").value || 3,
    }
    const recipes = randomize(randomizerQuery)
    displayRecipeResults(recipes)

    // TODO: write history.pushState which would allow these results to be re-populated, perhaps by index values.
  })
}

function randomize(randomizerQuery) {
  const numRandomNumbers = randomizerQuery.numResults*3 > 1000 ? 1000 : randomizerQuery.numResults*3
  const array = new Uint32Array(numRandomNumbers);
  self.crypto.getRandomValues(array);
  const allRecipes = document.nomzRecipes.recipes.all || [];

  var weekendRecipesSeen = 0
  var vegetarianRecipesSeen = 0
  const recipeListLen = allRecipes.length
  const recipeIndices = new Set(Array.from(array, (randomNum) => randomNum % recipeListLen))
  const recipes = Array.from(recipeIndices, function(randomIndex){
    return allRecipes[randomIndex]
  }).filter(function(candidate){
    if (candidate.day_of_week == "weekend") {
      weekendRecipesSeen++
    }
    if (candidate.vegetarian) {
      vegetarianRecipesSeen++
    }
    return candidate.category == randomizerQuery.category &&
      (candidate.day_of_week != "weekend" || weekendRecipesSeen <= randomizerQuery.maxWeekendRecipes) &&
      (!candidate.vegetarian || vegetarianRecipesSeen <= randomizerQuery.maxVegetarianRecipes)
  }).slice(0, randomizerQuery.numResults)

  return recipes
}

function displayRecipeResults(recipes) {
  var randomizerResults = document.getElementById('randomizer-results');

  if (recipes && recipes.length > 0) { // Are there any results?
    const resultsList = document.createElement('ol')
    for(const childNode of randomizerResults.childNodes) {
      randomizerResults.removeChild(childNode)
    }
    console.log("Recipes:", recipes)

    for (var i = 0; i < recipes.length; i++) {  // Iterate over the results
      const item = recipes[i];
      const listItem = document.createElement('li')
      formatSearchResult(listItem, item)
      resultsList.appendChild(listItem)
    }

    randomizerResults.appendChild(resultsList)
  } else {
    const noResultsFound = document.createElement('li')
    noResultsFound.innerText = 'No results found'
    randomizerResults.appendChild(noResultsFound)
  }
}

(function(document){
  document.addEventListener('readystatechange', (event) => {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      main(document)
    }
  });
})(document)
