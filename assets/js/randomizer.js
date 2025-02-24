function loadRecipeDatabase(document) {
  setRandomizerPlaceholder('Loading recipes...')
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = () => {
    if (httpRequest.readyState === XMLHttpRequest.DONE) {
      if (httpRequest.status === 200) {
        document.recipesRandomizer.recipes = JSON.parse(httpRequest.responseText)
        const numRecipes = Object.keys(document.recipesRandomizer.recipes).length
        setupRandomizer(document)
        setRandomizerPlaceholder('Randomize')
      } else {
        setRandomizerPlaceholder(`Error loading recipes. Randomizer disabled.`)
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

  var weekendRecipesSeen = 0
  var vegetarianRecipesSeen = 0
  const recipeListLen = document.recipesRandomizer.recipes.length
  const recipeIndices = new Set(Array.from(array, (randomNum) => randomNum % recipeListLen))
  const recipes = Array.from(recipeIndices, function(randomIndex){
    return document.recipesRandomizer.recipes[randomIndex]
  }).filter(function(candidate){
    if (candidate.day_of_week == "weekend") {
      weekendRecipesSeen++
    }
    if (candidate.vegetarian) {
      vegetarianRecipesSeen++
    }
    return candidate.category == "dinner" &&
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

function setRandomizerPlaceholder(newPlaceholder) {
  document.getElementById('randomizer-submit').value = newPlaceholder
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
