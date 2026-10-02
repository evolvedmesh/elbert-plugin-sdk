# Writing templates

Plugin pages are [Remote Flutter Widgets](https://pub.dev/packages/rfw) (RFW) text libraries,
`.rfwtxt` files. A template is **data**: it cannot run code, and it cannot pass a colour. It names
widgets, wires their arguments to `data.*`, and names events that call back into the plugin.

The widgets come from three libraries:

| Library    | What it is                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| `core`     | RFW's basics: `Column`, `Row`, `Expanded`, `SizedBox`, `Center`, `Padding`, `Stack`…          |
| `material` | RFW's Material widgets. Prefer `elbert` widgets; they follow Elbert's theme and rules.        |
| `elbert`   | Elbert's own widgets: song rows, album cards, headers, loaders. See [widgets.md](widgets.md). |

## Shape of a template

```
import core;
import elbert;
import common;                       // another library from the manifest's `ui` map

widget StationRow = Row(children: [
  Cover(path: args.cover, size: 48.0),
  SizedBox(width: 12.0),
  Expanded(child: ThemedText(text: args.title, maxLines: 1)),
]);

widget StationsPage = ScrollPage(
  slivers: [
    SliverBox(child: ThemedText(text: "Stations", style: "headlineMedium")),
    SliverBox(child: Column(children: [
      ...for s in data.stations:
        StationRow(cover: s.cover, title: s.title),
    ])),
  ],
);
```

- `widget Name = Expr;` declares a widget. A **route** names one as `library:Name`, where `library`
  is the key from the manifest's `ui` map.
- `data.*` is what the page controller returned from `open` and pushed with `page.set`.
  `args.*` are the arguments of a widget the template itself declares. `s` above is a loop
  variable.
- Every `ui` key is a library that other templates can `import`. A name you declare is visible
  everywhere that imports its library.
- Comments are `//` and `/* */`.

## Switching on data

```
widget StationList = switch args.status {
  "loading": Loader(),
  "error": EmptyState(icon: "wifi-off", title: "Couldn't load", text: args.error),
  default: CardGrid(items: args.stations, onTap: event "play" {}),
};
```

The page controller sends a `status` string (`loading`, `error`, `empty`, `ready`) and the template
switches on it. For optional content, send a boolean and switch on that.

## Events

```
onTap: event "play" {}
onPressed: event "setup" { action: "remote" }
```

`event "name" { key: value }` calls the controller's `events.name(page, args)`. `args` holds the
arguments written in the template plus the widget's own payload (`index`, `id`, `value`…); each
widget's payload is listed in [widgets.md](widgets.md). Two events are handled by the host with no
round trip:

```
event "elbert.navigate" { route: "/radio/search", mode: "go" }
event "elbert.back" {}
```

## Rules that fail at runtime

These do not fail at `elbert-plugin check` or when the template is parsed. The error appears in the
plugin's log when the page opens.

1. **Only `...for` can be spread into a list.** `...switch` does not parse. Make the element itself
   a `switch` that falls back to `SizedBox()`:

   ```
   children: [
     ...for r in data.rows: ResultTile(title: r.title),
     switch data.hasNote { true: Message(text: data.note), default: SizedBox() },
   ]
   ```

2. **`null` is not a valid `switch` key.** Send booleans from the plugin (`hasArtist`) and switch
   on those.
3. **Core widgets need doubles written with a decimal point:** `SizedBox(height: 14.0)`, not
   `14`. The `elbert` widgets accept either form.
4. **Page data contains no nulls.** The host strips them, so a key whose value is `null` reads as
   missing. Never use `null` to mean "unset".
5. **Numbers must be JSON numbers**, not numeric strings.
6. **Widgets read their data when they build.** Push what a widget needs before, or with, the first
   frame that shows it, and give an unfinished list a `status` your template switches on.

## Colours and text

There is no way to pass a colour or a font. Widgets take a **role**: `style: "headlineSmall"`,
`color: "primary"`. The host resolves the role from the current theme, including AMOLED and the
Android wallpaper palette, so a plugin follows the user's theme for free. The accepted role names
are listed at the top of [widgets.md](widgets.md).

## Layout that adapts

`data.layout` is maintained by the host: `width`, and the booleans `compact`, `medium`, `expanded`,
`mobile` and `narrow`. Use them to change what a page shows, for example:

```
padding: switch data.layout.mobile { true: 0.0, default: 20.0 },
```

On a phone, horizontally scrolling rows bleed to the screen edge, and a section's own bottom bar
(the "dock") is replaced by your `compact` destinations. Use `ScrollPage` with `bottomInset` so the
last row clears it; never hard-code a tail.

## Debugging

- `bunx elbert-plugin check` catches unbalanced brackets and a missing import, nothing finer.
- Open the plugin's log (Settings → Plugins → Log) for the parser's message.
- `bunx elbert-plugin dev` plus **Load development folder** reloads the plugin whenever a template
  or the code changes.
