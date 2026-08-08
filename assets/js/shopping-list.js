"use strict";

// Powers shopping-list.html. Loaded only on that page, after nomz.js (which
// provides getShoppingList/saveShoppingList/renderShoppingTray and the rest
// of the shopping-list selection helpers used below).

const INGREDIENTS_HASH_STORAGE_KEY = 'ingredientsHash'
const INGREDIENTS_JSON_STORAGE_KEY = 'ingredientsJSON'

function getIngredientsIndexPathAndVersion() {
  const indexURL = document.nomzRecipes.ingredientsIndexURL
  if (!indexURL) {
    console.warn('No ingredients index URL found on document.nomzRecipes.')
    return { indexURL: '', version: 'unknown' }
  }
  const url = new URL(indexURL, document.nomzRecipes.baseAbsoluteURL || window.location.href)
  return { indexURL: indexURL, version: url.searchParams.get('version') || 'unknown' }
}

function isIngredientsIndexLoaded() {
  const loadedHash = localStorage.getItem(INGREDIENTS_HASH_STORAGE_KEY)
  const current = getIngredientsIndexPathAndVersion()
  return loadedHash !== null && loadedHash === current.version && localStorage.getItem(INGREDIENTS_JSON_STORAGE_KEY) !== null
}

function loadIngredientsIndex() {
  const indexData = getIngredientsIndexPathAndVersion()
  if (indexData.indexURL === '') {
    return Promise.reject(new Error('No ingredients index URL found'))
  }
  return fetch(indexData.indexURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    })
    .then((data) => {
      localStorage.setItem(INGREDIENTS_HASH_STORAGE_KEY, indexData.version)
      localStorage.setItem(INGREDIENTS_JSON_STORAGE_KEY, JSON.stringify(data))
    })
}

function loadIngredientsIndexIfNeeded() {
  if (isIngredientsIndexLoaded()) {
    return Promise.resolve(JSON.parse(localStorage.getItem(INGREDIENTS_JSON_STORAGE_KEY)))
  }
  return loadIngredientsIndex().then(() => JSON.parse(localStorage.getItem(INGREDIENTS_JSON_STORAGE_KEY)))
}

// ---- Grocery-section classification ----

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Longest keyword wins (a specific phrase like "dried oregano" or "frozen
// peas" is tested before the more generic "oregano"/"peas" it contains), and
// matching uses \p{L}/\p{N} boundaries rather than \b, since JS's \b is
// ASCII-only and would otherwise mis-handle accented ingredient names like
// "jalapeño". A trailing "s"/"es" is allowed so simple plurals still match.
function buildKeywordMatchers(grocerySections) {
  const entries = []
  const order = (grocerySections && grocerySections.order) || []
  const keywords = (grocerySections && grocerySections.keywords) || {}
  for (const section of order) {
    for (const keyword of (keywords[section] || [])) {
      entries.push({ section: section, keyword: keyword.toLowerCase() })
    }
  }
  entries.sort((a, b) => b.keyword.length - a.keyword.length)
  return entries.map((entry) => ({
    section: entry.section,
    regex: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(entry.keyword)}(?:es|s)?(?![\\p{L}\\p{N}])`, 'iu'),
  }))
}

function classifyIngredientLine(text, matchers) {
  for (const matcher of matchers) {
    if (matcher.regex.test(text)) {
      return matcher.section
    }
  }
  return null
}

// ---- Aggregation ----

function normalizeIngredientText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Exact-string dedupe only (after normalizing case/whitespace) -- no
// quantity math. "2 onions" and "1 onion" are kept as two separate lines;
// free-text quantities make real merging unreliable.
function dedupeIngredientLines(lines) {
  const seen = new Map()
  for (const line of lines) {
    const key = normalizeIngredientText(line)
    if (key && !seen.has(key)) {
      seen.set(key, line)
    }
  }
  return Array.from(seen.values())
}

function buildCopyText(order, grouped, sortThese, withoutIngredients) {
  const parts = []
  for (const section of order) {
    parts.push(section)
    for (const line of (grouped[section] || [])) {
      parts.push(`- ${line}`)
    }
    parts.push('')
  }
  if (sortThese.length > 0) {
    parts.push('— Sort These —')
    for (const line of sortThese) {
      parts.push(`- ${line}`)
    }
    parts.push('')
  }
  if (withoutIngredients.length > 0) {
    parts.push('Also check:')
    for (const recipe of withoutIngredients) {
      parts.push(`- ${recipe.title} (no ingredients on file)`)
    }
  }
  return parts.join('\n').trim()
}

// ---- Rendering ----

function renderShoppingListPage(document, ingredientsIndex) {
  const grocerySections = window.nomzGrocerySections || { order: [], keywords: {} }
  const matchers = buildKeywordMatchers(grocerySections)
  const shoppingList = getShoppingList()

  document.getElementById('shopping-list-empty-state').style.display = shoppingList.length === 0 ? '' : 'none'
  document.getElementById('shopping-list-count').innerText = shoppingList.length === 0
    ? ''
    : (shoppingList.length === 1 ? '1 recipe selected' : `${shoppingList.length} recipes selected`)

  const withIngredients = []
  const withoutIngredients = []
  for (const recipe of shoppingList) {
    const lines = ingredientsIndex[recipe.url]
    if (lines && lines.length > 0) {
      withIngredients.push(lines)
    } else {
      withoutIngredients.push(recipe)
    }
  }

  renderNoIngredientsList(document, withoutIngredients)

  const allLines = dedupeIngredientLines(withIngredients.flat())
  const grouped = {}
  for (const section of grocerySections.order) {
    grouped[section] = []
  }
  const sortThese = []
  for (const line of allLines) {
    const section = classifyIngredientLine(line, matchers)
    if (section) {
      grouped[section].push(line)
    } else {
      sortThese.push(line)
    }
  }

  renderGroupedSections(document, grocerySections.order, grouped)
  renderSortThese(document, sortThese)

  const copyText = buildCopyText(grocerySections.order, grouped, sortThese, withoutIngredients)
  setupCopyButton(document, copyText, allLines.length > 0 || withoutIngredients.length > 0)
}

function renderNoIngredientsList(document, recipes) {
  const container = document.getElementById('shopping-list-no-ingredients')
  const list = document.getElementById('shopping-list-no-ingredients-items')
  list.innerHTML = ''
  if (recipes.length === 0) {
    container.style.display = 'none'
    return
  }
  container.style.display = ''
  for (const recipe of recipes) {
    const item = document.createElement('li')
    const link = document.createElement('a')
    link.href = document.nomzRecipes.baseURL + recipe.url
    link.innerText = recipe.title
    item.appendChild(link)
    list.appendChild(item)
  }
}

function renderGroupedSections(document, order, grouped) {
  const container = document.getElementById('shopping-list-sections')
  container.innerHTML = ''
  // Every section is always rendered, in fixed order, even when empty, so
  // the page always mirrors the shared Apple Note's fixed structure.
  for (const section of order) {
    const lines = grouped[section] || []
    const sectionEl = document.createElement('div')
    sectionEl.classList.add('shopping-list-section')

    const heading = document.createElement('h2')
    heading.innerText = section
    sectionEl.appendChild(heading)

    if (lines.length === 0) {
      const empty = document.createElement('p')
      empty.classList.add('no-bottom-margin')
      empty.classList.add('shopping-list-section-empty')
      empty.innerText = 'Nothing yet.'
      sectionEl.appendChild(empty)
    } else {
      const list = document.createElement('ul')
      list.classList.add('shopping-list-items')
      for (const line of lines) {
        list.appendChild(buildCheckableRow(document, line))
      }
      sectionEl.appendChild(list)
    }

    container.appendChild(sectionEl)
  }
}

function renderSortThese(document, lines) {
  const container = document.getElementById('shopping-list-sort-these')
  const list = document.getElementById('shopping-list-sort-these-items')
  list.innerHTML = ''
  if (lines.length === 0) {
    container.style.display = 'none'
    return
  }
  container.style.display = ''
  for (const line of lines) {
    list.appendChild(buildCheckableRow(document, line))
  }
}

function buildCheckableRow(document, text) {
  const item = document.createElement('li')
  const label = document.createElement('label')
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.classList.add('shopping-list-item-checkbox')
  checkbox.addEventListener('change', () => {
    label.classList.toggle('checked', checkbox.checked)
  })
  label.appendChild(checkbox)
  label.appendChild(document.createTextNode(' ' + text))
  item.appendChild(label)
  return item
}

// ---- Copy to clipboard ----

function setupCopyButton(document, text, hasContent) {
  const button = document.getElementById('shopping-list-copy-btn')
  if (!hasContent) {
    button.classList.add('shopping-list-copy-hidden')
    button.onclick = null
    return
  }
  button.classList.remove('shopping-list-copy-hidden')
  button.onclick = () => copyToClipboard(text, button)
}

function copyToClipboard(text, button) {
  const showCopied = () => {
    const original = button.innerText
    button.innerText = 'Copied!'
    setTimeout(() => { button.innerText = original }, 1500)
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showCopied).catch(() => fallbackCopyToClipboard(text, showCopied))
  } else {
    fallbackCopyToClipboard(text, showCopied)
  }
}

function fallbackCopyToClipboard(text, onSuccess) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand('copy')
    onSuccess()
  } catch (error) {
    console.error('Error copying shopping list to clipboard:', error)
  }
  document.body.removeChild(textarea)
}

// ---- Static controls & entry point ----

function loadAndRenderShoppingList(document) {
  loadIngredientsIndexIfNeeded()
    .then((ingredientsIndex) => renderShoppingListPage(document, ingredientsIndex))
    .catch((error) => {
      console.error('Error loading ingredients index:', error)
      renderShoppingListPage(document, {})
    })
}

function setupStartNewWeekButton(document) {
  const button = document.getElementById('shopping-list-start-new-week')
  button.addEventListener('click', () => {
    if (getShoppingList().length === 0) {
      return
    }
    if (!window.confirm('Clear your shopping list and start a new week?')) {
      return
    }
    saveShoppingList([])
    renderShoppingTray(document)
    loadAndRenderShoppingList(document)
  })
}

// Local (non-GitHub-Pages) builds typically have an empty
// site.github.build_revision, so the cached-index "is this stale" check can
// end up comparing 'unknown' to 'unknown' and never detect an update. This
// gives a manual way to force a refetch instead of digging through
// localStorage in devtools.
function setupRefreshButton(document) {
  const button = document.getElementById('shopping-list-refresh')
  button.addEventListener('click', () => {
    localStorage.removeItem('recipesHash')
    localStorage.removeItem('recipesJSON')
    localStorage.removeItem(INGREDIENTS_HASH_STORAGE_KEY)
    localStorage.removeItem(INGREDIENTS_JSON_STORAGE_KEY)
    window.location.reload()
  })
}

function shoppingListMain(document) {
  setupStartNewWeekButton(document)
  setupRefreshButton(document)
  loadAndRenderShoppingList(document)
}

(function (document) {
  let initialized = false
  document.addEventListener('readystatechange', () => {
    if (initialized) {
      return
    }
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      initialized = true
      shoppingListMain(document)
    }
  })
})(document)
