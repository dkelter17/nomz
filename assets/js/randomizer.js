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
  })
}

function randomize(randomizerQuery) {
  var weekendRecipesSeen = 0
  var recipes = []
  for (var i = 0; i < randomizerQuery.numResults; i++) {  // Generate random return values
    const randomIndex = Math.floor(Math.random() * document.recipesRandomizer.recipes.length)
    const candidate = document.recipesRandomizer.recipes[randomIndex]
    if (candidate.day_of_week == "weekend" && weekendRecipesSeen < randomizerQuery.maxWeekendRecipes){
      recipes.push(candidate)
      seenWeekend = true
    } else if (candidate.day_of_week == "weekend") {
      i--
    } else if (recipes.indexOf(candidate)) {
      i--
    } else {
      recipes.push(candidate)
    }
  }
  return recipes
}

function displayRecipeResults(recipes) {
  var randomizerResults = document.getElementById('randomizer-results');

  if (recipes && recipes.length > 0) { // Are there any results?
    var appendString = '<ol>';
    console.error(recipes)

    for (var i = 0; i < recipes.length; i++) {  // Iterate over the results
      var item = recipes[i]
      var source = ''
      var title = '<h3>' + item.title + '</h3>'
      if (item.url) {
        title = '<a href="' + item.url + '">' + title + '</a>'
      } else {
        source = '<p class="no-bottom-margin">Source: ' + item.source + '</p>'
      }
      var tags = item.tags || []
      appendString += '<li>' + title + source + '</li>'
      if (tags.length > 0) {
        const tagsWithHash = tags.map((tag) => `#${tag}`)
        appendString += '<p>Tags: ' + tagsWithHash.join(" ") + '</p>'
      }
    }

    randomizerResults.innerHTML = appendString + "</ol>";
  } else {
    randomizerResults.innerHTML = '<li>No results found</li>';
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
