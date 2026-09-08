# Mapbox Alternative: Vintage Pastel Style

Mapbox GL styles are full style specs (layers, sources, sprites) rather
than a short stylers array, and are normally authored visually in
**Mapbox Studio** rather than hand-written. For SIH1656, the fastest path:

1. Go to [Mapbox Studio](https://studio.mapbox.com) → "New style" → start
   from the **Monochrome (Light)** template — it's the closest built-in
   base to a faded, low-saturation look.
2. In Studio's style editor, batch-recolor these layer groups to match
   `assets/map_style/vintage_map_style.json`'s palette:

   | Layer group | Target color |
   |---|---|
   | Water | `#A9CFC8` (seafoam) fill, `#3F8C88` (retro teal) labels |
   | Landuse / land | `#E7D2B4` (sand-deep) |
   | Roads | `#F5EAD3` fill, `#D9C29B` casing |
   | Highways | `#E8935B` (faded orange) |
   | Parks | `#B7CDB0` |
   | Labels (text) | `#8A7156`, halo `#FAF1E4` |
   | Buildings (3D layer) | disable or set to `#DCC9A3` at low opacity |

3. Under **Style → Settings**, reduce global **Saturation** by ~30% and
   add a slight **Sepia**-leaning color adjustment for that
   sun-bleached-postcard feel.
4. Publish the style, copy its **Style URL** (`mapbox://styles/yourname/xxxxxxxx`).
5. In Flutter, with `mapbox_maps_flutter`:

```dart
MapWidget(
  styleUri: "mapbox://styles/yourname/xxxxxxxx",
  cameraOptions: CameraOptions(
    center: Point(coordinates: Position(userLon, userLat)),
    zoom: 11,
  ),
);
```

If you'd rather stay 100% Google Maps (simpler plugin setup, no Studio
account needed), use `vintage_map_style.json` directly with
`GoogleMap(style: ...)` as shown in `vintage_map_view.dart` — that's
the default wired up in this scaffold.
