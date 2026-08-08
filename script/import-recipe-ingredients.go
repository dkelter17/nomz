// import-recipe-ingredients extracts digitized ingredient checklists from
// _recipes/*.md and _notes/**/*.md into _data/recipe_ingredients.json, keyed
// by each recipe's URL. Run from the repo root:
//
//	go run script/import-recipe-ingredients.go
//
// Re-run and commit the result whenever a recipe's ingredients change.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	frontMatterURLRe    = regexp.MustCompile(`(?m)^url:\s*"?([^"\r\n]*)"?\s*$`)
	headingRe           = regexp.MustCompile(`^#{1,6}\s`)
	ingredientHeadingRe = regexp.MustCompile(`(?i)^#{1,6}.*ingredient`)
	checkboxLineRe      = regexp.MustCompile(`^(\s*)[-*]\s*\[[ xX]\]\s*(.+?)\s*$`)
	plainBulletLineRe   = regexp.MustCompile(`^(\s*)[-*]\s+(.+?)\s*$`)
	markdownLinkRe      = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`)
	markdownBoldRe      = regexp.MustCompile(`\*\*([^*]+)\*\*|__([^_]+)__`)
	servingsOnlyRe      = regexp.MustCompile(`(?i)^\d+\s+servings?$`)
)

type collectionRoot struct {
	dir        string
	collection string
}

type ingredientLine struct {
	indent int
	text   string
}

func main() {
	roots := []collectionRoot{
		{dir: "_recipes", collection: "recipes"},
		{dir: "_notes", collection: "notes"},
	}

	result := map[string][]string{}

	for _, root := range roots {
		if err := walkCollection(root, result); err != nil {
			fmt.Fprintf(os.Stderr, "error walking %s: %v\n", root.dir, err)
			os.Exit(1)
		}
	}

	outputPath := "_data/recipe_ingredients.json"
	if err := writeJSON(outputPath, result); err != nil {
		fmt.Fprintf(os.Stderr, "error writing output: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Wrote ingredients for %d recipes to %s\n", len(result), outputPath)
}

func walkCollection(root collectionRoot, result map[string][]string) error {
	return filepath.Walk(root.dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".md") || filepath.Base(path) == "index.md" {
			return nil
		}

		raw, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading %s: %w", path, err)
		}

		frontMatter, body := splitFrontMatter(string(raw))

		url := extractURL(frontMatter)
		if url == "" {
			url = deriveURL(root, path)
		}

		if ingredients := extractIngredients(body); len(ingredients) > 0 {
			result[url] = ingredients
		}

		return nil
	})
}

// splitFrontMatter splits a Jekyll document into its YAML front matter and
// the remaining body. Returns an empty front matter if the document doesn't
// start with a "---" delimiter.
func splitFrontMatter(content string) (frontMatter, body string) {
	if !strings.HasPrefix(content, "---") {
		return "", content
	}
	rest := content[3:]
	closingIdx := strings.Index(rest, "\n---")
	if closingIdx == -1 {
		return "", content
	}
	frontMatter = rest[:closingIdx]
	afterClosing := rest[closingIdx+len("\n---"):]
	if nl := strings.Index(afterClosing, "\n"); nl != -1 {
		body = afterClosing[nl+1:]
	}
	return frontMatter, body
}

func extractURL(frontMatter string) string {
	m := frontMatterURLRe.FindStringSubmatch(frontMatter)
	if m == nil {
		return ""
	}
	return strings.TrimSpace(m[1])
}

// deriveURL mirrors Jekyll's default collection permalink
// (/:collection/:path:output_ext) for documents with no explicit url in
// their front matter.
func deriveURL(root collectionRoot, path string) string {
	rel, err := filepath.Rel(root.dir, path)
	if err != nil {
		rel = filepath.Base(path)
	}
	rel = strings.TrimSuffix(filepath.ToSlash(rel), ".md")
	return "/" + root.collection + "/" + rel + ".html"
}

// extractIngredients finds the ingredients section of a recipe body and
// returns its leaf bullet items as plain text, excluding group-label items
// (a bullet whose only content is a heading for more deeply indented
// children, e.g. "Roux:" followed by indented sub-items).
func extractIngredients(body string) []string {
	lines := strings.Split(body, "\n")

	start, end := findIngredientSection(lines)
	if start == -1 {
		return nil
	}

	useCheckbox := false
	for i := start; i < end; i++ {
		if checkboxLineRe.MatchString(lines[i]) {
			useCheckbox = true
			break
		}
	}

	var captured []ingredientLine
	for i := start; i < end; i++ {
		var m []string
		if useCheckbox {
			m = checkboxLineRe.FindStringSubmatch(lines[i])
		} else {
			m = plainBulletLineRe.FindStringSubmatch(lines[i])
		}
		if m == nil {
			continue
		}
		text := cleanIngredientText(m[2])
		if text == "" || servingsOnlyRe.MatchString(text) {
			continue
		}
		captured = append(captured, ingredientLine{indent: len(m[1]), text: text})
	}

	return filterGroupLabels(captured)
}

// findIngredientSection returns the [start, end) line range holding the
// ingredients. It prefers a heading whose text mentions "ingredient" (any
// heading level, e.g. "## Ingredients", "### Ingredients:"), running until
// the next heading of any level. Failing that, it falls back to the first
// contiguous run of checkbox bullet lines in the body, which covers the
// small number of recipes that list ingredients under freeform prose
// instead of a dedicated heading.
func findIngredientSection(lines []string) (start, end int) {
	for i, line := range lines {
		if ingredientHeadingRe.MatchString(strings.TrimSpace(line)) {
			start = i + 1
			end = len(lines)
			for j := start; j < len(lines); j++ {
				if headingRe.MatchString(lines[j]) {
					end = j
					break
				}
			}
			return start, end
		}
	}

	runStart, inRun := -1, false
	for i, line := range lines {
		switch {
		case checkboxLineRe.MatchString(line):
			if !inRun {
				runStart, inRun = i, true
			}
			end = i + 1
		case inRun && strings.TrimSpace(line) == "":
			// Blank lines don't end a run.
		case inRun:
			return runStart, end
		}
	}
	if inRun {
		return runStart, end
	}
	return -1, -1
}

// filterGroupLabels drops bullet items that only serve as a label for other
// ingredients rather than being one themselves: either a label for more
// deeply indented children (e.g. "Roux:" followed by "  - 1/4 cup lard"), or
// a flat-list sub-heading at the same indent as its neighbors (e.g.
// "**Peanut sauce ingredients**:"). Leaf ingredient lines are kept
// regardless of nesting depth.
func filterGroupLabels(items []ingredientLine) []string {
	var out []string
	for i, item := range items {
		if i+1 < len(items) && items[i+1].indent > item.indent {
			continue
		}
		if strings.HasSuffix(item.text, ":") {
			continue
		}
		out = append(out, item.text)
	}
	return out
}

func cleanIngredientText(text string) string {
	text = markdownLinkRe.ReplaceAllString(text, "$1")
	text = markdownBoldRe.ReplaceAllString(text, "$1$2")
	return strings.TrimSpace(text)
}

func writeJSON(path string, data map[string][]string) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	enc := json.NewEncoder(file)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	// encoding/json sorts map[string]... keys alphabetically, so output is
	// stable across re-runs for clean diffs.
	return enc.Encode(data)
}
