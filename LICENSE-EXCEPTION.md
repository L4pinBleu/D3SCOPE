# D3SCOPE Plugin Exception

**Version 1.0 — Additional permission under section 7 of the GNU Affero General Public License, version 3**

Copyright (C) 2026 L4pinBleu and D3SCOPE contributors

D3SCOPE is licensed under the GNU Affero General Public License, version 3
(see [`LICENSE`](./LICENSE)). As the copyright holders of D3SCOPE, we grant
the following additional permission, as allowed by section 7 of the AGPL-3.0.

## 1. Definitions

- **"Library"**: the D3SCOPE core, meaning the code in this repository and
  any work based on it, including modified versions.
- **"Plugin API"**: the public, documented interface the Library provides so
  that external code can extend it. This covers the plugin registration
  functions, the public exports, and the published TypeScript type
  declarations.
- **"Plugin"**: a separate work that meets all three of these conditions:
  1. it interacts with the Library **only through the Plugin API**;
  2. it contains **no code copied from the Library and no modified part of
     it**, except the type declarations needed to call the Plugin API;
  3. it is **distributed separately** from the Library and loaded at runtime,
     for example from a `plugins/` directory or as an external JavaScript
     module or element.

  Examples of Plugins: extra chart types, themes, color palettes, data
  connectors.

## 2. Permission

You may create, use, modify and convey Plugins under **terms of your choice,
including proprietary terms**. This holds even when a Plugin is loaded into,
linked with or conveyed together with the Library. Such a Plugin is not
considered a work based on the Library, and the AGPL-3.0 terms do not apply
to the Plugin itself.

## 3. What stays under the AGPL-3.0

The following are **not** covered by this exception and remain fully subject
to the AGPL-3.0:

- the Library itself, including any modification of it, and any fork or
  re-packaging that replaces or alters its core functionality;
- any work that copies Library source code, other than Plugin API type
  declarations;
- the Library's obligations under AGPL-3.0 section 13 (remote network
  interaction). If you run a modified Library over a network, you must offer
  its Corresponding Source. The source of separate Plugins does not have to
  be offered.

When you convey a combination of the Library and one or more Plugins, you
must still provide the Library's Corresponding Source, including any
modifications to it, under the AGPL-3.0.

## 4. Removal

As stated in AGPL-3.0 section 7, when you convey a copy of the Library you may
remove this additional permission from your copy, or from any part of it.
