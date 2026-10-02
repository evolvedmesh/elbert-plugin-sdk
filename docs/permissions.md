# Permissions

A plugin lists the permissions it wants in its manifest. Elbert shows them on the Plugins settings
page, and the plugin starts only after the user chooses **Allow and start**. Every host call checks
the granted permissions on the host side; the JavaScript prelude is not a security boundary.

Without any permission a plugin can still keep its own `storage` and `secrets`, add pages,
navigation, settings and actions, and write to its log.

| Permission  | Allows                                                                                                                                                                                      | Calls it unlocks                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `network`   | HTTP(S) requests and downloads to any host.                                                                                                                                                 | `http.request`, `http.download`                      |
| `storage`   | Files outside the plugin's own folders: Downloads, the music folders, Elbert's data folder. Without it a plugin may write only its own `data` and `cache` folders and read its own package. | Wider `fs.*` paths, `ui.reveal`, `LibraryTrack.path` |
| `process`   | Starting programs on the device (Docker on desktop, a runtime pack's binaries on Android).                                                                                                  | `process.run`, `process.start`                       |
| `player`    | Seeing what plays and controlling the player and queue.                                                                                                                                     | `player.*`                                           |
| `library`   | Reading the library and adding tracks.                                                                                                                                                      | `library.*`                                          |
| `playlists` | Creating and updating library playlists.                                                                                                                                                    | `playlists.*`                                        |
| `lyrics`    | Supplying lyrics for the plugin's own streams.                                                                                                                                              | `lyrics.provide`                                     |
| `history`   | Reading Elbert's own listening history and adding plays to it — and, when the user chooses, sending added plays on to their Last.fm account.                                                 | `history.*`                                          |

A call without its permission rejects with `code: 'permission_denied'`.

## Rules worth knowing

- Ask only for what you use. The user sees the list.
- Secrets go in `elbert.secrets`, which uses the platform's secure storage under
  `plugin.<id>.<key>`. Never put a credential in `storage` or in a log line.
- A file the user picked for the plugin with `ui.pickFiles` may be read without `storage`.
- Adding a permission in an update makes the plugin ask again before it starts.
- On Android, `process` may exec only files inside a runtime pack the manifest names. Every
  process a plugin starts is killed when the plugin stops.
- A stream's `url` may contain credentials. Elbert keeps stream tracks only in the queue and never
  writes one to the library, listening history or disk.
