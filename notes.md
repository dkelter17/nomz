---
layout: page
title: Browse Notes
excerpt: A list of all notes' sources.
include_in_header: true
---

{% for source in site.data.notes_sources %}
  {% assign title = source[0] %}
  {% assign url = source[1] %}
  <h2><a href="{{ url | relative_url }}">{{ title }}</a></h2>
{% endfor %}
