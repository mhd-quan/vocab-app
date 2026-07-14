# Vocab visual identity — 0.18

## Design thesis

Vocab is a desktop study workspace, not a gamified web dashboard. Its identity comes from the
rhythm of reading, practising, and reviewing: clear context, one next action, useful feedback, and
enough information to make progress visible without turning learning into a wall of metrics.

The signature is the **learning trace**: a thin, continuous mark that represents position and
progress. It appears as the selected-navigation rail, curriculum progress, session progress, chart
series, and focus state. It is never a decorative gradient or glow.

## Aesthetic direction

**Quiet editorial utility.** The product combines a precise desktop workspace with the warmth of a
well-kept study folio. It should feel authored, not themed: calm neutral planes, compact controls,
strong typography, a sparse iris trace, and motion that only explains change.

The deliberate visual risk is asymmetry. Important study objects may use a narrow trace margin on
the leading edge instead of centring every element inside another card. This gives the product a
recognisable silhouette while preserving clarity and density.

## Identity palette

The core identity uses six named colours. Semantic red remains available for destructive and error
states, but it is not a brand colour.

| Name | Light | Purpose |
| --- | --- | --- |
| Ground | `#F3F3F0` | Window canvas and quiet negative space |
| Paper | `#FCFCFA` | Reading and object surfaces |
| Graphite | `#222220` | Primary ink |
| Iris | `#6258D9` | Learning trace, selection, primary action, keyboard focus |
| Moss | `#2F8B62` | Correct, healthy, completed |
| Ochre | `#B66D1D` | Due, needs attention, incomplete |

Muted labels and separators are neutral derivatives, not additional accents. Reward colours may
appear only at the moment a reward is earned or inside the trophy collection. They do not colour
ordinary navigation, metrics, or lesson taxonomy.

## Typography

- UI family: the operating-system sans stack (SF Pro on macOS, Segoe UI Variable on Windows).
- Lexical family: New York / Iowan Old Style / Palatino, reserved for headwords, definitions, and
  example language.
- Desktop baseline: 13 px; reading instructions: 14–15 px; page title: 22–24 px.
- Weights: Regular, Medium, Semibold. Bold is reserved for earned totals or a learning prompt.
- Metrics use tabular figures in the UI family. Monospace is only for shortcuts, IPA/code-like
  identifiers, and file paths.
- Sentence case throughout. No visible eyebrow labels and no marketing-style copy inside views.

## Geometry and spacing

The interface uses a 4 px base and an 8 px working rhythm.

| Role | Contract |
| --- | --- |
| Window toolbar | 52 px |
| Compact/default/prominent control | 28 / 32 / 36 px |
| Compact/default/comfortable row | 32 / 44 / 56 px |
| Window content inset | 24 px horizontal, 20 px vertical |
| Section / group / inline gap | 24 / 16 / 8 px |
| Control and row selection radius | 7 px |
| Standalone object / grouped list radius | 11 px |
| Floating sheet / popover radius | 13 px |

Rounded geometry describes containment, not decoration:

1. Controls receive the control radius.
2. Related rows share one grouped outer surface; internal rows are not individually rounded.
3. A standalone learning object receives one object radius.
4. Avatars, status dots, and true capsule controls may be circular or pill-shaped.

## Surface and depth grammar

- **Ground** is continuous and never chopped into decorative cards.
- **Paper** contains a real object: a session exercise, one chart, a grouped list, or a scoped form.
- **Material** is limited to window chrome, source sidebar, inspector, popover, and sheet.
- Persistent panes use a single physical-pixel divider. Internal content uses spacing, type, or a
  surface step before adding a separator.
- Floating surfaces use one short, soft shadow. Persistent content has no drop shadow.
- Translucency must keep text contrast in every wallpaper and dark-mode state; increased contrast
  removes blur entirely.

## Window compositions

Tutor:

```text
┌──────────────────────── unified toolbar ─────────────────────────┐
│ source list │  view title + actions                              │
│             │  cohort or object summary                          │
│             │  primary working view          │ contextual detail │
│             │  dense ledger / grouped content                    │
└───────────────────────────────────────────────────────────────────┘
```

Student home:

```text
┌──────────────────────── unified toolbar ─────────────────────────┐
│ profile + current direction                                      │
│ learning path / assigned material             │ today inspector   │
│ one grouped book surface; trace marks progress │ tools + progress  │
└───────────────────────────────────────────────────────────────────┘
```

Study session:

```text
┌──────────────────────── unified toolbar ─────────────────────────┐
│ context + continuous session trace                               │
│          ┌──────────── one exercise object ────────────┐          │
│          │ prompt → response → feedback → next action  │          │
│          └─────────────────────────────────────────────┘          │
└───────────────────────────────────────────────────────────────────┘
```

The next action belongs to the exercise object or its immediate action row. It is never fixed to a
viewport corner or left floating in unused canvas.

## Information design

- A dashboard begins with a sentence-level conclusion, then the visualization that supports it,
  then the underlying rows. It does not begin with a grid of KPI cards.
- Choose marks by task: bars compare quantities, lines show change over time, and a position map
  reveals outliers or clusters. Every chart includes a textual summary and accessible values.
- Tutor attention is computed from due load, accuracy, recency, and evidence flags. Status always
  includes text; colour never carries the meaning alone.
- Tables remain the source of precise values. Visualizations are a faster path to the same truth,
  not decoration or a replacement for inspectable data.

## Interaction and motion

- Hover changes surface or ink only; it does not lift, translate, or scale persistent UI.
- Press states tighten contrast and may use an inset edge; no simulated 3D button stack.
- Selection crossfades in place. Progress animates along the learning trace.
- Correct feedback resolves with a restrained colour/opacity change; wrong feedback may use one
  short horizontal correction. Nothing repeatedly pulses outside an active recording state.
- View changes use a 160–200 ms opacity transition. Sheets originate near the toolbar; popovers stay
  anchored to their trigger.
- `prefers-reduced-motion` removes all nonessential movement and preserves every state change.

## Component decisions

| Pattern | Use |
| --- | --- |
| Unified toolbar | Global context, Back, search/command, mode and lock actions |
| Source-list sidebar | Tutor top-level navigation only |
| Resizable split view | Persistent list/detail or content/inspector relationships |
| Inspector | Contextual summary and tools; never a second dashboard |
| Grouped list | Students, units, settings, sections, imports, and compact tool collections |
| Object surface | Exercise, chart, drop target, dictionary entry, or other true standalone object |
| Segmented control | Two to four mutually exclusive views only |
| Popover | Small anchored task or information |
| Window-scoped sheet | Short modal create/import/confirm task |
| Toast | Brief nonblocking confirmation |
| Badge | Count or terse status only; not taxonomy decoration on every row |
| Card grid | Rejected as page structure |
| Global glass | Rejected; material is structural and localized |

## Quality gate

Before a view is considered complete:

1. The title, primary object, primary action, and Back behavior are obvious without reading helper
   copy.
2. Every gap belongs to the 4/8 rhythm or has a documented optical reason.
3. Every radius can be explained by the containment role above.
4. Every border separates panes, rows, or a control affordance; no ornamental outlines remain.
5. Empty space protects focus or future content with an explicit owner; it is not an accidental hole.
6. The same state is communicated by label/icon/shape as well as colour.
7. Keyboard focus, full keyboard navigation, 200% text, dark mode, increased contrast, and reduced
   motion remain usable.
8. The view still reads as Vocab after removing the logo because the learning trace, typography,
   density, and interaction grammar remain.

## Reference rationale

- Apple HIG informs desktop hierarchy, materials, legibility, motion, and accessible chart context.
- NameThat UI supplies precise desktop pattern vocabulary so Electron equivalents are selected by
  behaviour rather than visual imitation.
- Claude, ChatGPT, Notion, and Perplexity are references for calm working surfaces, side-by-side
  context, and progressive disclosure. Their visual skins are not copied.
