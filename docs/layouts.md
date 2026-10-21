# Layouts

A **layout** says how Elbert's pages are arranged. It covers which blocks Home shows, in what rows,
at what size and in what colours. It covers the sidebar's groups and tabs, and the tabs of the phone
dock. It is plain JSON, and the same format turns up in three places:

| Where | What it does |
| --- | --- |
| **Settings → Layout** in Elbert | Users arrange Home and the sidebar by dragging, then export, edit or import the file. |
| **A theme's `theme.json`**, as `layouts` | The theme rearranges the pages as well as restyling them. See [themes](themes.md#layouts-arranging-the-pages). |
| **A plugin page** routed with `layout: true` | The page is drawn from blocks instead of a template. See [below](#plugin-pages-built-from-blocks). |

`types/layout.d.ts` types it (`import type { ElbertLayout } from '@evolvedmesh/elbert-plugin-sdk/layout'`).
`schemas/layout.schema.json` lets an editor complete and check a layout file. `elbert-plugin check`
applies Elbert's own rules to a theme's `layouts`.

## Two ways to write one

**Design it in Elbert, then export it.** This is the quickest way, and what you see is what you get:

1. Open **Settings → Layout → Home** (or hover the greeting on Home and press the corner button).
2. Drag blocks by their name to move them into a row or between rows. Drag a block's right edge to
   share its row differently, and its bottom edge to make it taller or its tiles bigger. Tap a block
   to set its title, colour, surface, corners and the widths it shows at. **Add block** lists every
   type.
3. Arrange the sidebar and the dock the same way under **Settings → Layout → Sidebar and phone dock**.
4. Press **Export** to save `elbert-layout.json`.

The exported file is a complete layout. Paste it into a theme's `layouts` as it is, or keep it and
share it.

**Write it by hand.** Start the file with `"$schema"` pointing at the SDK's schema and your editor
completes every block type, field and icon name:

```json
{
  "$schema": "./node_modules/@evolvedmesh/elbert-plugin-sdk/schemas/layout.schema.json",
  "elbertLayout": 1,
  "home": { "rows": [] }
}
```

**Settings → Layout → Edit as text** in Elbert is a third option: it checks the file as you type and
names the first problem (`home.rows[2].blocks[0].span must be a number from 0.5 to 12.`).

Every part is optional. A part left out comes from the next layout in line: **the user's → the
theme's → Elbert's own**. A theme that only sets `dock` keeps Elbert's Home and sidebar. A user who
customises Home keeps the theme's sidebar.

## Home: rows of blocks

```json
"home": { "rows": [
  { "blocks": [{ "type": "greeting" }], "spaceBefore": 0 },
  { "stackBelow": 900, "height": 216, "spaceBefore": 20, "blocks": [
    { "type": "nowPlaying", "span": 7 },
    { "type": "weekStats", "span": 5, "style": { "accent": "#2E7D32", "surface": "high" } }
  ] },
  { "blocks": [{ "type": "pinned", "title": "On rotation", "items": [{ "artist": "Bahari" }], "display": "grid", "tileSize": 150 }] },
  { "blocks": [{ "type": "recentlyPlayed", "limit": 8 }] }
] }
```

A **row** holds blocks side by side:

| Field | |
| --- | --- |
| `blocks` | One or more blocks. |
| `spaceBefore` | Space above the row, 0 - 400 (default 28). A row with nothing to show (no Subsonic server for `forYou`, nothing played yet) disappears, and hands its space to the next row that shows. That row uses the larger of the two. |
| `stackBelow` | Page width below which the blocks stack. Leave it out to keep them side by side. |
| `gap`, `stackGap` | Space between blocks side by side (16) and stacked (12). |
| `height` | The row's height while side by side, 48 - 2000. Leave it out to let blocks size themselves. |
| `id` | Optional, unique among rows. |

Every **block** has a `type`, and optionally these fields:
- `span`: its share of the row, a weight from 0.5 to 12.
- `visibleOn`: some of `compact` (page narrower than 600 px), `medium` (600–899) and `expanded`.
- `style`, which takes:
  - `accent`, a colour like `#RRGGBB` that re-seeds the block's colours;
  - `surface`, one of `none`, `low`, `base`, `high` or `highest`;
  - `radius`, the corner radius, 0 - 64.
- `id`: optional, unique among blocks.

| `type` | Its own fields | Shows |
| --- | --- | --- |
| `greeting` | | Good morning, and the date |
| `nowPlaying` | | What's playing, or Shuffle all |
| `weekStats` | | Time listened this week, a bar per day |
| `libraryTiles` | | Song, album, artist and playlist counts |
| `otherServices` | `title` | Plugins' sections as chips |
| `forYou` | `title`, `tileSize` | Quick Mix, Favourites, Infinity Radio (with a Subsonic server) |
| `recentlyPlayed` | `title`, `limit`, `tileSize` | What was played recently |
| `recentlyAdded` | `title`, `limit`, `tileSize` | The newest albums |
| `topArtists` | `title`, `limit`, `tileSize` | This week's top artists |
| `pinned` | `title`, `items`, `display`, `tileSize` | Chosen things: `{"album": key}`, `{"artist": name}`, `{"track": id}`, `{"playlist": id}`, `{"smartPlaylist": id}` |
| `playlists` | `title`, `limit`, `tileSize` | The user's playlists |
| `smartPlaylists` | `title`, `tileSize` | Favourites, most played, never played… |
| `topTracks` | `title`, `limit` | This week's most-played songs |
| `shortcut` | `title`, `text`, `icon`, `route` or `action` | One card. `action` is `shuffleAll`, `quickMix`, `favourites`, `infinityRadio` or `openPlayer` |
| `note` | `title`, `text` | A heading and some words |
| `spacer` | `size` | Empty space |
| `cards` | `title`, `cards`, `display`, `tileSize` | Plugin pages only, [below](#plugin-pages-built-from-blocks) |
| `widget` | `widget` | Plugin pages only |

- `display` is `rail` (one scrolling row, the default) or `grid`.
- `tileSize` is a tile's width, 64 - 480. Leave it out for Elbert's size at the page width.
- `limit` is 1 - 100.

A pinned item that's no longer in the library is skipped quietly. Album keys and track ids are the
library's own, so pins are personal. A theme is better off with blocks that fill themselves
(`recentlyAdded`, `smartPlaylists`) and `shortcut`s.

## Sidebar and dock

```json
"sidebar": { "groups": [
  { "id": "main", "label": "Listen", "items": [
    { "route": "/" },
    { "route": "/search" },
    { "route": "/playlists/smart/most-played", "label": "Heavy rotation", "icon": "flame", "color": "#FF7043" }
  ] },
  { "id": "library", "label": "Library", "items": [{ "route": "/albums" }, { "route": "/artists" }, { "route": "/songs" }, { "route": "/playlists" }] },
  { "id": "playlists", "label": "Your playlists", "source": "playlists", "limit": 6 },
  { "id": "services", "label": "Other Services", "source": "services" }
] },
"dock": { "items": [{ "route": "/" }, { "route": "/search" }, { "route": "/albums" }, { "route": "/settings" }] }
```

- **A tab** is a `route`. `label`, `icon` (a [Lucide](https://lucide.dev/icons) name) and `color`
  are optional; left out, they're the destination's own. A label you leave out still follows a
  theme's `strings`.
  - Elbert names its own pages automatically: `/`, `/search`, `/albums`, `/artists`, `/songs`,
    `/playlists`, `/stats`, `/folders`, `/settings`.
  - Plugin sections, `/playlists/<id>`, `/playlists/smart/<id>`, `/albums/<key>` and
    `/artists/<name>` are named automatically too.
  - A tab whose target is gone (a deleted playlist, a plugin that's off) is hidden until it's back.
- **A group** may have a `source` that adds rows after its own tabs:
  - `playlists`: the first `limit` playlists, and the Create playlist button.
  - `services`: every plugin section, and the marketplace, that isn't already a tab somewhere. A newly
    installed plugin therefore always appears, so keep one `services` group.
  - `smartPlaylists`: the built-in smart playlists.
- **The rail** on tablet widths shows the sidebar's tabs in order, then the services.
- **The dock** takes 2 to 5 tabs. A plugin section that takes the dock over on a phone still does,
  inside its own section.

## Plugin pages built from blocks

A route with `layout: true` instead of a `widget` draws its page from `data.blocks`, a list of rows
exactly like `home.rows`. Pages may use every block above, and two more:

- **`cards`**: tiles you supply, each `{ title, subtitle?, image?, icon?, route? | event?, args? }`. A
  `route` opens on tap; an `event` goes to your controller's `events[event]` with `args`.
- **`widget`**: one of your own templates, `library:Widget`, given the page's data. Mix Elbert's
  blocks with your own drawing wherever a block won't do.

```ts
elbert.ui.page('home', {
  open: () => ({
    blocks: [
      { blocks: [{ type: 'note', title: 'Radio', text: 'Stations near you' }], spaceBefore: 0 },
      {
        blocks: [
          {
            type: 'cards',
            title: 'Popular',
            cards: [{ title: 'Jazz FM', image: 'https://example.com/jazz.png', event: 'play', args: { id: 1 } }],
          },
        ],
      },
      { blocks: [{ type: 'widget', widget: 'radio:NowOnAir' }] },
    ],
  }),
  events: {
    play: (_page, args) => {
      console.log('play', args.id);
    },
  },
});

elbert.onActivate(async () => {
  await elbert.ui.setRoutes([{ path: '/radio', page: 'home', layout: true }]);
});
```

For completion on the blocks, type the controller with `LayoutPageData`
(`import type { LayoutPageData } from '@evolvedmesh/elbert-plugin-sdk'`), as in
`elbert.ui.page<LayoutPageData>('home', { … })`.

`page.set({ blocks })` redraws the page. A list Elbert can't read is reported in the plugin's log
(and the dev overlay). The page keeps showing the last good one, or says it has no blocks if there
never was one.

Use a template when the page needs a design of its own, and blocks when Elbert's rails, tiles and
cards already say what you mean. Block pages pick up the user's theme, and a theme's slot templates,
without any work from you.
