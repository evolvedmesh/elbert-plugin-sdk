# Writing a theme

A theme changes how Elbert looks: colours, fonts, every corner, how individual components are styled,
the words on screen, how song rows and album cards are drawn, and an optional animated background.
It is a package like any plugin, with one difference that matters: **it contains no code.** A theme is
`elbert-plugin.json` plus a `theme.json` of values and, for a background, a few `.rfwtxt`
templates. Elbert never starts an engine for it, and it cannot ask for permissions - so it can
change the look and nothing else. Installing one shows exactly that in the review.

## Quick start

```shell
bunx @evolvedmesh/elbert-plugin-sdk init night-owl --theme
cd night-owl && bun install && bun run dev
```

Load the `dist/` folder it names in Elbert (**Settings → Plugins → Developer → Load development
folder**), choose the theme under **Settings → Appearance → Look**, then open `theme.json` and change
`"seed"` to another colour. Elbert repaints as soon as you save. If you break something, Appearance
says what and keeps the last good version on screen.

`theme.json` and `elbert-plugin.json` point at JSON Schemas shipped in the SDK, so VS Code and most
editors complete every key, list the valid colour roles, component names and text keys, and underline
mistakes as you type. `bun run check` applies the same rules Elbert applies at install.

```
my-theme/
  elbert-plugin.json     "type": "theme"
  theme.json             the look
  ui/background.rfwtxt   optional: the animated backdrop
  ui/rows.rfwtxt         optional: templates that draw a song row or album card
  assets/                optional: images and fonts it uses
```

```shell
bunx elbert-plugin dev      # builds into dist/ and reloads Elbert as you save
bunx elbert-plugin pack     # → com.example.my-theme-1.0.0.elbx
```

`examples/dusk-theme` is a complete one.

## The manifest

```json
{
  "id": "com.example.dusk-theme",
  "name": "Dusk",
  "version": "1.0.0",
  "apiVersion": 1,
  "type": "theme",
  "theme": "theme.json",
  "ui": { "background": "ui/background.rfwtxt" }
}
```

No `entry`, no `permissions`, no `android`, no `migrate`: Elbert refuses a theme that has any of
them. See [the manifest](manifest.md) for the rest.

## `theme.json`

Everything is optional; a theme sets what it wants to change and leaves the rest to Elbert.
`types/theme.d.ts` describes it for your editor.

```json
{
  "seed": "#8B6CFF",
  "colors": {
    "light": { "tertiary": "#B26A00" },
    "dark": { "tertiary": "#FFB95C", "surfaceContainer": "#1B1726" },
    "amoled": { "surfaceContainer": "#120D1F" }
  },
  "typography": { "fontFamily": "Space Grotesk", "scale": 1.0 },
  "shapes": { "scale": 1.25, "buttons": "pill", "radii": { "medium": 14 } },
  "components": {
    "card": { "borderColor": "outlineVariant", "borderWidth": 1 },
    "sidebar": { "radius": 32 },
    "songRow": { "hoverColor": "primaryContainer", "coverSize": 52 }
  },
  "strings": { "home.recentlyPlayed": "On repeat" },
  "templates": { "songRow": { "ui": "rows", "widget": "DuskSongRow" } },
  "background": { "ui": "background", "widget": "Aurora", "dim": 0.15 }
}
```

### Colour

- `seed` is the colour Elbert's palette is generated from, as it is from the user's accent colour.
  **Setting it takes the accent choice (and the Android wallpaper palette) away from the user while
  your theme is in use.** Leave it out to let the user's accent through and only override roles.
- `colors.light`, `colors.dark` and `colors.amoled` override individual roles on top of the
  generated palette. Roles are `primary`, `onPrimary`, `primaryContainer`, `surface`, `onSurface`,
  `surfaceContainer`..., the same names templates use; an unknown role is refused.
  Colours are `#RGB`, `#RRGGBB` or `#AARRGGBB`.
- `amoled` is applied last, on top of `dark`, after Elbert has turned the surfaces true black. A
  theme that says nothing about AMOLED still gets black; one that sets `amoled.surface` gets that.

Check contrast yourself: Elbert applies what you write. Pair every `on…` role with its background.

### Typography

- `fontFamily` is any [Google Fonts](https://fonts.google.com) family. Elbert fetches it the way
  it does for the font the user can pick in Appearance.
- `font` ships a font instead: `{ "family": "Mine", "files": ["assets/Mine-Regular.ttf", "assets/Mine-Bold.ttf"] }`.
  `.ttf` or `.otf`, inside the package. Weight and italics come from the files themselves.
  A bundled font wins over `fontFamily`.
- `scale` multiplies every text size, between `0.85` and `1.25`.

### Shapes

Every corner in Elbert comes from a small scale of named sizes: `extraSmall` 4, `small` 8, `medium` 12,
`large` 16, `largeIncreased` 20, `extraLarge` 28 and `extraLargeIncreased` 32 (logical pixels).
Cards, rows, tiles, sheets, dialogs, menus, fields, the sidebar, the player bar and artwork all draw
from it, so changing it changes the whole app.

- `scale` multiplies all of them: `0` is square, `1` is Elbert's own, up to `2`. Artwork corners
  follow it too.
- `radii` pins individual sizes to an exact radius (0 - 200) and ignores `scale` for those: `{"medium": 6}`
  makes everything that is "medium" 6 px, including song rows. Combine it with `scale` to move
  everything and fix the few you care about.
- `buttons` is the resting shape of buttons, chips and the navigation indicator: `pill` (the
  default, which squeezes to a rounded square when pressed), `rounded` or `square`.

### Components

`components` styles one component at a time. Anything left out stays Elbert's. A colour is a scheme
role (it follows light, dark and AMOLED) or a fixed `#RRGGBB` / `#AARRGGBB`.

| Component       | What it is                                                         | Fields beyond the common four                                          |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `card`          | The standard content surface: settings groups, home sections, tiles | `padding`                                                              |
| `songRow`       | A track row in any list                                            | `hoverColor`, `activeColor` (the playing track), `padding`, `gap`, `coverSize`, `coverRadius` |
| `albumCard`     | An album tile in grids and rails                                   |                                                                        |
| `artistCard`    | An artist tile                                                     |                                                                        |
| `playerBar`     | The player bar docked on tablets and desktop                       |                                                                        |
| `dock`          | The phone dock: player bar and bottom navigation                   |                                                                        |
| `sidebar`       | The desktop sidebar                                                |                                                                        |
| `dialog`, `sheet`, `menu`, `input`, `chip`, `navigationBar` | The matching Material components        |                                                                        |

The common four are `radius`, `color`, `borderColor` and `borderWidth` (a width with no colour draws a
transparent border). A bottom `sheet`'s radius is its top corners. `padding` is a number,
`[horizontal, vertical]` or `[left, top, right, bottom]`.

A field a component doesn't use is refused rather than ignored, so `"card": { "hoverColor": ... }` fails
`check` with the fields `card` does take.

### Text

`strings` replaces words Elbert shows, by key (80 characters at most):

| Key                      | Elbert's own             | Where                               |
| ------------------------ | ------------------------ | ----------------------------------- |
| `app.name`               | Elbert                   | Sidebar header and desktop title bar |
| `app.byline`             | by Mijaf                 | Under the name in the sidebar       |
| `nav.home` ... `nav.statistics` | Home, Search, Albums, Artists, Songs, Playlists, Statistics | Sidebar, rail, phone dock and each page's title |
| `nav.createPlaylist`     | Create playlist          | Sidebar button                      |
| `home.recentlyPlayed`    | Recently Played          | Home section title                  |
| `player.notPlaying`      | Not Playing              | Player bar with nothing loaded      |
| `player.selectTrack`     | Select a track to play   | Under it                            |
| `song.nowPlaying`        | Now playing              | Playing row on a narrow screen      |

The list is closed on purpose: an unknown key is refused, so a typo can't silently do nothing. Plugin
navigation labels are the plugin's and are not reworded.

### Templates: drawing a component yourself

`templates` replaces what a component **looks like** with a template of yours. Elbert keeps what it
**does**: tapping plays, the pointer highlights, right-click and the ⋯ button open the song's menu,
the now-playing state follows the player. Your template is the body; Elbert adds the menu button and
any badges after it.

| Slot       | Replaces                                  | Events a template may raise          |
| ---------- | ----------------------------------------- | ------------------------------------ |
| `songRow`  | The body of a track row                   | `artist` opens the artist's page     |
| `albumCard`| The body of an album tile (cover and text) | none                                 |

```json
"templates": { "songRow": { "ui": "rows", "widget": "DuskSongRow" } }
```

What a template reads as `data.*`:

| Slot        | Data                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `songRow`   | `title`, `artist`, `album`, `duration` (text); `current` (this is the track playing), `playing` (and audio is running), `hover`, `narrow` (a phone-width row), `hasCover`, `remote`, `downloaded` (true/false) |
| `albumCard` | `title`, `subtitle` (text); `hasCover`                                                                                                 |

Widgets that only a template can use:

- `TrackCover(size: 46.0, radius: 23.0)` is the component's artwork. Leave out `size` to fill the
  space (an album tile). It shows whatever Elbert has for the track; a template never names a file or
  URL.
- `NowPlaying(size: 18.0, color: "primary")` is the animated bars; they rest flat when paused.

Besides those, a template can use `core`, `ThemedText`, `ThemedIcon`, `Panel` and the
[decoration widgets](widgets.md#decoration). Name your own widgets distinctly: one called `Row` or
`Text` would shadow the library's, and `check` refuses it.

```
widget DuskSongRow = Padding(
  padding: [14.0, 8.0, 6.0, 8.0],
  child: Row(crossAxisAlignment: "center", children: [
    switch data.hover {
      true: TrackCover(size: 50.0, radius: 25.0),
      default: TrackCover(size: 46.0, radius: 23.0),
    },
    SizedBox(width: 14.0),
    Expanded(child: ThemedText(text: data.title, style: "titleMedium", maxLines: 1)),
    switch data.current {
      true: NowPlaying(size: 18.0),
      default: ThemedText(text: data.duration, style: "labelMedium", color: "onSurfaceVariant"),
    },
  ]),
);
```

When a template draws a row, `components.songRow` no longer applies - the template owns the whole
look. `components.albumCard` still gives the tile its card (corner, colour, border) around your body.

### Background

`background` names a widget in one of your `ui` libraries. Elbert draws it behind every page, and
pages become transparent so it shows through (cards, the player bar and dialogs stay solid, so text
on them is as readable as ever). `dim` lays the surface colour back over it, 0 to 1, if your
background is busy.

The user can switch it off in Settings → Appearance → *Custom animated background*, which shows the
plain surface instead.

## Writing a background

A background is a template, the same language as a plugin page (see [templates](templates.md)),
with the `core` library and the [decoration widgets](widgets.md#decoration) of `elbert`:

```
import core;
import elbert;

widget Aurora = Stack(
  fit: "expand",
  children: [
    GradientFill(kind: "linear", colors: ["surface", "primaryContainer", "surface"], spin: 240.0, opacity: 0.55),
    Orb(color: "primary", opacity: 0.35, size: 0.9, x: -0.7, y: -0.6, driftX: 0.25, seconds: 38.0),
    Particles(count: 36, color: "onSurface", opacity: 0.35),
    Waves(colors: ["primaryContainer", "secondaryContainer"], baseline: 0.82),
  ],
);
```

Colours are roles, never values, so your background follows light, dark and AMOLED. Everything
animates itself from its arguments; a template has no clock and no logic. Motion stops when the
app is hidden and when the system asks for reduced motion.

What a background or template can use is deliberately small:

- Flutter's `core` layout widgets, the `elbert` decoration widgets (`GradientFill`, `Orb`,
  `Particles`, `Waves`, `Spin`, `Drift`, `Pulse`), plain text and icons (`ThemedText`, `ThemedIcon`,
  `Panel`) and, in templates, `TrackCover` and `NowPlaying`. Not `material`, and none of the page
  widgets.
- `Image(path: "assets/pattern.png", fit: "cover", opacity: 0.3)` reads a file **from your own
  package only**. It cannot load a URL; a theme has no network access.
- A background takes no touches. A template can only raise the events listed for its slot.

Keep it cheap: it repaints for as long as the app is open. A few large soft shapes beat hundreds of
small ones.

## Checking and packing

`elbert-plugin check` applies Elbert's install-time rules to the manifest and `theme.json`:
unknown roles, bad colours, out-of-range numbers, a `background` that names a library or widget
that isn't there, a missing font file. `dev` keeps the build loop running and Elbert reloads your
theme when a file changes - a template error leaves the last good version on screen.

## Recipes

Each of these is a complete `theme.json` (add `"$schema"` as `init` does). Start from the closest one.

**Brand colours, keep everything else.** One seed generates a whole matching palette; override only
what the generator gets wrong.

```json
{
  "seed": "#E0457B",
  "colors": { "dark": { "primary": "#FF8FB1" }, "light": { "primary": "#B3205A" } }
}
```

**Keep the user's own accent, just change the type and corners.** Leave `seed` out and the user's
accent colour (and wallpaper palette) still apply.

```json
{
  "typography": { "fontFamily": "Lora", "scale": 1.05 },
  "shapes": { "scale": 0.5 }
}
```

**Sharp, flat and square.**

```json
{
  "shapes": { "scale": 0, "buttons": "square" },
  "components": {
    "card": { "borderColor": "outline", "borderWidth": 1 },
    "songRow": { "borderColor": "outlineVariant", "hoverColor": "primaryContainer" }
  }
}
```

**A true-black OLED palette** (the AMOLED mode already makes surfaces black; this sets the greys on
top of it).

```json
{
  "colors": {
    "amoled": {
      "surfaceContainerLow": "#0B0B0B",
      "surfaceContainer": "#121212",
      "surfaceContainerHigh": "#1A1A1A",
      "outlineVariant": "#2B2B2B"
    }
  }
}
```

**Glass-looking cards** (a fixed colour with alpha, over a background).

```json
{
  "components": {
    "card": { "color": "#66FFFFFF", "borderColor": "#33FFFFFF", "borderWidth": 1 },
    "sidebar": { "color": "#4D000000", "radius": 28 }
  },
  "background": { "ui": "background", "widget": "Backdrop", "dim": 0.2 }
}
```

**Reword the interface.**

```json
{
  "strings": {
    "app.name": "Tunes",
    "app.byline": "pressed on vinyl",
    "nav.songs": "Tracks",
    "home.recentlyPlayed": "Back in rotation",
    "player.notPlaying": "Silence"
  }
}
```

**Bigger artwork and roomier rows.**

```json
{
  "components": {
    "songRow": { "coverSize": 60, "coverRadius": 12, "padding": [14, 12], "gap": 16 }
  },
  "shapes": { "radii": { "medium": 18 } }
}
```

**Your own song row.** See [Templates](#templates-drawing-a-component-yourself) above and
`examples/dusk-theme/ui/rows.rfwtxt`.

## Packaging and updates

`bun run pack` writes `<id>-<version>.elbx`. Attach it to a GitHub release and users can install it
by pasting your repository's address into **Settings → Plugins → From GitHub or a link**
([packaging.md](packaging.md)). Raise `version` for every release; users who update keep choosing
your theme.

A theme chosen by the user stays chosen across updates. If it is removed or switched off, Elbert's
own look returns.
