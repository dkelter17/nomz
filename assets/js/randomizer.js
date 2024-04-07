function loadRecipeDatabase(document) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = () => {
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      if (httpRequest.status === 200) {
        document.recipesRandomizer.recipes = JSON.parse(httpRequest.responseText)
        setupRandomizer(document)
      } else {
        console.error('There was a problem with the request.');
      }
    }
  };
  httpRequest.open('GET', document.recipesRandomizer.indexURL, true);
  httpRequest.send();
}

function setupRandomizer(document) {
  document.getElementById("randomizer-submit").addEventListener("click", (event) => {
    const randomizerQuery = {
      numResults: document.getElementById("randomizer-numResults").value || 10,
      maxWeekendRecipes: document.getElementById("randomizer-maxWeekendRecipes").value || 1
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

  var weekendRecipesSeen = 0
  const recipeListLen = document.recipesRandomizer.recipes.length
  const recipeIndices = new Set(Array.from(array, (randomNum) => randomNum % recipeListLen))
  const recipes = Array.from(recipeIndices, function(randomIndex){
    return document.recipesRandomizer.recipes[randomIndex]
  }).filter(function(candidate){
    if (candidate.day_of_week == "weekend") {
      weekendRecipesSeen++
    }
    return candidate.category == "dinner" &&
      (candidate.day_of_week != "weekend" || weekendRecipesSeen <= randomizerQuery.maxWeekendRecipes)
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
    console.error(recipes)

    for (var i = 0; i < recipes.length; i++) {  // Iterate over the results
      const item = recipes[i]
      const recipeListItem = document.createElement('li')

      const titleH3 = document.createElement('h3')
      if (item.url) {
        const titleLink = document.createElement('a')
        titleLink.href = item.url
        titleLink.appendChild(document.createTextNode(item.title))
        titleH3.appendChild(titleLink)
        recipeListItem.appendChild(titleH3)
      } else {
        titleH3.innerText = item.title
        const source = document.createElement('p')
        source.classList.add('no-bottom-margin')
        source.appendChild(document.createTextNode(`Source: ${item.source} by ${item.author}`))
        recipeListItem.appendChild(titleH3)
        recipeListItem.appendChild(source)
      }

      if (item.drive_url && item.drive_url != ''){
        const driveURLIconLink = document.createElement('a')
        driveURLIconLink.title = `View ${item.title} on Google Drive`
        driveURLIconLink.href = item.drive_url
        driveURLIconLink.innerText = ` △`
        titleH3.appendChild(driveURLIconLink)
      }

      resultsList.appendChild(recipeListItem)
      const tags = item.tags || []
      if (tags.length > 0) {
        const tagsWithHash = tags.map((tag) => `#${tag}`)
        const tagsListEl = document.createElement('p')
        tagsListEl.innerText = `Tags: ${tagsWithHash.join(' ')}`
        resultsList.appendChild(tagsListEl)
      }
    }

    randomizerResults.appendChild(resultsList)
  } else {
    const noResultsFound = document.createElement('li')
    noResultsFound.innerText = 'No results found'
    randomizerResults.appendChild(noResultsFound)
  }
}

(function(){
  document.addEventListener('readystatechange', (event) => {
    if (document.readyState === 'complete') {
      if (document.location.pathname == document.recipesRandomizer.htmlURL){
        loadRecipeDatabase(document)
      }
    }
  });
})()
