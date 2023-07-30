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
      numResults: document.getElementById("randomizer-numResults").value || 10
    }
    const recipes = randomize(randomizerQuery)
    displayRecipeResults(recipes)
  })
}

function randomize(randomizerQuery) {
  var recipes = []
  for (var i = 0; i < randomizerQuery.numResults; i++) {  // Generate random return values
    recipes.push(
      document.recipesRandomizer.recipes[Math.floor(Math.random() * document.recipesRandomizer.recipes.length)]
    )
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
        source = '<p>Source: ' + item.source + '</p>'
      }
      var tags = item.tags || []
      appendString += '<li>' + title + source + '</li>'
      if (tags.length > 0) {
        appendString += '<p>Tags: ' + tags.join(" ") + '</p>'
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