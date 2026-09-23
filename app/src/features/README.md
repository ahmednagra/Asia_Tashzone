# features/ — screen components by feature

One folder per product area: `home/`, `play/` (setup, offline table and `table/` widgets plus pure `logic.ts`), `lobby/` (online room), `settings/`. Route files in `app/` render these; they take props and callbacks rather than calling the router themselves.
