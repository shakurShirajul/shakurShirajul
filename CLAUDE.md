# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is a GitHub profile README repository (`shakurShirajul/shakurShirajul`). `README.md` renders on the GitHub profile page. There is no build, lint or test step. The only way to see the real result is GitHub's own renderer (push, or use GitHub's markdown preview), because local markdown previewers don't apply GitHub's HTML sanitizer.

## Scripts

Two plain Node scripts (no dependencies) generate the README's images. All of them share one look: `#0C1014` rounded cards, monospace type, teal accent, and a small isometric block as the motif.

**`scripts/readme-art.mjs`** builds the static images committed to `main`: the section header bars in `images/headers/` (they replace markdown `##` headings), the About Me and What I'm Up To cards (`images/about.svg`, `images/now.svg`) and `images/tech-stack.svg`. The profile's intro text lives in `ABOUT` and `NOW` in this script, not in the README. Its text is monospace and wrapped by hand, so keep lines within the widths noted in the script. When the text changes, update the matching `alt` text in the README too. Edit `SECTIONS`, `ABOUT`, `NOW` or `STACK` in the script, run `node scripts/readme-art.mjs` from the repo root, and commit the output. Tech icons are downloaded from skillicons.dev and embedded as data URIs, so the card has no live dependency. A new section needs a header entry here and an `<img>` in the README.

**`scripts/contribution-city.mjs`** (plain Node, no dependencies) scrapes the public calendar at `github.com/users/<user>/contributions` and draws an isometric SVG with one building per day, plus a matching stats card (total, current and longest streak) built from every year since the account was created. Run it locally with `node scripts/contribution-city.mjs shakurShirajul <out-dir>`. `.github/workflows/contribution-city.yml` runs it daily and force-pushes the SVGs to the `output` branch, which the README loads through raw.githubusercontent.com. Never commit generated SVGs to `main`.

## Constraints from GitHub's renderer

- GitHub strips `<style>`, `style=` attributes, classes and scripts. Layout uses legacy HTML attributes only: `align`, `width`, `height`, `hspace`, `valign`, plus `<table>`, `<div align="center">` and `<br />`.
- The remaining live images (the commented-out badges and activity graph) is an external image service configured through URL query parameters. Change their look by editing those parameters, not by adding local assets.

## Visual system

Keep new elements consistent with the existing palette, which is repeated across the shields.io badges, the activity-graph URL and the THEMES in the city script:

- Background `0C1014`, accent `2AA889`, secondary text `99D1CE`, stroke `1C2226`
- Every card and header is shown at `width="100%"` so their edges line up.

When a technology has no skillicons.dev icon, add a local tile to `images/logo/` that matches skillicons' dark look (a 256×256 rounded square filled with `#242938`, `rx=60`, with the logo inset), then point its `STACK` entry at that file path (see `zustand-tile.svg` and `coolify-tile.png`).

## Content notes

- `images/banner.png` (3168×792) already carries the name, title and stack. That's why the old `<h1>` header, typing SVG, contact badges and profile-view counter are commented out at the top of the README. Leave them commented unless asked to restore them.
- Every image has descriptive `alt` text that lists what it shows (for example, every tech name on the tech stack card). Keep that when adding or changing images.
