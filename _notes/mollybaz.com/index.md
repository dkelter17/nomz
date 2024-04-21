---
title: Index of Molly Baz recipes
excerpt: A list of notes for recipes by Molly Baz.
---

{{ page.excerpt }}

<ul class="recipe-list">
    {% assign sorted_notes = site.notes | sort: "title" %}
    {%- for note in sorted_notes -%}
    {%- unless note.author == "Molly Baz" -%}{%- continue -%}{%- endunless -%}
    <li>
    <h5>
        <a class="recipe-link" href="{{ note.url | prepend: site.baseurl }}">{{ note.title | escape }}</a>

        {%- for tag in note.tags -%}
        <span class="post-meta">#{{tag}}</span>
        {% endfor %}
    </h5>
    </li>
    {%- endfor -%}
</ul>
