import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../data/models/beach_model.dart';
import '../../domain/suitability_algorithm.dart';

/// A Google Map rendered with the vintage/sepia pastel JSON style,
/// showing beach markers color-coded by live suitability:
/// teal = safe, orange = moderate, red = unsafe.
class VintageMapView extends StatefulWidget {
  final LatLng center;
  final List<Beach> beaches;
  final ValueChanged<Beach>? onMarkerTap;

  const VintageMapView({
    super.key,
    required this.center,
    required this.beaches,
    this.onMarkerTap,
  });

  @override
  State<VintageMapView> createState() => _VintageMapViewState();
}

class _VintageMapViewState extends State<VintageMapView> {
  GoogleMapController? _controller;
  String? _mapStyle;

  @override
  void initState() {
    super.initState();
    _loadMapStyle();
  }

  Future<void> _loadMapStyle() async {
    final style = await rootBundle.loadString(
      'assets/map_style/vintage_map_style.json',
    );
    setState(() => _mapStyle = style);
    _controller?.setMapStyle(_mapStyle);
  }

  BitmapDescriptor _hueForStatus(SuitabilityStatus status) => switch (status) {
        // Default marker hues are the closest built-in approximation;
        // for pixel-perfect Polaroid-pin markers, swap in a custom
        // BitmapDescriptor.fromBytes() generated from an SVG asset.
        SuitabilityStatus.safe =>
          BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueCyan),
        SuitabilityStatus.moderate =>
          BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
        SuitabilityStatus.unsafe =>
          BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
      };

  @override
  Widget build(BuildContext context) {
    final markers = widget.beaches.map((beach) {
      final result = beach.suitability;
      return Marker(
        markerId: MarkerId(beach.id),
        position: LatLng(beach.latitude, beach.longitude),
        icon: _hueForStatus(result.status),
        infoWindow: InfoWindow(
          title: beach.name,
          snippet: '${result.statusLabel} · ${result.score.toStringAsFixed(0)}/100',
        ),
        onTap: () => widget.onMarkerTap?.call(beach),
      );
    }).toSet();

    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: widget.center,
              zoom: 11,
            ),
            markers: markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            onMapCreated: (controller) {
              _controller = controller;
              if (_mapStyle != null) controller.setMapStyle(_mapStyle);
            },
          ),
          // Subtle grain/vignette overlay for the nostalgic Polaroid feel —
          // implemented as a radial gradient rather than a texture asset
          // so it works without shipping an extra PNG.
          IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 1.1,
                  colors: [
                    Colors.transparent,
                    Colors.brown.withValues(alpha: 0.10),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Kept for reference: if you need to rasterize a custom SVG pin into a
// BitmapDescriptor (for true Polaroid-shaped map pins), decode it via
// dart:ui here — omitted from the default build to avoid an unused
// import warning until you wire in real pin art.
Future<BitmapDescriptor> bitmapFromAsset(String assetPath, int width) async {
  final data = await rootBundle.load(assetPath);
  final codec = await ui.instantiateImageCodec(
    data.buffer.asUint8List(),
    targetWidth: width,
  );
  final frame = await codec.getNextFrame();
  final bytes = await frame.image.toByteData(format: ui.ImageByteFormat.png);
  return BitmapDescriptor.bytes(bytes!.buffer.asUint8List());
}
