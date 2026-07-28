# Image Scaler Lab

A small GitHub Pages image tool for sprite and texture work.

## Features

- Drag-and-drop image loading
- Original image preview with mouse crop selection
- Draggable crop box with handles and rule-of-thirds guides
- Rotatable crop box with angle input and rotate handle
- Square or freeform crop mode
- Reset tools button that keeps the loaded image
- Output-only processing, leaving the original untouched
- Default 16 x 16 export with editable width and height
- Optional 1:1 size lock
- Sharp pixel scaling
- Optional preview grid
- Black pixel-boundary grid, automatically shown while editing symmetry
- 3 x 3 tile preview that keeps the same preview footprint
- Compact tabbed tools sized to keep the main workspace on a 1920 x 1080 display
- Color-to-alpha picker
- Edge-connected background removal
- Palette limiting, enabled by default at 16 colors
- Edge detection
- Symmetry line mirroring with two high-resolution draggable output points
- Symmetry guide can be hidden while the symmetry effect stays active
- Sub-pixel symmetry reflection with a small blend across the line
- Luminance-based fake relighting with a draggable output light point
- Selectable seamless-tile algorithms:
  - Gentle wrapped-edge crossfade
  - Strong opposite-edge reconciliation with exact matching outer pixels
- Integrated bottom animation timeline that keeps all normal editing tools live
- Full-state keyframes captured directly from the actual editor controls
- Crop position/size/rotation, output size, symmetry points, lighting, colors, alpha, cleanup, palette, edge, seamless, and toggle states are animatable
- Optional Auto-key for capturing edits immediately on the current frame
- Smooth, linear, or held keyframe interpolation
- Smooth RGB color blending and shortest-path angle interpolation
- Loop and boomerang playback
- PNG sprite-sheet export using the selected playback sequence, including variable output sizes
- Vertical sprite sheets by default, with optional horizontal and packed-grid layouts
- PNG download

Numeric fields can be dragged up and down to tune values quickly.
