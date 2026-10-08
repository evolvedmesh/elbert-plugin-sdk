# The `elbert` widget library

Plugin pages are [Remote Flutter Widgets](https://pub.dev/packages/rfw) templates (`.rfwtxt`). Besides RFW's own `core` and `material` libraries, templates can use Elbert's real widgets - the same song rows, album cards, headers and loaders the built-in pages use - from the `elbert` library:

```
import core;
import material;
import elbert;
```

Every `ui` entry in the manifest is also a library named by its key, so one template can `import common;` to reuse widgets declared in another.

## Data, events and layout

- **Data.** A template reads what the page controller returned from `open` and what it later pushed with `page.set({...})` as `data.*`. Arguments of a widget the template itself declares are `args.*`.
- **Events.** A handler argument (`onTap`, `onPlay`, ...) is written `event "name" { key: value }`. The event arrives in the page controller's `events` table (`ui.page(name, { events: { name(page, args) {...} } })`) with `args` holding the arguments written in the template plus the payload listed for the widget (`index`, `id`, `action`, `value`, ...). Values that are null are dropped from the payload.
- **Events that carry no payload.** A handler documented as a *tap* below only delivers the arguments written in the template.
- **Unbound handlers.** A widget whose handler is not bound renders that control disabled or leaves it out (for example `JobCard` only shows a Cancel button when `onCancel` is bound). A `switch` with only a `true:` case is the way to bind a handler conditionally.
- **Refresh.** `refreshEvent` arguments take an event *name* (a string), not an `event` expression. The widget wraps its scroll view in pull-to-refresh and waits for that handler to finish.
- **Navigation.** Two events are handled by the host without a round trip: `event "elbert.navigate" { route: "/radio/search", mode: "go" }` (`mode` is `push` by default, or `go`) and `event "elbert.back" {}`.
- **Layout.** The host maintains `data.layout` on every page and keeps it up to date on resize; a plugin cannot set it.

| Key                    | Type   | Meaning                                                        |
| ---------------------- | ------ | -------------------------------------------------------------- |
| `data.layout.width`    | number | Width of the page in logical pixels.                           |
| `data.layout.compact`  | bool   | Width below 600.                                               |
| `data.layout.medium`   | bool   | Width from 600 up to 840.                                      |
| `data.layout.expanded` | bool   | Width of 840 or more.                                          |
| `data.layout.mobile`   | bool   | Width below 600 (the phone layout; same cut-off as `compact`). |
| `data.layout.narrow`   | bool   | Width below 700.                                               |

## Colour and text roles

A template never passes a colour or a font. It names a **role** and the host resolves it from the current theme (light, dark, AMOLED, wallpaper palette).

**`schemeRole`** - every argument documented as "colour role" (`color`, `tone`, `iconColor`, `textColor`, `statusTone`, ...) accepts exactly these names. An absent or unknown name is treated as "no colour given" and the widget uses its own default.

`primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `secondary`, `onSecondary`, `secondaryContainer`, `onSecondaryContainer`, `tertiary`, `onTertiary`, `tertiaryContainer`, `onTertiaryContainer`, `error`, `onError`, `errorContainer`, `onErrorContainer`, `surface`, `onSurface`, `onSurfaceVariant`, `surfaceContainerLowest`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`, `outline`, `outlineVariant`.

**`textRole`** - every argument documented as "text role" (`style`) accepts exactly these names; any other value (or none) gives `bodyMedium`.

`displayLarge`, `displayMedium`, `displaySmall`, `headlineLarge`, `headlineMedium`, `headlineSmall`, `titleLarge`, `titleMedium`, `titleSmall`, `bodyLarge`, `bodyMedium`, `bodySmall`, `labelLarge`, `labelMedium`, `labelSmall`.

**Icons** are Lucide icon names in kebab-case (`"radio"`, `"folder-down"`). An unknown name draws a puzzle-piece icon.

**Insets** (`padding`, ...) take one number (all sides), `[horizontal, vertical]`, or `[left, top, right, bottom]`. Numbers may be written as integers or doubles.

**Weights** (`weight`) are numbers; the value is rounded up to the next of 100, 200 ... 900 (so `700` is bold).

## Argument conventions

Argument types in the tables: `string`, `number`, `int`, `bool`, `list` (of items, with the item keys listed), `map`, `child` / `children` (widgets), `event` (a handler that receives a payload) and `tap` (a handler with no payload). An argument of the wrong type is ignored and its default is used; it never raises an error.

**Card item** - used by `CardRail`, `CardGrid`, `HeroStrip.pins` and `PinStrip`:

| Key               | Type   | Meaning                                                                    |
| ----------------- | ------ | -------------------------------------------------------------------------- |
| `id`              | string | Reported back as `id` in the event payload.                                |
| `title`           | string | Card title.                                                                |
| `subtitle`        | string | Card subtitle.                                                             |
| `cover`           | string | Artwork: an `http(s)` URL, a local file path or a library cover reference. |
| `placeholderIcon` | string | Icon drawn instead of artwork when `cover` is absent.                      |
| `titleLines`      | int    | Overrides the widget's `titleLines` for this card.                         |

**Action item** - used by `SectionScaffold`, `SubNav`, `PageHeader`, `FloatingActions` and `ActionRow` (`actions`):

| Key           | Type   | Meaning                                                                                        |
| ------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `id`          | string | Reported as `id` when pressed.                                                                 |
| `label`       | string | Tooltip / button label.                                                                        |
| `icon`        | string | Lucide icon name.                                                                              |
| `primary`     | bool   | The one action the page is for. On a phone, a lone primary action floats as a labelled button. |
| `destructive` | bool   | Drawn in the error colours.                                                                    |
| `busy`        | bool   | Shows a spinner in place of the icon.                                                          |
| `disabled`    | bool   | No press handler.                                                                              |

**Track item** - used by `TrackList` and `CompactTrackList`:

| Key           | Type           | Meaning                                                                                                                                                                             |
| ------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string         | Reported back as `id`.                                                                                                                                                              |
| `title`       | string         | Track title.                                                                                                                                                                        |
| `artist`      | string         | Artist line.                                                                                                                                                                        |
| `duration`    | string         | Already formatted (`"3:41"`).                                                                                                                                                       |
| `cover`       | string         | Artwork, as for a card item.                                                                                                                                                        |
| `matchIds`    | list of string | Queue track ids that mean "this row is playing" (drives the now-playing bars).                                                                                                      |
| `localId`     | string         | Id of the library track this row plays from, when one exists. Pass it together with `matchIds`, or the now-playing indicator is missing on exactly the rows that play a local copy. |
| `badge`       | string         | Quality label such as `"ALAC"`.                                                                                                                                                     |
| `status`      | string         | `working` (spinner), `failed` (error icon), `saved` (in-library marker); anything else is none.                                                                                     |
| `statusError` | string         | Tooltip text for `failed` (`TrackList` only).                                                                                                                                       |
| `isLocal`     | bool           | Shows the in-library marker.                                                                                                                                                        |
| `artistLink`  | bool           | Makes the artist text tappable (`TrackList` only; fires `onArtist`).                                                                                                                |
| `menu`        | list           | The row's context menu: `{ id, label, icon }` entries, or `{ divider: true }`.                                                                                                      |

---

## Layout

Page structure: scroll views, slivers, insets, section chrome, entrance animations and page actions.

### ScrollPage

A page's scroll view. Its children are slivers: wrap ordinary widgets in `SliverBox`. Scrolling is always enabled with bouncing physics.

| Argument       | Type     | Default    | Meaning                                                                                                                                                |
| -------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slivers`      | children | none       | The slivers, in order.                                                                                                                                 |
| `topInset`     | bool     | `true`     | Adds the space for the shell's top bar before the first sliver. Pass `false` when a header sits above or the page is inside `SectionScaffold`.         |
| `bottomInset`  | string   | `"scroll"` | Space after the last sliver: `"scroll"` clears the bottom of the screen, `"dock"` clears the phone dock (120 on wider layouts), `"none"` adds nothing. |
| `bleed`        | bool     | `false`    | Lets horizontally scrolling rows run to the screen edge on a phone.                                                                                    |
| `refreshEvent` | string   | none       | Event name; enables pull-to-refresh.                                                                                                                   |

```
ScrollPage(
  topInset: false,
  bleed: true,
  refreshEvent: "refresh",
  slivers: [
    SliverBox(child: ThemedText(text: "Top stations", style: "headlineMedium")),
    SliverGap(height: 16.0),
    SliverBox(child: CardRail(items: data.stations, onTap: event "play" {})),
  ],
)
```

### ScrollList

A plain vertical list of ordinary widgets, for pages that scroll under a fixed header.

| Argument       | Type     | Default | Meaning                                                                  |
| -------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `children`     | children | none    | The rows.                                                                |
| `padding`      | insets   | zero    | Padding around the rows; the scroll-bottom inset is added to the bottom. |
| `bleed`        | bool     | `false` | As for `ScrollPage`.                                                     |
| `refreshEvent` | string   | none    | Event name; enables pull-to-refresh.                                     |

```
ScrollList(padding: [0.0, 4.0], children: [MediaRow(title: "Jazz FM", subtitle: "Jazz", onTap: event "open" {})])
```

### SliverBox

Puts an ordinary widget into a sliver list.

| Argument | Type  | Default | Meaning     |
| -------- | ----- | ------- | ----------- |
| `child`  | child | none    | The widget. |

```
SliverBox(child: SectionHeading(title: "Favourites"))
```

### SliverPad

Pads a sliver.

| Argument  | Type   | Default      | Meaning            |
| --------- | ------ | ------------ | ------------------ |
| `padding` | insets | zero         | Padding.           |
| `sliver`  | child  | empty sliver | The sliver to pad. |

```
SliverPad(padding: [16.0, 20.0, 16.0, 0.0], sliver: SliverBox(child: ActionRow(actions: data.actions, onAction: event "action" {})))
```

### SliverGap

Vertical space between slivers.

| Argument | Type   | Default | Meaning                   |
| -------- | ------ | ------- | ------------------------- |
| `height` | number | `0`     | Height in logical pixels. |

```
SliverGap(height: 28.0)
```

### TopInset

A box of the height the shell's top bar needs. Use it for a page whose header sits outside its scroll view (a `ScrollPage` adds the same space itself). Takes no arguments.

```
Column(children: [TopInset(), PageHeader(title: "Playlist"), Expanded(child: ...)])
```

### PageInset

The horizontal page gutter, which is zero on a phone (the shell already insets it, so rows can reach the edge) and a fixed value elsewhere.

| Argument  | Type   | Default | Meaning                                                                                     |
| --------- | ------ | ------- | ------------------------------------------------------------------------------------------- |
| `mobile`  | number | `0`     | Left and right padding on a phone (width below 600).                                        |
| `desktop` | number | `24`    | Left and right padding on wider layouts.                                                    |
| `top`     | number | `0`     | Top padding.                                                                                |
| `bottom`  | number | `0`     | Bottom padding.                                                                             |
| `sliver`  | bool   | `false` | Produce a sliver (`SliverPadding`) instead of a `Padding`; the child must then be a sliver. |
| `child`   | child  | none    | The content.                                                                                |

```
PageInset(sliver: true, top: 4.0, child: CardGrid(sliver: true, items: data.stations, onTap: event "play" {}))
```

### BleedClip

Lets scroll content bleed sideways while still stopping at a fixed header above it. Wrap a scroll view that sits under a header (search results, a library list).

| Argument | Type  | Default  | Meaning          |
| -------- | ----- | -------- | ---------------- |
| `child`  | child | required | The scroll view. |

```
Expanded(child: BleedClip(child: ScrollPage(topInset: false, bleed: true, slivers: [...])))
```

### Stagger

Owns one entrance animation for a page; every `SlideIn` and `StickyHeader` below it animates on its timeline.

| Argument     | Type   | Default  | Meaning                                   |
| ------------ | ------ | -------- | ----------------------------------------- |
| `durationMs` | int    | `500`    | Duration of the timeline.                 |
| `restartKey` | string | none     | Changing this value replays the entrance. |
| `child`      | child  | required | The page.                                 |

```
Stagger(durationMs: 700, child: ScrollPage(slivers: [...]))
```

### SlideIn

Slides and fades its child in on the nearest `Stagger`'s timeline (or on its own when there is none).

| Argument  | Type  | Default  | Meaning                    |
| --------- | ----- | -------- | -------------------------- |
| `delayMs` | int   | `0`      | Delay within the timeline. |
| `child`   | child | required | The content.               |

```
SliverBox(child: SlideIn(delayMs: 80, child: ThemedText(text: "Recently played", style: "headlineSmall")))
```

### Loader

The expressive full-section loading indicator.

| Argument | Type   | Default | Meaning                                                                                     |
| -------- | ------ | ------- | ------------------------------------------------------------------------------------------- |
| `expand` | bool   | `true`  | Fill and centre in the available space. When `false`, the loader sits in a box of `height`. |
| `height` | number | none    | Height of the box when `expand` is `false`.                                                 |

```
Loader(expand: false, height: 132.0)
```

### Spinner

A small inline spinner.

| Argument | Type        | Default       | Meaning           |
| -------- | ----------- | ------------- | ----------------- |
| `size`   | number      | `18`          | Width and height. |
| `color`  | colour role | theme default | Spinner colour.   |

```
Spinner(size: 16.0, color: "primary")
```

### ErrorView

Full-page failure state: the message in the error colour, plus an optional back button.

| Argument  | Type   | Default | Meaning                                                          |
| --------- | ------ | ------- | ---------------------------------------------------------------- |
| `message` | string | `""`    | The message.                                                     |
| `back`    | bool   | `true`  | Show a back button (goes back, or to `/` when nothing is below). |

```
"error": ErrorView(message: data.error),
```

### SectionScaffold

The standard chrome of a section page. On desktop and tablet: the top inset, a pill bar of tabs with the actions at its trailing edge, then `child`. On a phone: no tab bar (the dock carries the destinations); `title` becomes a page header and the actions float above the dock.

| Argument   | Type   | Default  | Meaning                                                                                                                                                |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tabs`     | list   | none     | Tab items: `label` (string), `icon` (string), `route` (string), `badge` (int, shown when above 0). Selecting a tab navigates to its `route` with `go`. |
| `current`  | string | `""`     | The `route` of the tab this page belongs to, so it reads as selected.                                                                                  |
| `title`    | string | none     | Phone header text.                                                                                                                                     |
| `actions`  | list   | none     | Action items (see above).                                                                                                                              |
| `onAction` | event  | none     | Payload `{ id }` of the pressed action.                                                                                                                |
| `child`    | child  | required | The page body.                                                                                                                                         |

```
SectionScaffold(
  tabs: data.tabs,
  current: data.current,
  title: "Top stations",
  child: StationGrid(status: data.status, stations: data.stations),
)
```

### SubNav

Just the tab pill bar of `SectionScaffold`, for a page that lays out its own header.

| Argument   | Type   | Default | Meaning                                                   |
| ---------- | ------ | ------- | --------------------------------------------------------- |
| `tabs`     | list   | none    | Tab items, as for `SectionScaffold`.                      |
| `current`  | string | `""`    | Route of the selected tab.                                |
| `actions`  | list   | none    | Action items, drawn as icon buttons at the trailing edge. |
| `onAction` | event  | none    | Payload `{ id }`.                                         |

```
SubNav(tabs: data.tabs, current: data.current)
```

### PageHeader

A page title with optional icon-button actions, and a back button whenever there is something to go back to.

| Argument   | Type   | Default | Meaning                                    |
| ---------- | ------ | ------- | ------------------------------------------ |
| `title`    | string | `""`    | The title.                                 |
| `above`    | child  | none    | A full-width widget drawn above the title. |
| `actions`  | list   | none    | Action items, drawn as icon buttons.       |
| `onAction` | event  | none    | Payload `{ id }`.                          |

```
PageHeader(title: "Playlists", actions: data.actions, onAction: event "action" {})
```

### SectionHeading

A heading inside a page with an optional "See all" button.

| Argument      | Type   | Default     | Meaning                                      |
| ------------- | ------ | ----------- | -------------------------------------------- |
| `title`       | string | `""`        | The heading.                                 |
| `seeAllLabel` | string | `"See all"` | Button label.                                |
| `onSeeAll`    | tap    | none        | The button is shown only when this is bound. |

```
SectionHeading(title: "Playlists", onSeeAll: event "seeAllPlaylists" {})
```

### FloatingActions

Floats the actions over `child`, just clear of the phone dock. On a phone only; at wider widths it renders `child` unchanged, so it can wrap unconditionally. A lone action marked `primary` becomes a labelled button; several actions become an icon pill.

| Argument   | Type  | Default  | Meaning           |
| ---------- | ----- | -------- | ----------------- |
| `actions`  | list  | none     | Action items.     |
| `onAction` | event | none     | Payload `{ id }`. |
| `child`    | child | required | The page.         |

```
FloatingActions(actions: data.actions, onAction: event "action" {}, child: ScrollPage(slivers: [...]))
```

### FloatingBar

Floats an arbitrary widget over `child`, clear of the phone dock. Phone only; otherwise renders `child` alone.

| Argument   | Type  | Default  | Meaning                                                          |
| ---------- | ----- | -------- | ---------------------------------------------------------------- |
| `floating` | child | none     | The widget to float (right-aligned). Nothing floats when absent. |
| `child`    | child | required | The page.                                                        |

```
FloatingBar(
  floating: switch data.hasOwned {
    true: ActionRow(floating: true, actions: data.ownedActions, onAction: event "ownedAction" {}),
    default: SizedBox(),
  },
  child: ScrollPage(slivers: [...]),
)
```

### ActionRow

A row of page actions: labelled tonal buttons in a wrap, or - with `floating` - the compact icon pill that sits above the phone dock.

| Argument   | Type   | Default | Meaning                                                                  |
| ---------- | ------ | ------- | ------------------------------------------------------------------------ |
| `actions`  | list   | none    | Action items. `primary` is read but has no effect here.                  |
| `onAction` | event  | none    | Payload `{ id }`.                                                        |
| `spacing`  | number | `12`    | Gap between buttons (non-floating).                                      |
| `floating` | bool   | `false` | Render as the floating icon pill (icons only; the label is the tooltip). |

```
ActionRow(actions: data.actions, onAction: event "action" {})
```

---

## Media

Content: text, icons, covers, cards, rails and grids, and the status surfaces (empty states, notes, progress).

### ThemedText

Text in a type-scale role and a colour role.

| Argument        | Type        | Default       | Meaning                                                             |
| --------------- | ----------- | ------------- | ------------------------------------------------------------------- |
| `text`          | string      | `""`          | The text.                                                           |
| `style`         | text role   | `bodyMedium`  | Type-scale role.                                                    |
| `color`         | colour role | `onSurface`   | Text colour.                                                        |
| `plain`         | bool        | `false`       | With no `color`, use the style's own colour instead of `onSurface`. |
| `size`          | number      | role's size   | Font size, scaled the way Elbert's own headings are.                |
| `weight`        | int         | role's weight | 100 - 900.                                                          |
| `maxLines`      | int         | unlimited     | Truncates with an ellipsis.                                         |
| `align`         | string      | start         | `center` or `end`.                                                  |
| `upper`         | bool        | `false`       | Upper-case the text.                                                |
| `italic`        | bool        | `false`       | Italic.                                                             |
| `letterSpacing` | number      | role's        | Letter spacing.                                                     |
| `height`        | number      | role's        | Line height multiple.                                               |
| `mono`          | bool        | `false`       | Monospace font.                                                     |

```
ThemedText(text: "Recently played", style: "headlineSmall", weight: 700, size: 22.0)
```

### SelectableText

Text the user can select and copy.

| Argument | Type        | Default       | Meaning          |
| -------- | ----------- | ------------- | ---------------- |
| `text`   | string      | `""`          | The text.        |
| `style`  | text role   | `bodyMedium`  | Type-scale role. |
| `color`  | colour role | theme default | Text colour.     |
| `mono`   | bool        | `false`       | Monospace font.  |

```
SelectableText(text: data.streamUrl, style: "bodySmall", mono: true)
```

### ThemedIcon

A Lucide icon in a colour role.

| Argument | Type        | Default            | Meaning           |
| -------- | ----------- | ------------------ | ----------------- |
| `name`   | string      | puzzle icon        | Lucide icon name. |
| `size`   | number      | theme default      | Icon size.        |
| `color`  | colour role | `onSurfaceVariant` | Icon colour.      |

```
ThemedIcon(name: "radio", color: "primary", size: 26.0)
```

### Cover

An artwork square.

| Argument   | Type   | Default | Meaning                                                                                                        |
| ---------- | ------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `path`     | string | none    | Artwork: an `http(s)` URL, a local file path or a library cover reference; a placeholder is drawn when absent. |
| `size`     | number | `48`    | Width and height.                                                                                              |
| `radius`   | string | none    | Corner preset: `small`, `medium`, `large`, `extraLarge`. When absent or unknown, `radiusPx` applies.           |
| `radiusPx` | number | `8`     | Corner radius in pixels.                                                                                       |
| `fit`      | string | `cover` | `contain` to letterbox instead of crop.                                                                        |

```
Cover(path: data.cover, size: 120.0, radiusPx: 12.0)
```

### Surface

Elbert's card surface, in a tone of the container ramp.

| Argument  | Type   | Default        | Meaning                                                     |
| --------- | ------ | -------------- | ----------------------------------------------------------- |
| `tone`    | string | base           | `low`, `high` or `highest`; anything else is the base tone. |
| `padding` | insets | `16` all sides | Inner padding.                                              |
| `radius`  | string | `large`        | Corner preset: `small`, `medium`, `large`, `extraLarge`.    |
| `onTap`   | tap    | none           | Makes the surface tappable.                                 |
| `child`   | child  | none           | The content.                                                |

```
Surface(tone: "low", child: SizedBox(height: 180.0, child: Center(child: ThemedText(text: "Nothing played recently."))))
```

### Panel

A simple rounded `surfaceContainerHigh` box (14 px radius), for grouping controls on a settings page.

| Argument  | Type   | Default        | Meaning        |
| --------- | ------ | -------------- | -------------- |
| `padding` | insets | `14` all sides | Inner padding. |
| `child`   | child  | none           | The content.   |

```
Panel(child: Column(crossAxisAlignment: "start", children: [ThemedText(text: "Status"), StatusLine(icon: "check", text: "Connected")]))
```

### AlbumCard

One album-style card: cover, title and subtitle.

| Argument          | Type   | Default | Meaning                                               |
| ----------------- | ------ | ------- | ----------------------------------------------------- |
| `title`           | string | `""`    | Title.                                                |
| `subtitle`        | string | `""`    | Subtitle.                                             |
| `titleLines`      | int    | `2`     | Maximum title lines.                                  |
| `cover`           | string | none    | Artwork.                                              |
| `placeholderIcon` | string | none    | Icon shown instead of artwork when `cover` is absent. |
| `onTap`           | tap    | none    | Tap handler.                                          |

```
SizedBox(width: 170.0, child: AlbumCard(title: data.title, subtitle: data.artist, cover: data.cover, onTap: event "open" {}))
```

### CardRail

A horizontal shelf of album cards, bled to the screen edge on a phone. On desktop and tablet an arrow button sits on the artwork at each end while there is more to scroll that way (right from the start, left once scrolled); a click scrolls about 60% of the shelf's width. A shelf that fits has none, and a phone scrolls by touch.

| Argument       | Type   | Default     | Meaning                                                                                                                                                                              |
| -------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `items`        | list   | none        | Card items.                                                                                                                                                                          |
| `size`         | string | `home`      | Card width preset: `home`, `artist`, `replay`, `compact`. Widths (phone / wider): `home` 170 / 190 under 700 wide, 210 above; `artist` 160 / 190; `replay` 170 / 180; `compact` 170. |
| `cardWidth`    | number | from `size` | Explicit width; wins over `size` when above 0.                                                                                                                                       |
| `cardHeight`   | number | computed    | Explicit rail height; otherwise the width plus the title and subtitle block.                                                                                                         |
| `titleLines`   | int    | `2`         | Maximum title lines.                                                                                                                                                                 |
| `innerPadding` | number | `0`         | Extra horizontal padding inside the rail.                                                                                                                                            |
| `spacing`      | number | `16`        | Gap between cards.                                                                                                                                                                   |
| `onTap`        | event  | none        | Payload `{ index, id }`.                                                                                                                                                             |

```
CardRail(size: "home", items: data.recent, onTap: event "recent" {})
```

### CardGrid

A grid of album cards. Columns follow the width of the grid: 2 below 500, 3 below 800, 4 below 1100, otherwise 5. The row height is computed from the real text styles.

| Argument       | Type   | Default                       | Meaning                                                                                                   |
| -------------- | ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `items`        | list   | none                          | Card items.                                                                                               |
| `sliver`       | bool   | `false`                       | Produce a sliver for use inside `ScrollPage`. Otherwise a scrolling grid of its own.                      |
| `titleLines`   | int    | `1` on a phone, `2` elsewhere | Maximum title lines.                                                                                      |
| `padding`      | number | `24`                          | Side padding of the stand-alone grid on wider layouts (zero on a phone). Ignored when `sliver` is `true`. |
| `refreshEvent` | string | none                          | Event name; pull-to-refresh on the stand-alone grid. Ignored when `sliver` is `true`.                     |
| `hasMore`      | bool   | `false`                       | Adds a trailing load-more cell (only if `onLoadMore` is bound).                                           |
| `onLoadMore`   | tap    | none                          | Fired when the load-more cell scrolls into view; make the handler idempotent.                             |
| `onTap`        | event  | none                          | Payload `{ index, id }`.                                                                                  |

```
CardGrid(sliver: true, items: data.stations, hasMore: data.hasMore, onLoadMore: event "more" {}, onTap: event "play" {})
```

### HeroCard

A wide card: a square cover on the left, title and caption beside it.

| Argument  | Type   | Default | Meaning                                          |
| --------- | ------ | ------- | ------------------------------------------------ |
| `title`   | string | `""`    | Title (two lines at most).                       |
| `caption` | string | `""`    | Caption (two lines at most).                     |
| `cover`   | string | none    | Artwork.                                         |
| `height`  | number | `132`   | Card height; the cover is a square of this size. |
| `onTap`   | tap    | none    | Tap handler.                                     |

```
HeroCard(title: "New this week", caption: "Fresh stations picked for you", cover: data.cover, onTap: event "hero" {})
```

### HeroStrip

The top-of-page strip: a hero card followed by shortcut cards in one horizontally scrolling row. On a phone only the hero is shown. With no `pins` the hero spans the page; with neither hero nor pins nothing is drawn. The row has the same scroll arrows as `CardRail` on desktop.

| Argument | Type  | Default | Meaning                             |
| -------- | ----- | ------- | ----------------------------------- |
| `hero`   | map   | none    | `{ title, caption, cover }`.        |
| `pins`   | list  | none    | Card items.                         |
| `onHero` | tap   | none    | Hero tap.                           |
| `onPin`  | event | none    | Payload `{ index, id }` of the pin. |

```
HeroStrip(hero: data.hero, pins: data.pins, onHero: event "hero" {}, onPin: event "pin" {})
```

### PinStrip

A horizontal row of compact shortcut chips (small cover, name beside it). Has the same scroll arrows as `CardRail` on desktop.

| Argument | Type  | Default | Meaning                                        |
| -------- | ----- | ------- | ---------------------------------------------- |
| `items`  | list  | none    | Card items; only `title` and `cover` are used. |
| `onTap`  | event | none    | Payload `{ index, id }`.                       |

```
PinStrip(items: data.pins, onTap: event "pin" {})
```

### CategoryTiles

Shortcut tiles with an icon, label and optional trailing text: one per row on a phone, two per row below 760 wide, otherwise four.

| Argument | Type  | Default | Meaning                                                                       |
| -------- | ----- | ------- | ----------------------------------------------------------------------------- |
| `items`  | list  | none    | Items: `id`, `icon`, `label`, `trailing` (text shown before the chevron).     |
| `sliver` | bool  | `false` | Produce a sliver for use inside `ScrollPage`. Otherwise a non-scrolling grid. |
| `onTap`  | event | none    | Payload `{ index, id }`.                                                      |

```
CategoryTiles(sliver: true, items: data.tiles, onTap: event "tile" {})
```

### MediaRow

A list row: a 44 px cover, a title and a subtitle (one line each).

| Argument   | Type   | Default | Meaning      |
| ---------- | ------ | ------- | ------------ |
| `title`    | string | `""`    | Title.       |
| `subtitle` | string | `""`    | Subtitle.    |
| `cover`    | string | none    | Artwork.     |
| `onTap`    | tap    | none    | Tap handler. |

```
MediaRow(title: s.title, subtitle: s.subtitle, cover: s.cover, onTap: event "song" { index: s.index })
```

### MediaRowList

A lazily built, scrolling list of `MediaRow`s, for library-sized lists.

| Argument       | Type   | Default | Meaning                                                                      |
| -------------- | ------ | ------- | ---------------------------------------------------------------------------- |
| `items`        | list   | none    | Items: `id`, `title`, `subtitle`, `cover`.                                   |
| `padding`      | number | `24`    | Side padding on wider layouts (zero on a phone).                             |
| `refreshEvent` | string | none    | Event name; enables pull-to-refresh.                                         |
| `hasMore`      | bool   | `false` | Adds a trailing load-more row (only if `onLoadMore` is bound).               |
| `onLoadMore`   | tap    | none    | Fired when the load-more row scrolls into view; make the handler idempotent. |
| `onTap`        | event  | none    | Payload `{ index, id }`.                                                     |

```
MediaRowList(items: data.items, padding: 0.0, hasMore: data.hasMore, onLoadMore: event "more" {}, onTap: event "pick" {})
```

### ChoiceCard

A large tappable choice: an icon, a title and an explanation, with a chevron (or a spinner while `busy`).

| Argument   | Type   | Default     | Meaning                                |
| ---------- | ------ | ----------- | -------------------------------------- |
| `icon`     | string | puzzle icon | Lucide icon name.                      |
| `title`    | string | `""`        | Title.                                 |
| `subtitle` | string | `""`        | Explanation.                           |
| `busy`     | bool   | `false`     | Show a spinner instead of the chevron. |
| `disabled` | bool   | `false`     | Not tappable.                          |
| `onTap`    | tap    | none        | Tap handler.                           |

```
ChoiceCard(icon: "globe", title: "Connect to a server", subtitle: "Use a server you already run.", onTap: event "setup" { action: "remote" })
```

### ResultTile

A card row with a cover, a title, a type icon beside the subtitle and one action button.

| Argument      | Type   | Default      | Meaning                            |
| ------------- | ------ | ------------ | ---------------------------------- |
| `cover`       | string | none         | Artwork.                           |
| `title`       | string | `""`         | Title.                             |
| `subtitle`    | string | `""`         | Subtitle.                          |
| `typeIcon`    | string | puzzle icon  | Icon drawn before the subtitle.    |
| `actionIcon`  | string | `download`   | Icon of the action button.         |
| `actionLabel` | string | `"Download"` | Tooltip of the action button.      |
| `busy`        | bool   | `false`      | Replace the button with a spinner. |
| `onAction`    | tap    | none         | Action button handler.             |

```
ResultTile(title: station.title, subtitle: station.subtitle, cover: station.cover, typeIcon: "radio", actionIcon: "x", actionLabel: "Remove", onAction: event "remove" { id: station.id })
```

### FeatureCard

A highlighted card for one item: cover, a type badge, title, subtitle, an optional note and a primary button.

| Argument      | Type   | Default      | Meaning                                |
| ------------- | ------ | ------------ | -------------------------------------- |
| `cover`       | string | none         | Artwork.                               |
| `badge`       | string | `""`         | Text of the pill badge.                |
| `badgeIcon`   | string | `link`       | Icon before the badge.                 |
| `title`       | string | `""`         | Title (two lines at most).             |
| `subtitle`    | string | `""`         | Subtitle.                              |
| `note`        | string | none         | Italic note under the subtitle.        |
| `buttonLabel` | string | `"Download"` | Button label.                          |
| `buttonIcon`  | string | `download`   | Button icon.                           |
| `busy`        | bool   | `false`      | Disable the button and show a spinner. |
| `onPressed`   | tap    | none         | Button handler.                        |

```
FeatureCard(cover: data.link.cover, badge: "Station", title: data.link.title, subtitle: data.link.subtitle, buttonLabel: "Save", buttonIcon: "heart", onPressed: event "save" {})
```

### JobCard

A job with progress: cover, title, a status line, a progress bar and its actions, with an expandable list of per-item lines.

| Argument      | Type        | Default            | Meaning                                                                                                                       |
| ------------- | ----------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `title`       | string      | `""`               | Title.                                                                                                                        |
| `subtitle`    | string      | none               | Subtitle.                                                                                                                     |
| `cover`       | string      | none               | Artwork.                                                                                                                      |
| `status`      | string      | `""`               | Status text.                                                                                                                  |
| `statusIcon`  | string      | `clock`            | Icon before the status text.                                                                                                  |
| `statusTone`  | colour role | `onSurfaceVariant` | Colour of the status icon and text.                                                                                           |
| `progress`    | number      | none               | Bar value from 0 to 1; the bar is indeterminate when absent.                                                                  |
| `failed`      | bool        | `false`            | Draws the bar in the error colour.                                                                                            |
| `lines`       | list        | none               | Per-item lines: `icon`, `tone` (colour role), `text`, `trailing`. The expand toggle appears when there is more than one line. |
| `onViewFiles` | tap         | none               | Shows a "View files" button when bound.                                                                                       |
| `onCancel`    | tap         | none               | Shows a "Cancel" button when bound; takes precedence over `onDismiss`.                                                        |
| `onDismiss`   | tap         | none               | Shows a "Dismiss" button when bound and `onCancel` is not.                                                                    |

```
JobCard(
  title: r.title, subtitle: r.subtitle, cover: r.cover,
  status: r.status, statusIcon: r.statusIcon, statusTone: r.statusTone,
  progress: r.progress, failed: r.failed, lines: r.lines,
  onCancel: switch r.active { true: event "cancel" { id: r.id } },
  onDismiss: event "dismiss" { id: r.id },
)
```

### LinkCard

A tappable card that leads somewhere: an icon tile, a title, a subtitle and a chevron.

| Argument   | Type   | Default     | Meaning           |
| ---------- | ------ | ----------- | ----------------- |
| `icon`     | string | puzzle icon | Icon in the tile. |
| `title`    | string | `""`        | Title.            |
| `subtitle` | string | `""`        | Subtitle.         |
| `onTap`    | tap    | none        | Tap handler.      |

```
LinkCard(icon: "list-music", title: data.playlistName, subtitle: "Your most played", onTap: event "playlist" {})
```

### NoteCard

An explanatory note with an optional button.

| Argument      | Type   | Default       | Meaning                                      |
| ------------- | ------ | ------------- | -------------------------------------------- |
| `icon`        | string | `info`        | Icon.                                        |
| `title`       | string | `""`          | Title.                                       |
| `text`        | string | `""`          | Body text.                                   |
| `buttonLabel` | string | none          | The button is drawn only when this is given. |
| `buttonIcon`  | string | `arrow-right` | Button icon.                                 |
| `onPressed`   | tap    | none          | Button handler.                              |

```
NoteCard(title: "Rankings are yearly", text: "Open the year to see top stations.", buttonLabel: "Open the year", onPressed: event "year" {})
```

### EmptyState

A centred icon, an optional title and an explanation - an empty page.

| Argument    | Type        | Default                                            | Meaning                |
| ----------- | ----------- | -------------------------------------------------- | ---------------------- |
| `icon`      | string      | `inbox`                                            | Icon.                  |
| `iconSize`  | number      | `40` with a title, `32` without                    | Icon size.             |
| `iconColor` | colour role | `primary` with a title, `onSurfaceVariant` without | Icon colour.           |
| `title`     | string      | none                                               | Title.                 |
| `text`      | string      | `""`                                               | Explanation (centred). |

```
EmptyState(icon: "heart", title: "No favourites yet", text: "Open a station and tap Favourite.")
```

### Message

A centred line of text, for short states such as an error.

| Argument | Type        | Default            | Meaning      |
| -------- | ----------- | ------------------ | ------------ |
| `text`   | string      | `""`               | The text.    |
| `color`  | colour role | `onSurfaceVariant` | Text colour. |

```
Message(text: data.error, color: "error")
```

### EmptyCard

A card standing in for an empty list: an icon, a title and an explanation.

| Argument | Type   | Default | Meaning      |
| -------- | ------ | ------- | ------------ |
| `icon`   | string | `inbox` | Icon.        |
| `title`  | string | `""`    | Title.       |
| `text`   | string | `""`    | Explanation. |

```
EmptyCard(icon: "radio", title: "No stations yet", text: "Search above to find one.")
```

### StatusLine

An icon (or a spinner) and one line of text.

| Argument    | Type        | Default            | Meaning                                           |
| ----------- | ----------- | ------------------ | ------------------------------------------------- |
| `text`      | string      | `""`               | The text.                                         |
| `icon`      | string      | puzzle icon        | Lucide icon. Not drawn while `spinner` is `true`. |
| `iconSize`  | number      | `18`               | Icon size.                                        |
| `tone`      | colour role | `onSurfaceVariant` | Icon colour.                                      |
| `spinner`   | bool        | `false`            | Show a spinner instead of the icon.               |
| `gap`       | number      | `10`               | Space between icon and text.                      |
| `style`     | text role   | `bodyMedium`       | Text role.                                        |
| `textColor` | colour role | `onSurface`        | Text colour.                                      |

```
StatusLine(spinner: data.session.spinner, icon: data.session.icon, tone: data.session.tone, text: data.session.text)
```

### ProgressLine

A thin progress bar with an optional caption.

| Argument   | Type        | Default       | Meaning                                       |
| ---------- | ----------- | ------------- | --------------------------------------------- |
| `value`    | number      | none          | 0 to 1; the bar is indeterminate when absent. |
| `color`    | colour role | theme default | Bar colour.                                   |
| `caption`  | string      | none          | Small text under the bar.                     |
| `maxWidth` | number      | `320`         | Maximum width of the bar.                     |

```
ProgressLine(value: data.progress, caption: "12 of 40 saved")
```

### ExpandableText

Collapsible prose (a description, a biography) with an optional credit line.

| Argument         | Type   | Default | Meaning                                                                            |
| ---------------- | ------ | ------- | ---------------------------------------------------------------------------------- |
| `text`           | string | `""`    | The prose.                                                                         |
| `credit`         | string | `""`    | Small credit line under the text.                                                  |
| `collapsedLines` | int    | `3`     | Lines shown while collapsed.                                                       |
| `threshold`      | int    | `200`   | A More / Show less toggle appears when `text` is longer than this many characters. |
| `maxWidth`       | number | none    | Maximum width.                                                                     |

```
ExpandableText(text: data.notes, credit: data.credit, maxWidth: 640.0)
```

---

## Tracks

Track lists and the detail-page header. Rows are Elbert's own song cards, with the same now-playing bars, status icons, badges and context menus as the local library's. See *Track item* above for the item shape. Every event here carries `{ index, id }`, and `onMenu` additionally carries `action` (the picked menu entry's `id`).

### TrackList

Song rows, as a sliver by default.

| Argument     | Type   | Default | Meaning                                                                                                                                                                      |
| ------------ | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`      | list   | none    | Track items.                                                                                                                                                                 |
| `sliver`     | bool   | `true`  | A sliver for `ScrollPage`. Set `false` for a plain column inside another widget.                                                                                             |
| `spacing`    | number | `0`     | Space under each row.                                                                                                                                                        |
| `hasMore`    | bool   | `false` | Adds a trailing load-more row (only if `onLoadMore` is bound).                                                                                                               |
| `onLoadMore` | tap    | none    | Fired when the load-more row scrolls into view; make the handler idempotent.                                                                                                 |
| `onPlay`     | event  | none    | Row tapped. Payload `{ index, id }`.                                                                                                                                         |
| `onArtist`   | event  | none    | Artist text tapped, for items with `artistLink: true`. Payload `{ index, id }`.                                                                                              |
| `onMenu`     | event  | none    | A menu entry was picked (the row's overflow button, or right-click). Payload `{ index, id, action }`. No menu button is drawn when an item has no `menu` or this is unbound. |

```
TrackList(
  items: data.tracks,
  hasMore: data.hasMore,
  onLoadMore: event "more" {},
  onPlay: event "play" {},
  onArtist: event "artist" {},
  onMenu: event "menu" {},
)
```

### CompactTrackList

Denser list-tile rows (cover, title, artist), with the same trailing vocabulary as `TrackList`: duration giving way to the now-playing bars on the current row, then the badge, the status icon and the overflow menu. On a narrow row (under 420 wide) the duration or "Now playing" moves under the artist. The menu also opens on right-click and long-press. Not a sliver; it is a column.

| Argument     | Type  | Default | Meaning                                                        |
| ------------ | ----- | ------- | -------------------------------------------------------------- |
| `items`      | list  | none    | Track items (`statusError` and `artistLink` are not used).     |
| `hasMore`    | bool  | `false` | Adds a trailing load-more row (only if `onLoadMore` is bound). |
| `onLoadMore` | tap   | none    | Fired when the load-more row scrolls into view.                |
| `onPlay`     | event | none    | Payload `{ index, id }`.                                       |
| `onMenu`     | event | none    | Payload `{ index, id, action }`.                               |

```
CompactTrackList(items: data.tracks, hasMore: data.hasMore, onLoadMore: event "more" {}, onPlay: event "play" {}, onMenu: event "menu" {})
```

### ReorderableTrackList

A drag-to-reorder list with a remove button per row. It does not scroll by itself (it shrink-wraps), so place it in a scroll view. The plugin must apply the change and push the new list.

| Argument      | Type   | Default    | Meaning                                                                                      |
| ------------- | ------ | ---------- | -------------------------------------------------------------------------------------------- |
| `items`       | list   | none       | Items: `id`, `title`, `artist`, `cover`.                                                     |
| `removeLabel` | string | `"Remove"` | Tooltip of the remove button.                                                                |
| `onReorder`   | event  | none       | Payload `{ from, to }`: indices in the list as shown, `to` already adjusted for the removal. |
| `onRemove`    | event  | none       | Payload `{ index }`.                                                                         |

```
ReorderableTrackList(items: data.editItems, removeLabel: "Remove from playlist", onReorder: event "reorder" {}, onRemove: event "remove" {})
```

### StickyHeader

The detail-page header (cover, type label, title, subtitle, info columns, Play and Shuffle) that stays pinned as it collapses. A sliver; use it inside `ScrollPage`. It animates on the nearest `Stagger`.

| Argument         | Type   | Default | Meaning                                    |
| ---------------- | ------ | ------- | ------------------------------------------ |
| `title`          | string | `""`    | Title.                                     |
| `subtitle`       | string | none    | Subtitle (for example the artist).         |
| `type`           | string | `""`    | Small type label (`"ALBUM"`, `"STATION"`). |
| `cover`          | string | none    | Artwork.                                   |
| `info`           | list   | none    | Info columns: `label`, `value`.            |
| `onPlayAll`      | tap    | none    | Play button.                               |
| `onShuffle`      | tap    | none    | Shuffle button.                            |
| `onSubtitle`     | tap    | none    | Makes the subtitle tappable when bound.    |
| `back`           | bool   | `true`  | Show a back button.                        |
| `topInset`       | bool   | `true`  | Pad the header below the shell's top bar.  |
| `expanded`       | number | `380`   | Expanded height on wider layouts.          |
| `expandedMobile` | number | `580`   | Expanded height on a phone.                |
| `collapsed`      | number | `84`    | Collapsed (pinned) height.                 |

```
ScrollPage(
  topInset: false,
  bottomInset: "dock",
  slivers: [
    StickyHeader(title: data.title, subtitle: data.subtitle, type: "STATION", cover: data.cover, info: data.info, onPlayAll: event "play" {}, onShuffle: event "play" {}),
    TrackList(items: data.tracks, onPlay: event "play" {}),
  ],
)
```

---

## Stats

Listening-summary widgets: an animated headline number, count tiles, a tappable bar chart, ranked rows, share bars, a badge rail and a period picker. Numbers are plain data; every animation is the host's.

### StatHero

A card with a caption, one large number that counts up when `value` changes, a unit and an optional note.

| Argument  | Type   | Default       | Meaning                              |
| --------- | ------ | ------------- | ------------------------------------ |
| `caption` | string | `""`          | Small heading beside the icon.       |
| `value`   | int    | `0`           | The number.                          |
| `unit`    | string | `""`          | Text under the number (`"minutes"`). |
| `note`    | string | none          | Small note at the bottom.            |
| `icon`    | string | `audio-lines` | Icon beside the caption.             |

```
StatHero(caption: "TIME LISTENED", value: data.hero.value, unit: "minutes", note: data.hero.note)
```

### CountTiles

Small tiles with an icon, a number that counts up and a label. Two per row below 520 wide, otherwise up to four per row. Draws nothing for an empty list.

| Argument | Type | Default | Meaning                                                                 |
| -------- | ---- | ------- | ----------------------------------------------------------------------- |
| `tiles`  | list | none    | Tiles: `icon`, `label`, `value` (int; shown with thousands separators). |

```
CountTiles(tiles: [{ icon: "music", label: "Songs", value: 1240 }, { icon: "disc-3", label: "Albums", value: 86 }])
```

### BarChart

Vertical bars that grow in one after another. Bar heights are relative to the largest value. A bar opens what it stands for.

| Argument       | Type   | Default        | Meaning                                                           |
| -------------- | ------ | -------------- | ----------------------------------------------------------------- |
| `bars`         | list   | none           | Bars: `id`, `label` (under the bar), `tooltip`, `value` (number). |
| `caption`      | string | none           | Text above the chart.                                             |
| `height`       | number | `150`          | Height of the bar area.                                           |
| `animationKey` | string | number of bars | Changing this value replays the grow-in animation.                |
| `onTap`        | event  | none           | A bar was tapped. Payload `{ index, id }`.                        |

```
BarChart(bars: data.months, caption: "Listening by month", animationKey: data.year, onTap: event "month" {})
```

### RankList

Numbered rows (rank, cover, title, subtitle, caption), the top three in the accent colour, collapsed to `collapsed` rows with a "Show all N" toggle.

| Argument    | Type   | Default | Meaning                                                                                                  |
| ----------- | ------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `items`     | list   | none    | Items: `id`, `title`, `subtitle`, `cover`, `caption` (right-hand text), `disabled` (bool; not tappable). |
| `collapsed` | int    | `10`    | Rows shown before expanding.                                                                             |
| `padding`   | number | `0`     | Left and right padding.                                                                                  |
| `onTap`     | event  | none    | Payload `{ index, id }`.                                                                                 |

```
RankList(items: data.songs, padding: switch data.layout.mobile { true: 0.0, default: 20.0 }, onTap: event "open" { rail: "songs" })
```

### ShareBars

Horizontal bars showing each item's share of the largest, for things with no page of their own to open.

| Argument | Type | Default | Meaning                                                       |
| -------- | ---- | ------- | ------------------------------------------------------------- |
| `items`  | list | none    | Items: `name`, `caption` (right-hand text), `value` (number). |

```
ShareBars(items: data.genres)
```

### BadgeRail

A horizontal row of badge artwork with a label and caption (200 px high).

| Argument  | Type   | Default | Meaning                                                                                                          |
| --------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `items`   | list   | none    | Items: `art` (image), `artDark` (image used instead of `art` in the dark theme, when given), `label`, `caption`. |
| `padding` | number | `0`     | Left and right padding of the row.                                                                               |

```
BadgeRail(items: data.milestones, padding: 20.0)
```

### ChipPicker

A horizontal row of pill options (years, periods). The selected pill is not tappable.

| Argument   | Type   | Default | Meaning                          |
| ---------- | ------ | ------- | -------------------------------- |
| `options`  | list   | none    | Options: `id`, `label`.          |
| `selected` | string | `""`    | The `id` of the selected option. |
| `onSelect` | event  | none    | Payload `{ id }`.                |

```
ChipPicker(options: data.years, selected: data.selected, onSelect: event "select" {})
```

---

## Forms

Inputs and the setup-flow shell. Text fields own their text on the host side and report it; a plugin that wants to clear or replace a field changes its `resetKey` along with its `value`.

### SearchField

Elbert's search box, with debounced queries.

| Argument     | Type   | Default     | Meaning                                                                               |
| ------------ | ------ | ----------- | ------------------------------------------------------------------------------------- |
| `hint`       | string | `"Search…"` | Placeholder.                                                                          |
| `debounceMs` | int    | `400`       | Delay after typing before `onQuery` fires (0 or below fires on every change).         |
| `resetKey`   | string | none        | When set, the field is cleared whenever this value changes.                           |
| `onQuery`    | event  | none        | Payload `{ query }`. Also fired with an empty `query` when the user clears the field. |
| `onClear`    | tap    | none        | The user cleared the field.                                                           |

```
SearchField(hint: "Search stations…", onQuery: event "query" {})
```

### TextInput

A text field.

| Argument      | Type   | Default | Meaning                                                     |
| ------------- | ------ | ------- | ----------------------------------------------------------- |
| `label`       | string | `""`    | Field label.                                                |
| `hint`        | string | `""`    | Placeholder.                                                |
| `icon`        | string | none    | Leading icon.                                               |
| `value`       | string | `""`    | Initial text. Applied again only when `resetKey` changes.   |
| `resetKey`    | string | none    | Changing this value replaces the field's text with `value`. |
| `obscure`     | bool   | `false` | Password field with a show/hide toggle.                     |
| `disabled`    | bool   | `false` | Not editable.                                               |
| `keyboard`    | string | default | `email`, `number` or `url`.                                 |
| `digitsOnly`  | bool   | `false` | Accept digits only.                                         |
| `maxLength`   | int    | none    | Maximum length.                                             |
| `onChanged`   | event  | none    | Payload `{ value }`.                                        |
| `onSubmitted` | event  | none    | Payload `{ value }`.                                        |

```
TextInput(label: "Country", hint: "Two-letter code, e.g. DE", icon: "globe", value: data.country, onChanged: event "country" {})
```

### Button

A button.

| Argument    | Type   | Default | Meaning                                                                                                                                                                              |
| ----------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`     | string | `""`    | Button text.                                                                                                                                                                         |
| `variant`   | string | `tonal` | `filled`, `outlined`, `text`, `danger` (error container colours), `tonalFilled`, `chip` (secondary-container action chip), or anything else for the standard tonal button (`tonal`). |
| `icon`      | string | none    | Leading icon (`danger` always reserves an icon slot).                                                                                                                                |
| `iconSize`  | number | `16`    | Icon size.                                                                                                                                                                           |
| `busy`      | bool   | `false` | Disables the button and shows a spinner in place of the icon.                                                                                                                        |
| `disabled`  | bool   | `false` | Disables the button.                                                                                                                                                                 |
| `wide`      | bool   | `false` | With `variant: "filled"` only: stretches the button across its parent (the setup flow's shape).                                                                                      |
| `onPressed` | tap    | none    | Press handler; the button is disabled when unbound.                                                                                                                                  |

```
Button(variant: "filled", wide: true, label: "Sign in", busy: data.busy, onPressed: event "signIn" {})
```

### IconButton

An icon-only button with an optional count badge.

| Argument    | Type        | Default       | Meaning                                             |
| ----------- | ----------- | ------------- | --------------------------------------------------- |
| `icon`      | string      | puzzle icon   | Lucide icon.                                        |
| `tooltip`   | string      | none          | Tooltip.                                            |
| `size`      | number      | theme default | Icon size.                                          |
| `color`     | colour role | theme default | Icon colour.                                        |
| `compact`   | bool        | `false`       | Compact visual density.                             |
| `badge`     | int         | `0`           | Count badge, drawn when above 0.                    |
| `disabled`  | bool        | `false`       | Disables the button.                                |
| `onPressed` | tap         | none          | Press handler; the button is disabled when unbound. |

```
IconButton(icon: "folder-down", tooltip: "Downloads", badge: data.tabs.4.badge, onPressed: event "downloads" {})
```

### SwitchRow

An on/off switch with a title and explanation beside it.

| Argument    | Type   | Default | Meaning                                                          |
| ----------- | ------ | ------- | ---------------------------------------------------------------- |
| `title`     | string | `""`    | Title.                                                           |
| `subtitle`  | string | none    | Explanation.                                                     |
| `value`     | bool   | `false` | Switch state.                                                    |
| `disabled`  | bool   | `false` | Disables the switch.                                             |
| `onChanged` | event  | none    | Payload `{ value }` (bool). The switch is disabled when unbound. |

```
SwitchRow(title: "High-quality streams only", subtitle: "Hide stations under 128 kbps.", value: data.highQuality, onChanged: event "highQuality" {})
```

### SettingsHeader

A settings page's heading: icon, title, an optional description and an optional master switch.

| Argument      | Type   | Default     | Meaning                                                                                  |
| ------------- | ------ | ----------- | ---------------------------------------------------------------------------------------- |
| `icon`        | string | puzzle icon | Icon.                                                                                    |
| `title`       | string | `""`        | Title.                                                                                   |
| `description` | string | none        | Text under the title.                                                                    |
| `value`       | bool   | none        | When this is a bool, the master switch is drawn with that state; when absent, no switch. |
| `onChanged`   | event  | none        | Payload `{ value }` (bool). The switch is disabled when unbound.                         |

```
SettingsHeader(icon: "radio", title: "Radio Browser", description: "Stations come from a free community directory.", value: data.enabled, onChanged: event "enabled" {})
```

### Segmented

A segmented choice. Draws nothing when there are no options.

| Argument   | Type   | Default             | Meaning                                                 |
| ---------- | ------ | ------------------- | ------------------------------------------------------- |
| `options`  | list   | none                | Options: `id`, `label`, `icon` (optional).              |
| `selected` | string | first option's `id` | The `id` of the selected option.                        |
| `onSelect` | event  | none                | Payload `{ id }`. The control is disabled when unbound. |

```
Segmented(
  selected: data.mode,
  options: [{ id: "managed", label: "Automatic", icon: "container" }, { id: "remote", label: "Remote", icon: "globe" }],
  onSelect: event "mode" {},
)
```

### SetupShell

The setup flow's card: a large icon, a title, a message and the step's own content under them, centred and at most 460 px wide.

| Argument  | Type   | Default     | Meaning                                                                            |
| --------- | ------ | ----------- | ---------------------------------------------------------------------------------- |
| `icon`    | string | puzzle icon | Large icon.                                                                        |
| `title`   | string | `""`        | Title.                                                                             |
| `message` | string | none        | Text under the title.                                                              |
| `tone`    | string | none        | `error` draws the icon in the error colour; anything else uses the primary colour. |
| `busy`    | bool   | `false`     | Shows the expressive loader and hides `child`.                                     |
| `child`   | child  | none        | The step's content.                                                                |

```
SetupShell(icon: "plug", title: "Connect", message: "Enter your server address.", child: TextInput(label: "Server URL", onChanged: event "url" {}))
```

### LogBox

Monospace selectable log output in a scrolling well.

| Argument    | Type   | Default | Meaning         |
| ----------- | ------ | ------- | --------------- |
| `text`      | string | `""`    | The log text.   |
| `maxHeight` | number | `180`   | Maximum height. |

```
LogBox(text: data.logs, maxHeight: 220.0)
```

---

## Decoration

Gradients, glows, particles, waves, and wrappers that move their child. These are what a
[theme's](themes.md) animated background is made of, and any plugin page can use them too. Each one
animates itself from its arguments - there is no clock, arithmetic or logic in a template - and
stops when the app is not showing it or the system asks for reduced motion. Colours are roles
(`primaryContainer`, `surface`, ...), so a decoration follows light, dark, AMOLED and the user's
accent. Decoration widgets expand to fill the space they are given: put them in a `Stack` with
`fit: "expand"`.

### GradientFill

A gradient filling its box.

| Argument  | Type          | Default    | Meaning                                                                           |
| --------- | ------------- | ---------- | --------------------------------------------------------------------------------- |
| `kind`    | string        | `linear`   | `linear` (top to bottom), `radial` or `sweep`.                                    |
| `colors`  | colour roles  | -          | Two or more colour roles. Fewer than two draws nothing.                           |
| `stops`   | numbers       | even       | One 0..1 position per colour.                                                     |
| `opacity` | number        | `1.0`      | Multiplies each colour's alpha.                                                   |
| `angle`   | number        | `0.0`      | Starting rotation, in turns (linear and sweep).                                   |
| `spin`    | number        | `0.0`      | Seconds one full turn takes; `0.0` keeps it still.                                |
| `centerX`, `centerY` | numbers | `0.0` | Centre of a radial or sweep gradient, -1..1.                                      |
| `radius`  | number        | `0.75`     | Radius of a radial gradient, as a fraction of the box.                            |

### Orb

A soft glowing circle that wanders around its resting place.

| Argument           | Type        | Default   | Meaning                                                          |
| ------------------ | ----------- | --------- | ---------------------------------------------------------------- |
| `color`            | colour role | `primary` | Glow colour.                                                     |
| `opacity`          | number      | `0.5`     | Strength at the centre.                                          |
| `size`             | number      | `0.5`     | Diameter as a fraction of the box's shorter side.                |
| `x`, `y`           | numbers     | `0.0`     | Resting place, -1..1 (-1 left/top, 1 right/bottom).              |
| `driftX`, `driftY` | numbers     | `0.15`    | How far it wanders from there, in the same units.                |
| `seconds`          | number      | `24.0`    | How long one lap takes.                                          |
| `phase`            | number      | `0.0`     | Where in the lap it starts (0..1), so orbs don't move in step.   |

### Particles

Specks drifting upward and twinkling.

| Argument  | Type        | Default     | Meaning                                         |
| --------- | ----------- | ----------- | ----------------------------------------------- |
| `color`   | colour role | `onSurface` | Colour.                                         |
| `opacity` | number      | `0.6`       | Brightest a speck gets.                         |
| `count`   | int         | `40`        | Number of specks, at most 300.                  |
| `size`    | number      | `2.5`       | Largest radius in logical pixels.               |
| `speed`   | number      | `0.03`      | Height of the box a speck rises per second.     |
| `seed`    | int         | `7`         | Same seed, same arrangement.                    |

### Waves

Layered waves rolling along the bottom, one layer per colour.

| Argument     | Type         | Default | Meaning                                                    |
| ------------ | ------------ | ------- | ---------------------------------------------------------- |
| `colors`     | colour roles | -       | One per layer, back to front.                              |
| `opacity`    | number       | `0.35`  | Multiplies each colour's alpha.                            |
| `baseline`   | number       | `0.65`  | How far down the first crest sits (0 top, 1 bottom).       |
| `amplitude`  | number       | `0.04`  | Crest height as a fraction of the box.                     |
| `wavelength` | number       | `0.8`   | Crest to crest, as a fraction of the box's width.          |
| `seconds`    | number       | `14.0`  | Period of one swell.                                       |

### Spin, Drift, Pulse

Wrappers that move one `child`.

| Widget  | Arguments                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Spin`  | `seconds` (`30.0`, one full turn), `reverse` (`false`).                                                                           |
| `Drift` | `dx`, `dy` (`0.1`, how far it floats, as a fraction of its own size), `seconds` (`20.0`).                                         |
| `Pulse` | `minOpacity`/`maxOpacity` (`1.0`), `minScale`/`maxScale` (`1.0`), `seconds` (`6.0`): breathes between the low and high values.    |

```
Spin(seconds: 90.0, child: Pulse(seconds: 8.0, minOpacity: 0.3, maxOpacity: 0.7, child: Orb(color: "tertiary")))
```

---

## Template rules

These fail at runtime, not when the template is parsed or checked.

- **Only `...for` can be spread into a list.** A `...switch` does not parse. Make the list element itself a `switch` that falls back to `SizedBox()`:

  ```
  children: [
    ...for r in data.rows: ResultTile(title: r.title),
    switch data.hasNote { true: Message(text: data.note), default: SizedBox() },
  ]
  ```

- **`null` is not a valid `switch` key.** Send booleans (`hasArtist`) from the plugin and switch on those, rather than switching on a value that may be absent.
- **Core widgets need doubles written with a decimal point:** `SizedBox(height: 14.0)`, not `14`. (The `elbert` library reads numbers whichever form they take; the RFW core widgets do not.)
- **Page data must contain no nulls.** The host strips null values from everything pushed with `page.set` and returned from `open`, so a key whose value is null reads as missing.
- **Numbers are read as exactly `int` or `double`.** RFW's `DataSource.v<T>` answers only for exactly `int`, `double`, `bool` or `String`; the `elbert` widgets read numbers through a helper that accepts either, so pass plain JSON numbers, not numeric strings.
- **Every `ui` manifest key is a library named by its key.** A template can `import common;` to reuse a widget declared in `ui/common.rfwtxt` when the manifest lists `"common": "ui/common.rfwtxt"`.
- **Set data before it is needed.** Widget builders snapshot their data synchronously while they build; a list widget reads its whole `items` list at that moment, so push the data a widget needs before (or with) the first frame that shows it, and give an unfinished list a `status` your template switches on (`Loader()` while loading) rather than a half-filled one.
- **Library widget names avoid RFW's own.** That is why text is `ThemedText` and icons are `ThemedIcon`, so a name from the `elbert` library does not shadow one from `core` or `material`.
