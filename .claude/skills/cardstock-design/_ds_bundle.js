/* @ds-bundle: {"format":4,"namespace":"CardstockDesignSystem_acd70a","components":[{"name":"BoardCard","sourcePath":"components/board/BoardCard.jsx"},{"name":"CalendarSlip","sourcePath":"components/board/CalendarSlip.jsx"},{"name":"EpicTome","sourcePath":"components/board/EpicTome.jsx"},{"name":"Binder","sourcePath":"components/filing/Binder.jsx"},{"name":"Folder","sourcePath":"components/filing/Folder.jsx"},{"name":"LaneMap","sourcePath":"components/filing/LaneMap.jsx"},{"name":"Letterhead","sourcePath":"components/filing/Letterhead.jsx"},{"name":"Portrait","sourcePath":"components/filing/Letterhead.jsx"},{"name":"PaperTooltip","sourcePath":"components/filing/PaperTooltip.jsx"},{"name":"CARD_COLORS","sourcePath":"components/forms/ColorPicker.jsx"},{"name":"ColorPicker","sourcePath":"components/forms/ColorPicker.jsx"},{"name":"PaperButton","sourcePath":"components/forms/PaperButton.jsx"},{"name":"BinderTool","sourcePath":"components/forms/PaperButton.jsx"},{"name":"PaperField","sourcePath":"components/forms/PaperField.jsx"},{"name":"Fieldset","sourcePath":"components/forms/PaperField.jsx"},{"name":"FieldLabel","sourcePath":"components/forms/PaperField.jsx"},{"name":"PaperLink","sourcePath":"components/forms/PaperLink.jsx"},{"name":"LUCIDE_NODES","sourcePath":"components/icon/Icon.jsx"},{"name":"Icon","sourcePath":"components/icon/Icon.jsx"},{"name":"EpicLabel","sourcePath":"components/marks/EpicLabel.jsx"},{"name":"Eyebrow","sourcePath":"components/marks/Eyebrow.jsx"},{"name":"Mark","sourcePath":"components/marks/Mark.jsx"},{"name":"MARK_HUES","sourcePath":"components/marks/Mark.jsx"},{"name":"Sq","sourcePath":"components/marks/Sq.jsx"},{"name":"PRIORITY_PEN","sourcePath":"components/marks/Sq.jsx"},{"name":"EFFORT_PEN","sourcePath":"components/marks/Sq.jsx"},{"name":"Stamp","sourcePath":"components/marks/Stamp.jsx"},{"name":"Stat","sourcePath":"components/marks/Stat.jsx"},{"name":"STATUS_TONE","sourcePath":"components/marks/Stat.jsx"},{"name":"LANE_INK","sourcePath":"components/stock/LaneHead.jsx"},{"name":"LaneHead","sourcePath":"components/stock/LaneHead.jsx"},{"name":"PaperCard","sourcePath":"components/stock/PaperCard.jsx"},{"name":"PaperLane","sourcePath":"components/stock/PaperLane.jsx"},{"name":"PaperTopbar","sourcePath":"components/stock/PaperTopbar.jsx"},{"name":"PaperWell","sourcePath":"components/stock/PaperWell.jsx"}],"sourceHashes":{"components/board/BoardCard.jsx":"ae0623ba37d2","components/board/CalendarSlip.jsx":"a2707bcdbdb0","components/board/EpicTome.jsx":"4bafb765fa8d","components/filing/Binder.jsx":"f0a4efb4cf01","components/filing/Folder.jsx":"353fb9cd57eb","components/filing/LaneMap.jsx":"7c7984743baa","components/filing/Letterhead.jsx":"098981cf3522","components/filing/PaperTooltip.jsx":"291f10d88576","components/forms/ColorPicker.jsx":"c84b0851b20c","components/forms/PaperButton.jsx":"0f39e865ec44","components/forms/PaperField.jsx":"ca2db14a9683","components/forms/PaperLink.jsx":"13c60db8d6d0","components/icon/Icon.jsx":"42cc13b9ee56","components/marks/EpicLabel.jsx":"c146c0c1ec7d","components/marks/Eyebrow.jsx":"08288077c860","components/marks/Mark.jsx":"c0b7e599cb28","components/marks/Sq.jsx":"b90d6e23de25","components/marks/Stamp.jsx":"2d3ee9e54e6a","components/marks/Stat.jsx":"4bd1a6821068","components/stock/LaneHead.jsx":"f9b88e643551","components/stock/PaperCard.jsx":"83b20a9dcfad","components/stock/PaperLane.jsx":"d764a4cd4c0f","components/stock/PaperTopbar.jsx":"891bcfd43800","components/stock/PaperWell.jsx":"d92a40724934","ui_kits/app/BoardScreen.jsx":"d60d4df30b7c","ui_kits/app/CardFace.jsx":"2deb30b8d334","ui_kits/app/CockpitScreen.jsx":"468892ebed2e","ui_kits/app/LoginScreen.jsx":"a5f195e69a0b","ui_kits/app/ProjectScreen.jsx":"16a12268f8c2","ui_kits/app/ProjectsScreen.jsx":"84a4b6eb1ec6","ui_kits/app/Shell.jsx":"bd95e588acb5","ui_kits/app/TimelineScreen.jsx":"f329b0b2f7a9","ui_kits/app/data.js":"06dc305ab69d"},"inlinedExternals":[],"unexposedExports":[{"name":"markHue","sourcePath":"components/marks/Mark.jsx"}]} */

(() => {

const __ds_ns = (window.CardstockDesignSystem_acd70a = window.CardstockDesignSystem_acd70a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/board/CalendarSlip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A card with a target date, drawn as a post-it. On a day sheet it is a
 * `stub` — a tilted square of canary stock carrying nothing but the id. In
 * the unscheduled tray it is `full`: id, title, board.
 */
function CalendarSlip({
  id,
  title,
  board,
  shape = "full",
  tint = null,
  tilt = 0,
  lift = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("article", _extends({}, rest, {
    style: shape === "stub" ? {
      "--slip-tilt": `${tilt}deg`,
      ...rest.style
    } : rest.style,
    className: `paper-card paper-card--static calendar-slip ${shape === "stub" ? "calendar-slip--stub" : ""} ${lift ? "calendar-slip--lift" : ""} ${tint ? `card-color--${tint}` : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), shape === "stub" ? /*#__PURE__*/React.createElement("span", {
    className: "calendar-slip-id"
  }, "#", id) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: "0.28rem",
      alignItems: "baseline",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "calendar-slip-id"
  }, "#", id), /*#__PURE__*/React.createElement("p", {
    className: "calendar-slip-title"
  }, title)), board && /*#__PURE__*/React.createElement("p", {
    className: "calendar-slip-board"
  }, board)));
}
Object.assign(__ds_scope, { CalendarSlip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/CalendarSlip.jsx", error: String((e && e.message) || e) }); }

// components/board/EpicTome.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * An epic drawn as a closed tome on the desk: cloth spine down the left
 * taking the outlook pen, the page block peeking out past the cover at the
 * bottom right. Two shapes, one drawing — `tile` is the shelved cockpit
 * card, `slip` is the smaller one a task is dragged onto.
 */
function EpicTome({
  outlook = "planning",
  shape = "tile",
  over = false,
  className = "",
  children,
  ...rest
}) {
  const base = shape === "slip" ? "epic-tome" : "cockpit-epic";
  return /*#__PURE__*/React.createElement("article", _extends({}, rest, {
    "data-outlook": outlook,
    className: `${base} ${shape === "tile" ? `cockpit-epic--${outlook}` : ""} ${over ? "epic-tome--over" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { EpicTome });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/EpicTome.jsx", error: String((e && e.message) || e) }); }

// components/filing/Binder.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A board drawn as a binder: a riveted spine of the folder's own stock, the
 * board's name on the cover, its card count, and the keys on the foot. The
 * cover link fills the binder, so the tools sit above it on their own layer.
 */
function Binder({
  name,
  href,
  count,
  wide = false,
  tools,
  links,
  stacked = false,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("li", _extends({}, rest, {
    className: `binder ${wide ? "binder--wide" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "binder-name"
  }, href ? /*#__PURE__*/React.createElement("a", {
    href: href,
    className: "binder-open"
  }, name) : name), count != null && /*#__PURE__*/React.createElement("p", {
    className: "binder-count"
  }, count), children, (tools || links) && /*#__PURE__*/React.createElement("div", {
    className: `binder-foot ${tools ? "binder-foot--tools" : ""} ${stacked ? "binder-foot--stacked" : ""}`.replace(/\s+/g, " ").trim()
  }, tools && /*#__PURE__*/React.createElement("span", {
    className: "binder-io"
  }, tools), links && /*#__PURE__*/React.createElement("span", {
    className: "binder-links"
  }, links)));
}
Object.assign(__ds_scope, { Binder });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/filing/Binder.jsx", error: String((e && e.message) || e) }); }

// components/filing/Folder.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A project drawn as a dossier: manila stock, a single tab carrying the
 * project's name, and the way in. Pointing at the tab lifts the whole folder.
 * `section` is the quieter chapter variant used down a project page — same
 * manila, a Plex tab, and no lift.
 */
function Folder({
  name,
  href,
  count,
  section = false,
  empty = false,
  aside,
  as: Tag = "li",
  className = "",
  children,
  ...rest
}) {
  const Tab = section ? "span" : href ? "a" : "span";
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `folder ${section ? "folder--section" : ""} ${empty ? "folder--empty" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), /*#__PURE__*/React.createElement(Tab, {
    className: "folder-tab",
    href: section ? undefined : href
  }, section ? /*#__PURE__*/React.createElement("h2", null, name) : /*#__PURE__*/React.createElement("span", null, name), count != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab-dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "folder-count"
  }, count))), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, children, aside && /*#__PURE__*/React.createElement("div", {
    className: "folder-aside"
  }, aside)));
}
Object.assign(__ds_scope, { Folder });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/filing/Folder.jsx", error: String((e && e.message) || e) }); }

// components/filing/LaneMap.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Lane microcosm: a whole board in one row. Columns shrink together rather
 * than scrolling, drawer vs panel stock is the only cue for a lane's kind,
 * and untinted slips take the cockpit pens. A card's own tint always wins.
 */
function LaneMap({
  lanes = [],
  marked = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    className: `lane-map ${marked ? "lane-map--marked" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), lanes.map(lane => /*#__PURE__*/React.createElement("div", {
    key: lane.name,
    className: "lane-map-col",
    "data-kind": lane.kind || "work"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lane-map-pack"
  }, (lane.cells || []).map((cell, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `lane-map-cell ${cell.signal ? `lane-map-cell--${cell.signal}` : ""} ${cell.tint ? `card-color--${cell.tint}` : ""}`.replace(/\s+/g, " ").trim()
  }, marked ? cell.glyph : null)), lane.more ? /*#__PURE__*/React.createElement("span", {
    className: "lane-map-cell lane-map-cell--more"
  }, "+", lane.more) : null), /*#__PURE__*/React.createElement("span", {
    className: "lane-map-tip"
  }, lane.name))));
}
Object.assign(__ds_scope, { LaneMap });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/filing/LaneMap.jsx", error: String((e && e.message) || e) }); }

// components/filing/Letterhead.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The letterhead a project or board page opens with: an eyebrow, the title in
 * Newsreader, the blurb, the view links, and a stamp in the margin.
 */
function Letterhead({
  eyebrow,
  title,
  blurb,
  links,
  aside,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({}, rest, {
    className: `letterhead ${className}`.trim()
  }), /*#__PURE__*/React.createElement("div", null, eyebrow && /*#__PURE__*/React.createElement("p", {
    className: "eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("h1", null, title), blurb && /*#__PURE__*/React.createElement("p", {
    className: "cta-body"
  }, blurb), links && /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.9rem",
      marginTop: "0.6rem",
      fontSize: "var(--text-sm)"
    }
  }, links), children), aside && /*#__PURE__*/React.createElement("div", {
    className: "letterhead-aside"
  }, aside));
}

/** A square portrait — filed, not rounded. Never a circle. */
function Portrait({
  src,
  alt = "",
  size = "md",
  className = "",
  ...rest
}) {
  const mod = {
    sm: "portrait--sm",
    md: "",
    topbar: "portrait--topbar",
    lg: "portrait--lg"
  }[size];
  return /*#__PURE__*/React.createElement("img", _extends({}, rest, {
    src: src,
    alt: alt,
    className: `portrait ${mod || ""} ${className}`.replace(/\s+/g, " ").trim()
  }));
}
Object.assign(__ds_scope, { Letterhead, Portrait });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/filing/Letterhead.jsx", error: String((e && e.message) || e) }); }

// components/filing/PaperTooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A margin note clipped to the sheet, not an inverted OS tooltip: a small
 * sheet of stock a fraction off level, a paperclip at the top, and a red
 * pen rule down the inner margin of the note itself.
 */
function PaperTooltip({
  lead,
  meta,
  hint,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    className: `paper-tooltip ${className}`.trim(),
    role: "tooltip"
  }), /*#__PURE__*/React.createElement("svg", {
    className: "paper-tooltip__clip",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 8.5 11 18.5a4.95 4.95 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.67 4.67l-8.5 8.5a1.65 1.65 0 0 1-2.33-2.33L13 7"
  })), /*#__PURE__*/React.createElement("div", {
    className: "paper-tooltip__sheet"
  }, /*#__PURE__*/React.createElement("div", {
    className: "paper-tooltip__stack"
  }, lead && /*#__PURE__*/React.createElement("p", {
    className: "paper-tooltip__lead"
  }, lead), meta && /*#__PURE__*/React.createElement("p", {
    className: "paper-tooltip__meta"
  }, meta), hint && /*#__PURE__*/React.createElement("p", {
    className: "paper-tooltip__hint"
  }, hint), children)));
}
Object.assign(__ds_scope, { PaperTooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/filing/PaperTooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/ColorPicker.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CARD_COLORS = ["rose", "orange", "amber", "green", "cyan", "blue", "indigo", "violet", "pink"];
const LABEL = {
  rose: "Rose",
  orange: "Orange",
  amber: "Amber",
  green: "Green",
  cyan: "Cyan",
  blue: "Blue",
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink"
};

/**
 * The nine card tints plus a struck-through "no tint" choice. Swatches are
 * the one round thing in the product: they are ink wells, not paper.
 */
function ColorPicker({
  value = null,
  onChange,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("fieldset", _extends({}, rest, {
    className: `card-color-picker ${className}`.trim()
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "No tint",
    "aria-pressed": value === null,
    className: "card-color-choice card-color-choice--none",
    onClick: () => onChange?.(null)
  }), CARD_COLORS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    type: "button",
    "aria-label": LABEL[c],
    "aria-pressed": value === c,
    className: "card-color-choice",
    style: {
      background: `var(--surface-card-${c})`
    },
    onClick: () => onChange?.(c)
  })));
}
Object.assign(__ds_scope, { CARD_COLORS, ColorPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ColorPicker.jsx", error: String((e && e.message) || e) }); }

// components/forms/PaperButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANT = {
  ink: "",
  outline: "paper-btn--outline",
  ghost: "paper-btn--ghost",
  danger: "paper-btn--danger"
};

/**
 * The primary action is ink, not a colour — pen blue is for links and P2
 * only. A press is a 1px settle; nothing bounces and nothing shrinks.
 */
function PaperButton({
  variant = "ink",
  size = "md",
  as: Tag = "button",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    type: Tag === "button" ? rest.type ?? "button" : rest.type,
    className: `paper-btn ${VARIANT[variant] || ""} ${size === "sm" ? "paper-btn--sm" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}

/**
 * An ink-filled key, 28 square, the glyph cut out of it in stock — the tool
 * row on a binder's foot. `pen` writes it in red and lets it carry a word.
 */
function BinderTool({
  pen = false,
  as: Tag = "button",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    type: Tag === "button" ? rest.type ?? "button" : rest.type,
    className: `binder-tool ${pen ? "binder-tool--pen" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { PaperButton, BinderTool });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PaperButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/PaperField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A field on a printed form: white stock, a 1px ruled edge, 2px corners.
 * Renders `input` by default; `as="select"` and `as="textarea"` share it.
 */
function PaperField({
  as: Tag = "input",
  mono = false,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `paper-field ${className}`.trim(),
    style: mono ? {
      fontFamily: "var(--font-mono)",
      ...rest.style
    } : rest.style
  }), children);
}

/**
 * A cluster of controls as a fieldset on a printed form. The legend notches
 * the rule, so a row of abbreviations (P1 P2 P3) always says what it asks.
 */
function Fieldset({
  legend,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("fieldset", _extends({}, rest, {
    className: `fieldset ${className}`.trim()
  }), /*#__PURE__*/React.createElement("legend", null, legend), children);
}

/** The uppercase label in the card form's margin gutter. */
function FieldLabel({
  as: Tag = "span",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `field-label ${className}`.trim()
  }), children);
}
Object.assign(__ds_scope, { PaperField, Fieldset, FieldLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PaperField.jsx", error: String((e && e.message) || e) }); }

// components/forms/PaperLink.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A link in pen blue, underlined only when pointed at. `danger` is the red
 * pen — the same colour the delete ask and the stamp are written in.
 */
function PaperLink({
  danger = false,
  as: Tag = "a",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `paper-link ${danger ? "paper-link--danger" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { PaperLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PaperLink.jsx", error: String((e && e.message) || e) }); }

// components/icon/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/*
 * The icon set, lifted verbatim from lucide-react v1.34.0 (ISC) — the exact
 * package cardstock imports from, at the exact version in its lockfile. Every
 * glyph the app uses is here and nothing else; the geometry is lucide's own,
 * not a redrawing. Rendered inline rather than fetched, so an icon never
 * flashes, never needs a network, and always inherits the ink beside it.
 *
 * The same glyphs are on disk as `assets/icons/<name>.svg` for consumers that
 * would rather reference files.
 */
const LUCIDE_NODES = {
  "arrow-left": [["path", {
    d: "m12 19-7-7 7-7"
  }], ["path", {
    d: "M19 12H5"
  }]],
  "arrow-right": [["path", {
    d: "M5 12h14"
  }], ["path", {
    d: "m12 5 7 7-7 7"
  }]],
  book: [["path", {
    d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
  }]],
  "calendar-clock": [["path", {
    d: "M16 14v2.2l1.6 1"
  }], ["path", {
    d: "M16 2v3"
  }], ["path", {
    d: "M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338"
  }], ["path", {
    d: "M3 9h5.859"
  }], ["path", {
    d: "M8 2v3"
  }], ["circle", {
    cx: "16",
    cy: "16",
    r: "6"
  }]],
  check: [["path", {
    d: "M20 6 9 17l-5-5"
  }]],
  "chevron-down": [["path", {
    d: "m6 9 6 6 6-6"
  }]],
  "chevron-left": [["path", {
    d: "m15 18-6-6 6-6"
  }]],
  "chevron-right": [["path", {
    d: "m9 18 6-6-6-6"
  }]],
  "chevron-up": [["path", {
    d: "m18 15-6-6-6 6"
  }]],
  "columns-3": [["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }], ["path", {
    d: "M9 3v18"
  }], ["path", {
    d: "M15 3v18"
  }]],
  download: [["path", {
    d: "M12 15V3"
  }], ["path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }], ["path", {
    d: "m7 10 5 5 5-5"
  }]],
  ellipsis: [["circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }], ["circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }], ["circle", {
    cx: "5",
    cy: "12",
    r: "1"
  }]],
  flag: [["path", {
    d: "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"
  }]],
  gauge: [["path", {
    d: "m12 14 4-4"
  }], ["path", {
    d: "M3.34 19a10 10 0 1 1 17.32 0"
  }]],
  "grip-vertical": [["circle", {
    cx: "9",
    cy: "12",
    r: "1"
  }], ["circle", {
    cx: "9",
    cy: "5",
    r: "1"
  }], ["circle", {
    cx: "9",
    cy: "19",
    r: "1"
  }], ["circle", {
    cx: "15",
    cy: "12",
    r: "1"
  }], ["circle", {
    cx: "15",
    cy: "5",
    r: "1"
  }], ["circle", {
    cx: "15",
    cy: "19",
    r: "1"
  }]],
  inbox: [["polyline", {
    points: "22 12 16 12 14 15 10 15 8 12 2 12"
  }], ["path", {
    d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
  }]],
  "maximize-2": [["path", {
    d: "M15 3h6v6"
  }], ["path", {
    d: "m21 3-7 7"
  }], ["path", {
    d: "m3 21 7-7"
  }], ["path", {
    d: "M9 21H3v-6"
  }]],
  minus: [["path", {
    d: "M5 12h14"
  }]],
  moon: [["path", {
    d: "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
  }]],
  paperclip: [["path", {
    d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"
  }]],
  palette: [["path", {
    d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"
  }], ["circle", {
    cx: "13.5",
    cy: "6.5",
    r: ".5",
    fill: "currentColor"
  }], ["circle", {
    cx: "17.5",
    cy: "10.5",
    r: ".5",
    fill: "currentColor"
  }], ["circle", {
    cx: "6.5",
    cy: "12.5",
    r: ".5",
    fill: "currentColor"
  }], ["circle", {
    cx: "8.5",
    cy: "7.5",
    r: ".5",
    fill: "currentColor"
  }]],
  pencil: [["path", {
    d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
  }], ["path", {
    d: "m15 5 4 4"
  }]],
  pin: [["path", {
    d: "M12 17v5"
  }], ["path", {
    d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
  }]],
  "pin-off": [["path", {
    d: "M12 17v5"
  }], ["path", {
    d: "M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"
  }], ["path", {
    d: "m2 2 20 20"
  }], ["path", {
    d: "M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"
  }]],
  plus: [["path", {
    d: "M5 12h14"
  }], ["path", {
    d: "M12 5v14"
  }]],
  rocket: [["path", {
    d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
  }], ["path", {
    d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
  }], ["path", {
    d: "M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
  }], ["path", {
    d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"
  }]],
  settings: [["path", {
    d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
  }], ["circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }]],
  sun: [["circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }], ["path", {
    d: "M12 2v2"
  }], ["path", {
    d: "M12 20v2"
  }], ["path", {
    d: "m4.93 4.93 1.41 1.41"
  }], ["path", {
    d: "m17.66 17.66 1.41 1.41"
  }], ["path", {
    d: "M2 12h2"
  }], ["path", {
    d: "M20 12h2"
  }], ["path", {
    d: "m6.34 17.66-1.41 1.41"
  }], ["path", {
    d: "m19.07 4.93-1.41 1.41"
  }]],
  "trash-2": [["path", {
    d: "M10 11v6"
  }], ["path", {
    d: "M14 11v6"
  }], ["path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
  }], ["path", {
    d: "M3 6h18"
  }], ["path", {
    d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  }]],
  upload: [["path", {
    d: "M12 3v12"
  }], ["path", {
    d: "m17 8-5-5-5 5"
  }], ["path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }]],
  x: [["path", {
    d: "M18 6 6 18"
  }], ["path", {
    d: "m6 6 12 12"
  }]]
};

/** `more-horizontal` is lucide's own deprecated alias for `ellipsis`. */
const ALIAS = {
  "more-horizontal": "ellipsis"
};

/**
 * A Lucide glyph — the same set, version and 2px stroke cardstock imports
 * from `lucide-react`. It inherits its ink from the text beside it, which is
 * how every icon in the product is coloured.
 */
function Icon({
  name,
  size = 14,
  className = "",
  style,
  ...rest
}) {
  const nodes = LUCIDE_NODES[ALIAS[name] || name];
  if (!nodes) return null;
  return /*#__PURE__*/React.createElement("svg", _extends({}, rest, {
    "aria-hidden": "true",
    className: className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: "none",
      display: "inline-block",
      verticalAlign: "middle",
      ...style
    }
  }), nodes.map(([tag, attrs], i) => React.createElement(tag, {
    key: i,
    ...attrs
  })));
}
Object.assign(__ds_scope, { LUCIDE_NODES, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icon/Icon.jsx", error: String((e && e.message) || e) }); }

// components/marks/EpicLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * An epic name with the book icon, so the same story reads the same way on
 * the board, the timeline and the filter bar.
 */
function EpicLabel({
  name,
  compact = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    className: `epic-label ${compact ? "epic-label--compact" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "book",
    size: 13,
    className: "epic-label__icon"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, name));
}
Object.assign(__ds_scope, { EpicLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/EpicLabel.jsx", error: String((e && e.message) || e) }); }

// components/marks/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A mono-caps kicker above a title — the quietest label in the system. */
function Eyebrow({
  as: Tag = "p",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `eyebrow ${className}`.trim()
  }), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/marks/Mark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A highlighter swipe — the reader's own hand. Used for tags and nothing
 * else. Hue belongs to the tag *group*, so the same word is the same colour
 * in the filter bar, on the card, and on the card page.
 */
function Mark({
  hue = 2,
  off = false,
  as: Tag = "span",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `mark mark--${hue} ${off ? "mark--off" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}

/**
 * Highlighter hue for the nth tag group, in board order: amber, blue, green,
 * violet, red. Red comes last so a red mark stays rare enough to mean
 * something.
 */
const MARK_HUES = [2, 4, 3, 5, 1];

/** The mark hue for the nth tag group. */
function markHue(groupIndex) {
  return MARK_HUES[groupIndex % MARK_HUES.length];
}
Object.assign(__ds_scope, { Mark, MARK_HUES, markHue });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Mark.jsx", error: String((e && e.message) || e) }); }

// components/marks/Sq.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A decision the app recorded, written as a filled square: priority P1-P3,
 * effort L/M/H. Unset, it is an empty square with a hairline edge.
 */
function Sq({
  pen = "blue",
  on = false,
  as: Tag = "span",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `sq ${on ? `sq--on sq--${pen}` : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}

/** P1 red, P2 blue, P3 violet. */
const PRIORITY_PEN = {
  1: "red",
  2: "blue",
  3: "violet"
};
/** Effort L green, M amber, H red. */
const EFFORT_PEN = {
  L: "green",
  M: "amber",
  H: "red"
};
Object.assign(__ds_scope, { Sq, PRIORITY_PEN, EFFORT_PEN });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Sq.jsx", error: String((e && e.message) || e) }); }

// components/marks/Stamp.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A rubber stamp in the margin, in pen red and off level. The one tilted
 * thing on a page besides a dragged card — so a page gets at most one.
 */
function Stamp({
  faint = false,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({}, rest, {
    "aria-hidden": "true",
    className: `folder-stamp ${faint ? "folder-stamp--faint" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { Stamp });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Stamp.jsx", error: String((e && e.message) || e) }); }

// components/marks/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The pen, written in the margin: six pixels of colour and a word in mono
 * caps. A status, never a filled pill.
 */
function Stat({
  tone = "muted",
  flat = false,
  as: Tag = "span",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `stat stat--${tone} ${flat ? "stat--flat" : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}

/** Tracker status word to its pen — the same mapping as statusChipClass(). */
const STATUS_TONE = {
  backlog: "muted",
  blocked: "blocked",
  wip: "wip",
  held: "muted",
  built: "info",
  handed: "info",
  shipped: "success",
  done: "success"
};
Object.assign(__ds_scope, { Stat, STATUS_TONE });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marks/Stat.jsx", error: String((e && e.message) || e) }); }

// components/stock/LaneHead.jsx
try { (() => {
const RULE = {
  inbox: "lane-head--soft",
  work: "",
  waiting: "lane-head--waiting",
  built: "lane-head--soft",
  done: "lane-head--soft",
  archive: "lane-head--soft"
};

/** Lane-name ink by kind — the same mapping as KIND_INK in lane-column.tsx. */
const LANE_INK = {
  inbox: "var(--color-grey)",
  work: "var(--color-ink)",
  waiting: "var(--pen-amber)",
  built: "var(--pen-blue)",
  done: "var(--pen-green)",
  archive: "var(--color-grey)"
};

/**
 * The divider tab at the top of a lane. The rule under the name says what
 * kind of lane it is: ink for work, a hairline for the quiet ones, the amber
 * pen for anything waiting.
 */
function LaneHead({
  name,
  kind = "work",
  count,
  sla,
  tools,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `lane-head ${RULE[kind] || ""} ${className}`.trim()
  }, /*#__PURE__*/React.createElement("h2", {
    className: "lane-name",
    style: {
      color: LANE_INK[kind]
    }
  }, name), count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      color: "var(--color-grey-faint)"
    }
  }, count), sla != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-stat)",
      color: "var(--color-grey)"
    }
  }, "SLA ", sla, "d"), tools && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: "0.125rem"
    }
  }, tools));
}
Object.assign(__ds_scope, { LANE_INK, LaneHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stock/LaneHead.jsx", error: String((e && e.message) || e) }); }

// components/stock/PaperCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANT = {
  resting: "",
  flat: "paper-card--flat",
  static: "paper-card--static",
  still: "paper-card--still",
  overlay: "paper-card--overlay"
};

/**
 * A sheet of stock. The resting variant lifts towards the pointer; the others
 * opt out for the reasons the design system gives them.
 */
function PaperCard({
  variant = "resting",
  tint = null,
  pinned = false,
  signal = null,
  as: Tag = "div",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    "data-pinned": pinned ? "true" : undefined,
    "data-timeline-signal": signal || undefined,
    className: `paper-card ${VARIANT[variant] || ""} ${tint ? `card-color--${tint}` : ""} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { PaperCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stock/PaperCard.jsx", error: String((e && e.message) || e) }); }

// components/board/BoardCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STATUS_TONE = {
  wip: "wip",
  built: "info",
  handed: "info",
  held: "muted",
  blocked: "blocked",
  shipped: "success",
  done: "success",
  backlog: "muted"
};
const PRIORITY_PEN = {
  1: "red",
  2: "blue",
  3: "violet"
};
const EFFORT_PEN = {
  L: "green",
  M: "amber",
  H: "red"
};

/**
 * The board card. Resting chrome is `#id`, the title, the epic, the status
 * word and the decisions already made; the rest — tags, dates, the note —
 * is the back of the card and opens on hover after the dwell, while the
 * resting summary steps aside on the same clock.
 */
function BoardCard({
  id,
  title,
  epic,
  status = "backlog",
  raised,
  signal = null,
  priority = null,
  effort = null,
  tags = [],
  note,
  needs,
  days,
  overSla = false,
  tint = null,
  variant = "resting",
  pinned = false,
  rail = true,
  className = "",
  ...rest
}) {
  const chips = (priority || effort) && /*#__PURE__*/React.createElement("span", {
    className: "card-meta-chips",
    style: {
      display: "flex",
      flexShrink: 0,
      gap: "0.25rem"
    }
  }, priority && /*#__PURE__*/React.createElement(__ds_scope.Sq, {
    on: true,
    pen: PRIORITY_PEN[priority],
    title: `Priority ${priority}`
  }, "P", priority), effort && /*#__PURE__*/React.createElement(__ds_scope.Sq, {
    on: true,
    pen: EFFORT_PEN[effort],
    title: "Effort"
  }, effort));
  return /*#__PURE__*/React.createElement(__ds_scope.PaperCard, _extends({}, rest, {
    as: "article",
    variant: variant,
    tint: tint,
    pinned: pinned,
    signal: signal,
    className: `${className}`.trim(),
    style: {
      padding: "0.625rem",
      position: "relative",
      ...rest.style
    }
  }), rail && variant !== "overlay" && /*#__PURE__*/React.createElement("div", {
    className: "card-rail"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Pin card",
    "data-on": pinned ? "true" : undefined
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "pin",
    size: 13
  })), /*#__PURE__*/React.createElement("a", {
    href: "#",
    "aria-label": "Open in place"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "maximize-2",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "card-color-trigger",
    "aria-label": "Card colour"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "palette",
    size: 13
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "0.5rem",
      paddingRight: "1.5rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-id)",
      color: "var(--color-grey-faint)"
    }
  }, "#", id), /*#__PURE__*/React.createElement("p", {
    style: {
      minWidth: 0,
      fontSize: "var(--text-title)",
      fontWeight: 500,
      lineHeight: 1.3
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "card-meta",
    style: {
      marginTop: "0.25rem",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "0.25rem 0.5rem"
    }
  }, epic && /*#__PURE__*/React.createElement(__ds_scope.EpicLabel, {
    name: epic
  }), status !== "backlog" && /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    tone: STATUS_TONE[status] || "muted"
  }, status), signal === "forgotten" && /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    tone: "blocked"
  }, "forgotten"), signal === "overdue" && /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    tone: "blocked"
  }, "overdue")), (raised || chips) && /*#__PURE__*/React.createElement("div", {
    className: "card-rest"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-rest-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-meta",
    style: {
      marginTop: "0.25rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem"
    }
  }, raised && /*#__PURE__*/React.createElement("span", {
    className: "card-age",
    "data-signal": signal || "active"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "calendar-clock",
    size: 13,
    className: "card-age__icon"
  }), /*#__PURE__*/React.createElement("span", {
    className: "card-age-date"
  }, raised)), chips))), /*#__PURE__*/React.createElement("div", {
    className: "card-peek"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-peek-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-peek-actions card-meta",
    style: {
      marginTop: "0.375rem",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "0.25rem 0.5rem"
    }
  }, days != null && /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    tone: overSla ? "blocked" : "muted"
  }, days, "d"), needs && /*#__PURE__*/React.createElement(__ds_scope.Stat, {
    tone: "attention"
  }, "waiting \xB7 ", needs)), /*#__PURE__*/React.createElement("section", {
    className: "card-form",
    style: {
      marginTop: "0.625rem",
      borderTop: "1px solid var(--border-hairline)",
      paddingTop: "0.625rem"
    },
    "aria-label": "Card fields"
  }, note && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Note"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: "var(--text-base)",
      lineHeight: 1.3,
      color: "var(--color-ink2)"
    }
  }, note)), tags.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Tags"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.25rem 0.375rem"
    }
  }, tags.map(t => /*#__PURE__*/React.createElement(__ds_scope.Mark, {
    key: t.name,
    hue: t.hue
  }, t.name)))), /*#__PURE__*/React.createElement("div", {
    className: "card-ratings"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Effort"), /*#__PURE__*/React.createElement("span", {
    className: "card-ratings-sqs"
  }, ["L", "M", "H"].map(e => /*#__PURE__*/React.createElement(__ds_scope.Sq, {
    key: e,
    on: effort === e,
    pen: EFFORT_PEN[e]
  }, e))), /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Priority"), /*#__PURE__*/React.createElement("span", {
    className: "card-ratings-sqs"
  }, [1, 2, 3].map(p => /*#__PURE__*/React.createElement(__ds_scope.Sq, {
    key: p,
    on: priority === p,
    pen: PRIORITY_PEN[p]
  }, "P", p))))))));
}
Object.assign(__ds_scope, { BoardCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/board/BoardCard.jsx", error: String((e && e.message) || e) }); }

// components/stock/PaperLane.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A column of stock laid on the desk. Every lane paints its own background,
 * so an empty lane still reads as a place to put something.
 */
function PaperLane({
  kind = "work",
  tint = null,
  collapsed = false,
  over = false,
  pinned = false,
  width = "default",
  className = "",
  children,
  ...rest
}) {
  const measure = collapsed || width === "spine" ? "" : width === "max" ? "lane-column-width--max" : "lane-column-width";
  return /*#__PURE__*/React.createElement("section", _extends({}, rest, {
    "data-kind": kind,
    "data-pinned": pinned ? "true" : undefined,
    style: collapsed ? {
      width: "var(--lane-spine-width)",
      ...rest.style
    } : rest.style,
    className: `paper-lane ${collapsed ? "lane-spine" : ""} ${kind === "inbox" && !collapsed ? "paper-lane--drawer" : ""} ${over ? "paper-lane--over" : ""} ${pinned ? "paper-lane--pinned" : ""} ${tint ? `lane-color--${tint}` : ""} ${measure} ${className}`.replace(/\s+/g, " ").trim()
  }), children);
}
Object.assign(__ds_scope, { PaperLane });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stock/PaperLane.jsx", error: String((e && e.message) || e) }); }

// components/stock/PaperTopbar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The app bar: card stock with a ruled bottom edge. cardstock has no logo —
 * the wordmark is the product name set in Newsreader, lowercase.
 */
function PaperTopbar({
  brand = "cardstock",
  href = "/",
  right,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({}, rest, {
    className: `paper-topbar ${className}`.trim(),
    style: {
      display: "flex",
      height: "var(--topbar-height)",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 1rem",
      ...rest.style
    }
  }), /*#__PURE__*/React.createElement("a", {
    href: href,
    style: {
      fontFamily: "var(--font-display)",
      fontSize: "var(--text-md)",
      fontWeight: 600,
      letterSpacing: "var(--display-tracking)",
      color: "var(--color-ink-strong)",
      textDecoration: "none"
    }
  }, brand), right);
}
Object.assign(__ds_scope, { PaperTopbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stock/PaperTopbar.jsx", error: String((e && e.message) || e) }); }

// components/stock/PaperWell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Stock cut *into* the desk — a sunken tray with an inset edge. */
function PaperWell({
  as: Tag = "div",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({}, rest, {
    className: `paper-well ${className}`.trim()
  }), children);
}
Object.assign(__ds_scope, { PaperWell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/stock/PaperWell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/BoardScreen.jsx
try { (() => {
const {
  PaperLane,
  LaneHead,
  LANE_INK,
  Sq,
  Stat,
  Mark,
  Icon,
  Eyebrow
} = window.CardstockDesignSystem_acd70a;
function Caret() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2.5 4.5 6 8 9.5 4.5"
  }));
}

/**
 * The filter bar, laid out as a printed form: every cluster is a fieldset
 * with a legend, so P1-P3 and L/M/H never appear as bare abbreviations. Only
 * the search field stands alone, because a search box explains itself.
 */
function FilterBar({
  f,
  onChange,
  groups,
  openMenu,
  setOpenMenu
}) {
  const toggle = (set, v) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    return n;
  };
  const check = {
    display: "flex",
    cursor: "pointer",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: "var(--color-ink2)"
  };
  const menu = {
    position: "absolute",
    left: 0,
    top: "100%",
    zIndex: 20,
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 8px",
    maxWidth: "22rem",
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--border-strong)",
    background: "var(--surface-raised)",
    padding: 12,
    boxShadow: "var(--shadow-lift)"
  };
  const filtering = f.query || f.priority.size || f.effort.size || f.tags.size || f.status;
  return /*#__PURE__*/React.createElement("div", {
    className: "paper-topbar",
    style: {
      position: "sticky",
      top: 0,
      zIndex: 10,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "stretch",
      gap: "12px",
      borderTop: "1px solid var(--border-hairline)",
      padding: "12px 24px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "search",
    placeholder: "Search #id or title",
    className: "paper-field lane-column-width",
    style: {
      height: "auto",
      flexShrink: 0,
      fontSize: 13.5
    },
    "aria-label": "Search",
    value: f.query,
    onChange: e => onChange({
      ...f,
      query: e.target.value
    })
  }), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("legend", null, "Tags"), groups.map(g => {
    const on = g.tags.filter(t => f.tags.has(t)).length;
    const open = openMenu === g.name;
    return /*#__PURE__*/React.createElement("span", {
      key: g.name,
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setOpenMenu(open ? null : g.name),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingBottom: 2,
        fontSize: 13,
        color: on ? "var(--color-ink)" : "var(--color-ink2)",
        borderBottom: on ? `2px solid var(--mark-${g.hue})` : "2px solid transparent"
      }
    }, g.name, on ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 11
      }
    }, on) : null, /*#__PURE__*/React.createElement(Caret, null)), open && /*#__PURE__*/React.createElement("div", {
      style: menu
    }, g.tags.map(t => /*#__PURE__*/React.createElement("button", {
      key: t,
      type: "button",
      "aria-pressed": f.tags.has(t),
      className: `mark mark--${g.hue} ${f.tags.has(t) ? "" : "mark--off"}`,
      onClick: () => onChange({
        ...f,
        tags: toggle(f.tags, t)
      })
    }, t))));
  })), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset"
  }, /*#__PURE__*/React.createElement("legend", null, "Priority"), [1, 2, 3].map(p => /*#__PURE__*/React.createElement(Sq, {
    key: p,
    as: "button",
    "aria-pressed": f.priority.has(p),
    on: f.priority.has(p),
    pen: PRIORITY_PEN[p],
    title: `Priority ${p}`,
    onClick: () => onChange({
      ...f,
      priority: toggle(f.priority, p)
    })
  }, "P", p))), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset"
  }, /*#__PURE__*/React.createElement("legend", null, "Effort"), ["L", "M", "H"].map(e => /*#__PURE__*/React.createElement(Sq, {
    key: e,
    as: "button",
    "aria-pressed": f.effort.has(e),
    on: f.effort.has(e),
    pen: EFFORT_PEN[e],
    onClick: () => onChange({
      ...f,
      effort: toggle(f.effort, e)
    })
  }, e))), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("legend", null, "Status"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      paddingBottom: 2,
      fontSize: 13
    },
    onClick: () => setOpenMenu(openMenu === "status" ? null : "status")
  }, f.status ? /*#__PURE__*/React.createElement(Stat, {
    tone: STATUS_TONE[f.status]
  }, f.status) : /*#__PURE__*/React.createElement(Stat, {
    tone: "muted"
  }, "any"), /*#__PURE__*/React.createElement(Caret, null)), openMenu === "status" && /*#__PURE__*/React.createElement("div", {
    style: {
      ...menu,
      flexDirection: "column",
      minWidth: "7.5rem",
      flexWrap: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "stat stat--muted",
    style: {
      textAlign: "left"
    },
    onClick: () => {
      onChange({
        ...f,
        status: null
      });
      setOpenMenu(null);
    }
  }, "any"), ["backlog", "blocked", "wip", "held", "built", "shipped"].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    type: "button",
    className: `stat stat--${STATUS_TONE[s]}`,
    style: {
      textAlign: "left"
    },
    onClick: () => {
      onChange({
        ...f,
        status: f.status === s ? null : s
      });
      setOpenMenu(null);
    }
  }, s)))), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset",
    style: {
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("legend", null, "Also show"), /*#__PURE__*/React.createElement("label", {
    style: check
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    style: {
      accentColor: "var(--pen-blue)"
    },
    checked: f.showInternal,
    onChange: e => onChange({
      ...f,
      showInternal: e.target.checked
    })
  }), "Internal"), /*#__PURE__*/React.createElement("label", {
    style: check
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    style: {
      accentColor: "var(--pen-blue)"
    },
    checked: f.showArchived,
    onChange: e => onChange({
      ...f,
      showArchived: e.target.checked
    })
  }), "Archived")), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset"
  }, /*#__PURE__*/React.createElement("legend", null, "Unsorted order"), /*#__PURE__*/React.createElement("select", {
    className: "paper-field",
    style: {
      height: "1.75rem",
      padding: "0 6px",
      fontSize: 12.5
    },
    value: f.inboxSort,
    onChange: e => onChange({
      ...f,
      inboxSort: e.target.value
    }),
    "aria-label": "Unsorted order"
  }, /*#__PURE__*/React.createElement("option", {
    value: "newest"
  }, "Newest first"), /*#__PURE__*/React.createElement("option", {
    value: "oldest"
  }, "Oldest first"), /*#__PURE__*/React.createElement("option", {
    value: "id-asc"
  }, "# ascending"), /*#__PURE__*/React.createElement("option", {
    value: "id-desc"
  }, "# descending"))), filtering && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-link",
    style: {
      marginLeft: "auto",
      alignSelf: "center",
      fontSize: 12.5
    },
    onClick: () => onChange({
      ...f,
      query: "",
      tags: new Set(),
      priority: new Set(),
      effort: new Set(),
      status: null
    })
  }, "Clear filters"));
}

/** One lane's column: the divider tab, its tools, and the cards filed in it. */
function LaneColumn({
  lane,
  cards,
  view,
  onView,
  pinned,
  onPin,
  onAdd
}) {
  const drawer = lane.kind === "inbox";
  if (view === "min") {
    return /*#__PURE__*/React.createElement(PaperLane, {
      kind: lane.kind,
      collapsed: true,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "8px 0",
        flex: "none",
        alignSelf: "stretch"
      }
    }, /*#__PURE__*/React.createElement("h2", {
      className: "lane-name",
      style: {
        color: LANE_INK[lane.kind]
      }
    }, lane.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--color-grey-faint)"
      }
    }, cards.length), /*#__PURE__*/React.createElement("button", {
      type: "button",
      style: {
        flex: 1,
        alignSelf: "stretch"
      },
      "aria-label": `Expand ${lane.name}`,
      onClick: () => onView("")
    }));
  }
  return /*#__PURE__*/React.createElement(PaperLane, {
    kind: lane.kind,
    width: view === "max" ? "max" : "default",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: 8,
      flex: "none",
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement(LaneHead, {
    name: lane.name,
    kind: lane.kind,
    count: String(cards.length),
    sla: lane.sla,
    tools: /*#__PURE__*/React.createElement(React.Fragment, null, lane.kind !== "archive" && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "lane-tool",
      title: `Add card to ${lane.name}`,
      onClick: onAdd
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "lane-tool",
      title: "Manage lane"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "more-horizontal",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "lane-tool",
      title: view === "max" ? "Restore" : "Maximize",
      onClick: () => onView(view === "max" ? "" : "max")
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "maximize-2",
      size: 13
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "lane-tool",
      title: "Minimize",
      onClick: () => onView("min")
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "minus",
      size: 13
    })))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      minHeight: 160,
      flex: 1,
      flexDirection: "column",
      gap: drawer ? 0 : 8,
      overflowY: "auto"
    }
  }, cards.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    style: {
      padding: "0 var(--card-gutter)"
    },
    "data-id": c.id
  }, /*#__PURE__*/React.createElement(CardFace, {
    card: c,
    flat: drawer,
    pinned: pinned.has(c.id),
    onPin: onPin
  })))));
}

/** The kanban: letterhead, filter bar, lanes in position order. */
function BoardScreen({
  data,
  onView,
  view
}) {
  const [f, setF] = React.useState({
    query: "",
    tags: new Set(),
    priority: new Set(),
    effort: new Set(),
    status: null,
    showInternal: true,
    showArchived: false,
    inboxSort: "oldest"
  });
  const [openMenu, setOpenMenu] = React.useState(null);
  const [views, setViews] = React.useState({});
  const [pinned, setPinned] = React.useState(new Set());
  const [cards, setCards] = React.useState(data.cards);
  const onPin = (id, on) => setPinned(s => {
    const n = new Set(s);
    on ? n.add(id) : n.delete(id);
    return n;
  });
  const q = f.query.trim().toLowerCase();
  const visible = c => (!q || c.title.toLowerCase().includes(q) || `#${c.id}`.includes(q)) && (!f.priority.size || f.priority.has(c.priority)) && (!f.effort.size || f.effort.has(c.effort)) && (!f.status || c.status === f.status) && (!f.tags.size || (c.tags || []).some(t => f.tags.has(t.name)));
  const shown = cards.filter(visible);
  const open = shown.filter(c => !["done", "shipped"].includes(c.status)).length;
  const unsorted = shown.filter(c => c.lane === "unsorted").length;
  const addCard = laneKey => {
    const id = String(Math.max(...cards.map(c => Number(c.id))) + 1);
    setCards([{
      id,
      lane: laneKey,
      title: "Untitled card",
      epic: null,
      status: "backlog",
      raised: "today",
      tags: []
    }, ...cards]);
  };
  return /*#__PURE__*/React.createElement("main", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0,
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "12px 24px",
      padding: "20px 24px 14px"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onView("project");
    }
  }, data.project.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "baseline",
      gap: "0 14px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 27
    }
  }, data.board.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--color-grey)"
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--color-ink)"
    }
  }, open), " open \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--color-ink)"
    }
  }, unsorted), " unsorted")), /*#__PURE__*/React.createElement(ViewLinks, {
    view: view,
    onView: onView,
    items: [["cockpit", "Epic Cockpit"], ["calendar", "Calendar"], ["timeline", "Timeline"], ["manage", "Manage"]]
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm",
    onClick: () => addCard("unsorted")
  }, "Add lane"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm"
  }, "Export CSV"))), /*#__PURE__*/React.createElement(FilterBar, {
    f: f,
    onChange: setF,
    groups: data.groups,
    openMenu: openMenu,
    setOpenMenu: setOpenMenu
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0,
      alignItems: "stretch",
      gap: 8,
      overflowX: "auto",
      padding: "12px 24px 24px"
    }
  }, data.lanes.map(lane => /*#__PURE__*/React.createElement(LaneColumn, {
    key: lane.key,
    lane: lane,
    view: views[lane.key] || "",
    onView: v => setViews({
      ...views,
      [lane.key]: v
    }),
    cards: shown.filter(c => c.lane === lane.key),
    pinned: pinned,
    onPin: onPin,
    onAdd: () => addCard(lane.key)
  }))));
}
Object.assign(window, {
  BoardScreen,
  FilterBar,
  LaneColumn,
  Caret
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/BoardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CardFace.jsx
try { (() => {
const {
  PaperCard,
  Stat,
  Mark,
  Sq,
  EpicLabel,
  Icon
} = window.CardstockDesignSystem_acd70a;
const STATUS_TONE = {
  wip: "wip",
  built: "info",
  handed: "info",
  held: "muted",
  blocked: "blocked",
  shipped: "success",
  done: "success",
  backlog: "muted"
};
const PRIORITY_PEN = {
  1: "red",
  2: "blue",
  3: "violet"
};
const EFFORT_PEN = {
  L: "green",
  M: "amber",
  H: "red"
};

/**
 * The card face, composed exactly as src/components/board/card-item.tsx does:
 * resting chrome is #id, title, epic, status and the decisions; the back of
 * the card opens on hover after the dwell and the resting row steps aside.
 */
function CardFace({
  card,
  flat,
  pinned,
  onPin,
  overlay
}) {
  const chips = (card.priority || card.effort) && /*#__PURE__*/React.createElement("span", {
    className: "card-meta-chips",
    style: {
      display: "flex",
      flexShrink: 0,
      gap: "0.25rem"
    }
  }, card.priority && /*#__PURE__*/React.createElement(Sq, {
    on: true,
    pen: PRIORITY_PEN[card.priority],
    title: `Priority ${card.priority}`
  }, "P", card.priority), card.effort && /*#__PURE__*/React.createElement(Sq, {
    on: true,
    pen: EFFORT_PEN[card.effort],
    title: "Effort"
  }, card.effort));
  return /*#__PURE__*/React.createElement(PaperCard, {
    as: "article",
    variant: overlay ? "overlay" : flat ? "flat" : "resting",
    tint: card.tint,
    pinned: pinned,
    signal: card.signal === "forgotten" ? "forgotten" : null,
    style: {
      padding: "0.625rem",
      position: "relative"
    }
  }, !overlay && /*#__PURE__*/React.createElement("div", {
    className: "card-rail",
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": pinned ? "Unpin card" : "Pin card",
    "data-on": pinned ? "true" : undefined,
    onClick: () => onPin?.(card.id, !pinned)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: pinned ? "pin-off" : "pin",
    size: 13
  })), /*#__PURE__*/React.createElement("a", {
    href: "#",
    "aria-label": "Open in place",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "maximize-2",
    size: 13
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "card-color-trigger",
    "aria-label": "Card colour"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "palette",
    size: 13
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "0.5rem",
      paddingRight: "1.5rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--color-grey-faint)"
    }
  }, "#", card.id), /*#__PURE__*/React.createElement("p", {
    style: {
      minWidth: 0,
      fontSize: 18,
      fontWeight: 500,
      lineHeight: 1.3
    }
  }, card.title)), /*#__PURE__*/React.createElement("div", {
    className: "card-meta",
    style: {
      marginTop: "0.25rem",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "0.25rem 0.5rem"
    }
  }, card.epic && /*#__PURE__*/React.createElement(EpicLabel, {
    name: card.epic
  }), card.status !== "backlog" && /*#__PURE__*/React.createElement(Stat, {
    tone: STATUS_TONE[card.status]
  }, card.status), card.signal === "forgotten" && /*#__PURE__*/React.createElement(Stat, {
    tone: "blocked",
    title: "No target past the watch window"
  }, "forgotten")), /*#__PURE__*/React.createElement("div", {
    className: "card-rest"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-rest-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-meta",
    style: {
      marginTop: "0.25rem",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-age",
    "data-signal": card.signal || "active"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar-clock",
    size: 13,
    className: "card-age__icon"
  }), /*#__PURE__*/React.createElement("span", {
    className: "card-age-date"
  }, card.raised)), chips))), /*#__PURE__*/React.createElement("div", {
    className: "card-peek"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-peek-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-peek-actions card-meta",
    style: {
      marginTop: "0.375rem",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "0.25rem 0.5rem"
    }
  }, card.days != null && /*#__PURE__*/React.createElement(Stat, {
    tone: card.days > 5 ? "blocked" : "muted",
    title: "Days in this lane"
  }, card.days, "d"), /*#__PURE__*/React.createElement("span", {
    className: "card-age",
    "data-signal": card.signal || "active"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar-clock",
    size: 13,
    className: "card-age__icon"
  }), /*#__PURE__*/React.createElement("span", {
    className: "card-age-date"
  }, card.raised)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-link",
    style: {
      fontSize: 11.5
    }
  }, "Archive")), /*#__PURE__*/React.createElement("section", {
    className: "card-form",
    "aria-label": "Card fields",
    style: {
      marginTop: "0.625rem",
      borderTop: "1px solid var(--border-hairline)",
      paddingTop: "0.625rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Status"), /*#__PURE__*/React.createElement("select", {
    className: "paper-field",
    defaultValue: card.status,
    style: {
      height: "1.5rem",
      width: "100%",
      fontSize: 11.5
    },
    "aria-label": "Status"
  }, ["backlog", "blocked", "wip", "held", "built", "handed", "shipped", "done"].map(s => /*#__PURE__*/React.createElement("option", {
    key: s
  }, s))), /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Waiting"), /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "1.5rem",
      width: "100%",
      fontSize: 11.5
    },
    placeholder: "a person, a decision, another team",
    defaultValue: card.needs || "",
    "aria-label": "Waiting on"
  }), /*#__PURE__*/React.createElement("span", {
    className: "field-label field-label--dates"
  }, "Dates"), /*#__PURE__*/React.createElement("div", {
    className: "card-dates"
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-dates-grid"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-date-col-label"
  }, "started"), /*#__PURE__*/React.createElement("span", {
    className: "card-date-col-label"
  }, "target"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "paper-field",
    style: {
      height: "1.5rem",
      width: "100%",
      fontFamily: "var(--font-mono)",
      fontSize: 11.5
    },
    "aria-label": "Planned start"
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    className: "paper-field",
    style: {
      height: "1.5rem",
      width: "100%",
      fontFamily: "var(--font-mono)",
      fontSize: 11.5
    },
    "aria-label": "Target date"
  })), /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "1.5rem",
      width: "100%",
      fontSize: 11.5,
      fontStyle: "italic"
    },
    placeholder: "or a rough date \u2014 end of Q3",
    "aria-label": "Rough date"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card-ratings"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Effort"), /*#__PURE__*/React.createElement("span", {
    className: "card-ratings-sqs"
  }, ["L", "M", "H"].map(e => /*#__PURE__*/React.createElement(Sq, {
    key: e,
    as: "button",
    on: card.effort === e,
    pen: EFFORT_PEN[e]
  }, e))), /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Priority"), /*#__PURE__*/React.createElement("span", {
    className: "card-ratings-sqs"
  }, [1, 2, 3].map(p => /*#__PURE__*/React.createElement(Sq, {
    key: p,
    as: "button",
    on: card.priority === p,
    pen: PRIORITY_PEN[p]
  }, "P", p)))), card.note && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Note"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      lineHeight: 1.3,
      color: "var(--color-ink2)"
    }
  }, card.note)), card.tags?.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Tags"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.25rem 0.375rem"
    }
  }, card.tags.map(t => /*#__PURE__*/React.createElement(Mark, {
    key: t.name,
    hue: t.hue
  }, t.name))))))));
}
Object.assign(window, {
  CardFace,
  PRIORITY_PEN,
  EFFORT_PEN,
  STATUS_TONE
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CardFace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CockpitScreen.jsx
try { (() => {
const {
  Stat,
  Eyebrow,
  Icon
} = window.CardstockDesignSystem_acd70a;
const OUTLOOK_LABEL = {
  "at-risk": "At risk",
  attention: "Attention",
  planning: "Planning",
  "on-track": "On track"
};
const OUTLOOK_TONE = {
  "at-risk": "danger",
  attention: "attention",
  planning: "muted",
  "on-track": "success"
};
const MARK = {
  delivered: "✓",
  blocked: "!",
  late: "◷",
  moving: "→",
  queued: ""
};

/** The task-light map: one square per task, coloured by the cockpit pens. */
function TaskMap({
  epic
}) {
  const cells = [];
  for (let i = 0; i < epic.delivered; i++) cells.push("delivered");
  for (let i = 0; i < epic.blocked; i++) cells.push("blocked");
  for (let i = 0; i < epic.late; i++) cells.push("late");
  while (cells.length < epic.total) cells.push("queued");
  return /*#__PURE__*/React.createElement("div", {
    className: "cockpit-map",
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 3
    }
  }, cells.map((signal, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    title: signal,
    style: {
      display: "grid",
      placeItems: "center",
      width: 18,
      height: 18,
      borderRadius: "var(--radius-card)",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      fontWeight: 700,
      color: "var(--pen-ink)",
      background: `var(--signal-${signal})`
    }
  }, MARK[signal])));
}

/**
 * Epic Cockpit: the shelved tomes, their task-light maps and their
 * commitments. Where you take stock of a board rather than work it.
 */
function CockpitScreen({
  data,
  onView,
  view
}) {
  const [query, setQuery] = React.useState("");
  const [outlook, setOutlook] = React.useState("all");
  const epics = data.epics.filter(e => (outlook === "all" || e.outlook === outlook) && (!query.trim() || e.name.toLowerCase().includes(query.trim().toLowerCase())));
  const totals = data.epics.reduce((a, e) => ({
    tasks: a.tasks + e.total,
    delivered: a.delivered + e.delivered,
    blocked: a.blocked + e.blocked,
    late: a.late + e.late
  }), {
    tasks: 0,
    delivered: 0,
    blocked: 0,
    late: 0
  });
  const metrics = [["Tasks in flight", String(totals.tasks - totals.delivered), "Clipped into an epic and not yet delivered.", "info"], ["Delivered", String(totals.delivered), "Crossed a done lane, all epics.", "success"], ["Late", String(totals.late), "Past its target and still open.", "attention"], ["Blocked", String(totals.blocked), "Waiting on a person or a decision.", "danger"]];
  return /*#__PURE__*/React.createElement("main", {
    style: {
      margin: "0 auto",
      width: "100%",
      maxWidth: "72rem",
      padding: "28px 24px 48px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow",
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onView("board");
    }
  }, "\u2190 ", data.board.name)), /*#__PURE__*/React.createElement("h1", null, "Epic Cockpit"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 10,
      fontSize: 13.5,
      color: "var(--color-ink2)",
      maxWidth: "44rem"
    }
  }, "Every epic on this board as a tome on the desk: its outcome, its task lights, and the day it is committed to."), /*#__PURE__*/React.createElement(ViewLinks, {
    view: view,
    onView: onView,
    items: [["board", "Board"], ["timeline", "Timeline"], ["calendar", "Calendar"], ["project", "Project"]]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
      gap: 16,
      margin: "22px 0"
    }
  }, metrics.map(([label, value, note, tone]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "paper-card paper-card--static",
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement(Stat, {
    tone: tone
  }, label)), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 12,
      fontFamily: "var(--font-mono)",
      fontSize: 26,
      lineHeight: 1,
      color: "var(--color-ink)"
    }
  }, value), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 8,
      fontSize: 12,
      color: "var(--color-grey)"
    }
  }, note)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      width: 240,
      fontSize: 13
    },
    placeholder: "Search epics and tasks",
    value: query,
    onChange: e => setQuery(e.target.value),
    "aria-label": "Search epics"
  }), /*#__PURE__*/React.createElement("fieldset", {
    className: "fieldset"
  }, /*#__PURE__*/React.createElement("legend", null, "Outlook"), ["all", "on-track", "attention", "at-risk", "planning"].map(o => /*#__PURE__*/React.createElement("button", {
    key: o,
    type: "button",
    "aria-pressed": outlook === o,
    onClick: () => setOutlook(o),
    className: `stat stat--${o === "all" ? "muted" : OUTLOOK_TONE[o]}`,
    style: outlook === o ? {
      color: "var(--color-ink)",
      textDecoration: "underline",
      textUnderlineOffset: 3
    } : undefined
  }, o === "all" ? "any" : OUTLOOK_LABEL[o]))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm",
    style: {
      marginLeft: "auto"
    }
  }, "New epic")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
      gap: 20
    }
  }, epics.map(e => /*#__PURE__*/React.createElement("article", {
    key: e.name,
    className: `cockpit-epic cockpit-epic--${e.outlook}`,
    "data-outlook": e.outlook
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      borderBottom: "1px solid var(--border-hairline)",
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Epic \xB7 ", e.owner), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 18,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: ev => ev.preventDefault(),
    style: {
      color: "var(--color-ink-strong)"
    }
  }, e.name)), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 4,
      fontSize: 12,
      color: "var(--color-grey)"
    }
  }, e.outcome)), /*#__PURE__*/React.createElement(Stat, {
    tone: OUTLOOK_TONE[e.outlook]
  }, OUTLOOK_LABEL[e.outlook])), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(TaskMap, {
    epic: e
  })), /*#__PURE__*/React.createElement("footer", {
    style: {
      marginTop: 12,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 8,
      borderTop: "1px solid var(--border-hairline)",
      paddingTop: 12,
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, e.delivered, " of ", e.total), " delivered", e.blocked ? ` · ${e.blocked} blocked` : "", e.late ? ` · ${e.late} late` : ""), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "right",
      color: "var(--color-grey)"
    }
  }, /*#__PURE__*/React.createElement("small", {
    style: {
      display: "block",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      fontSize: 9
    }
  }, "Commitment"), /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: "var(--font-mono)",
      color: "var(--color-ink)"
    }
  }, e.commitment)))))), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 18,
      display: "flex",
      gap: 18,
      fontSize: 11,
      color: "var(--color-grey)"
    }
  }, ["delivered", "moving", "late", "blocked", "queued"].map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: `var(--signal-${s})`
    }
  }), s))));
}
Object.assign(window, {
  CockpitScreen,
  TaskMap
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CockpitScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/LoginScreen.jsx
try { (() => {
/**
 * Sign-in. Invite-only: an email that is not on the allowlist never gets a
 * session. Setting a password the first time is the whole onboarding — no
 * mail is involved.
 */
function LoginScreen({
  onView
}) {
  const [onboarding, setOnboarding] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = e => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onView("projects");
    }, 500);
  };
  return /*#__PURE__*/React.createElement("main", {
    style: {
      display: "flex",
      minHeight: "100%",
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "paper-card paper-card--still",
    style: {
      width: "100%",
      maxWidth: "24rem",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 27,
      lineHeight: 1.2
    }
  }, "cardstock"), /*#__PURE__*/React.createElement("span", {
    style: {
      border: "1px solid var(--border-strong)",
      padding: "2px 6px",
      fontSize: 9,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.11em",
      color: "var(--color-grey)"
    }
  }, "beta")), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      fontSize: 13.5,
      lineHeight: 1.45,
      color: "var(--color-grey)"
    }
  }, "Invite-only while in beta. Sign in with the email you were invited with. Setting a password the first time is the whole onboarding."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: "grid",
      gap: 12,
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "2.25rem",
      fontSize: 13.5
    },
    type: "email",
    required: true,
    placeholder: "you@company.com",
    value: email,
    onChange: e => setEmail(e.target.value),
    "aria-label": "Email"
  }), /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "2.25rem",
      fontSize: 13.5
    },
    type: "password",
    required: true,
    placeholder: onboarding ? "Choose a password" : "Password",
    "aria-label": "Password"
  }), onboarding && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "2.25rem",
      fontSize: 13.5
    },
    type: "text",
    required: true,
    placeholder: "Your name",
    "aria-label": "Your name"
  }), /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    style: {
      height: "2.25rem",
      fontSize: 13.5
    },
    type: "password",
    required: true,
    placeholder: "Confirm password",
    "aria-label": "Confirm password"
  })), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "paper-btn",
    style: {
      width: "100%"
    },
    disabled: busy
  }, busy ? "Working…" : onboarding ? "Set password and sign in" : "Sign in")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOnboarding(v => !v),
    style: {
      marginTop: 20,
      fontSize: 12,
      color: "var(--color-grey)",
      textDecoration: "underline",
      textUnderlineOffset: 2
    }
  }, onboarding ? "Already have a password? Sign in" : "First time here? Set your password")));
}
Object.assign(window, {
  LoginScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProjectScreen.jsx
try { (() => {
const {
  Stamp,
  Icon,
  Mark,
  Stat
} = window.CardstockDesignSystem_acd70a;
const MICRO = [{
  name: "Unsorted",
  kind: "inbox",
  cells: [{
    signal: "queued"
  }, {
    signal: "queued"
  }, {
    signal: "queued"
  }]
}, {
  name: "Now",
  kind: "work",
  cells: [{
    signal: "moving"
  }, {
    signal: "late"
  }, {
    signal: "moving"
  }]
}, {
  name: "Next",
  kind: "work",
  cells: [{
    tint: "blue"
  }, {
    signal: "queued"
  }]
}, {
  name: "Later",
  kind: "work",
  cells: [{
    signal: "vacant"
  }]
}, {
  name: "Nice-to-have",
  kind: "work",
  cells: [{
    signal: "queued"
  }]
}, {
  name: "Parked",
  kind: "work",
  cells: [{
    signal: "queued"
  }]
}, {
  name: "Needs input",
  kind: "waiting",
  cells: [{
    signal: "blocked"
  }]
}, {
  name: "Built",
  kind: "built",
  cells: [{
    signal: "moving"
  }]
}, {
  name: "Done",
  kind: "done",
  cells: [{
    signal: "delivered"
  }]
}, {
  name: "Archive",
  kind: "archive",
  cells: [{
    signal: "vacant"
  }]
}];

/**
 * The project page: a letterhead, then one quiet section folder per chapter —
 * boards, people, concepts, settings. Binders live only in Boards.
 */
function ProjectScreen({
  data,
  onView
}) {
  const go = (e, v) => {
    e.preventDefault();
    onView(v);
  };
  return /*#__PURE__*/React.createElement("main", {
    style: {
      margin: "0 auto",
      width: "100%",
      maxWidth: "64rem",
      padding: "32px 24px 48px"
    }
  }, /*#__PURE__*/React.createElement("header", {
    className: "letterhead"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, data.project.name), /*#__PURE__*/React.createElement("p", {
    className: "cta-body"
  }, data.project.blurb), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: "0.9rem",
      marginTop: "0.6rem",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    onClick: e => e.preventDefault()
  }, "Calendar"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    onClick: e => go(e, "projects")
  }, "\u2190 All projects"))), /*#__PURE__*/React.createElement("div", {
    className: "letterhead-aside"
  }, /*#__PURE__*/React.createElement(Stamp, null, data.cards.length, " cards", /*#__PURE__*/React.createElement("br", null), "filed"))), /*#__PURE__*/React.createElement("section", {
    className: "folder folder--section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab"
  }, /*#__PURE__*/React.createElement("h2", null, "boards"), /*#__PURE__*/React.createElement("span", {
    className: "folder-tab-dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "folder-count"
  }, "2")), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "binders",
    style: {
      gridTemplateColumns: "minmax(0,1fr)"
    }
  }, /*#__PURE__*/React.createElement("li", {
    className: "binder binder--wide"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "binder-name"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "binder-open",
    onClick: e => go(e, "board")
  }, data.board.name), /*#__PURE__*/React.createElement("span", {
    className: "binder-count"
  }, data.cards.length, " cards")), /*#__PURE__*/React.createElement("div", {
    className: "lane-map"
  }, MICRO.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.name,
    className: "lane-map-col",
    "data-kind": l.kind
  }, /*#__PURE__*/React.createElement("div", {
    className: "lane-map-pack"
  }, l.cells.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `lane-map-cell ${c.signal ? `lane-map-cell--${c.signal}` : ""} ${c.tint ? `card-color--${c.tint}` : ""}`.trim()
  }))), /*#__PURE__*/React.createElement("span", {
    className: "lane-map-tip"
  }, l.name)))), /*#__PURE__*/React.createElement("div", {
    className: "binder-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    style: {
      fontSize: 12.5
    },
    onClick: e => go(e, "board")
  }, "Go to Board"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    style: {
      fontSize: 12.5
    },
    onClick: e => go(e, "cockpit")
  }, "Epic Cockpit"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    style: {
      fontSize: 12.5
    },
    onClick: e => e.preventDefault()
  }, "Manage"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "paper-link",
    style: {
      fontSize: 12.5
    },
    onClick: e => e.preventDefault()
  }, "Export CSV"))))), /*#__PURE__*/React.createElement("div", {
    className: "folder-aside"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm"
  }, "New board")))), /*#__PURE__*/React.createElement("section", {
    className: "folder folder--section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab"
  }, /*#__PURE__*/React.createElement("h2", null, "people"), /*#__PURE__*/React.createElement("span", {
    className: "folder-tab-dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "folder-count"
  }, data.people.length)), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "binders",
    style: {
      gridTemplateColumns: "minmax(0,1fr)"
    }
  }, data.people.map(p => /*#__PURE__*/React.createElement("li", {
    key: p.email,
    className: "binder binder--wide",
    style: {
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "roster-slip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "portrait",
    style: {
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-grey)"
    }
  }, p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "roster-who"
  }, /*#__PURE__*/React.createElement("span", {
    className: "roster-name"
  }, p.name, p.me && /*#__PURE__*/React.createElement("span", {
    className: "roster-you"
  }, "you")), /*#__PURE__*/React.createElement("span", {
    className: "roster-mail"
  }, p.email)), /*#__PURE__*/React.createElement("span", {
    className: "roster-meta"
  }, /*#__PURE__*/React.createElement(Stat, {
    tone: p.role === "owner" ? "ink" : "muted"
  }, p.role))))), /*#__PURE__*/React.createElement("li", {
    className: "binder binder--wide",
    style: {
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "roster-slip roster-slip--blank"
  }, /*#__PURE__*/React.createElement("div", {
    className: "roster-invite"
  }, /*#__PURE__*/React.createElement("span", {
    className: "roster-invite-kicker"
  }, "invite"), /*#__PURE__*/React.createElement("p", {
    className: "roster-invite-lead"
  }, "Recording the address sends no email \u2014 share the app URL and they choose a password on their first visit."), /*#__PURE__*/React.createElement("div", {
    className: "roster-fields"
  }, /*#__PURE__*/React.createElement("label", null, "Email", /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "them@company.com"
  })), /*#__PURE__*/React.createElement("label", null, "Name", /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Optional"
  })), /*#__PURE__*/React.createElement("label", null, "Role", /*#__PURE__*/React.createElement("select", null, /*#__PURE__*/React.createElement("option", null, "member"), /*#__PURE__*/React.createElement("option", null, "admin"))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "roster-invite-go"
  }, "Add to project")))))))), /*#__PURE__*/React.createElement("section", {
    className: "folder folder--section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab"
  }, /*#__PURE__*/React.createElement("h2", null, "concepts"), /*#__PURE__*/React.createElement("span", {
    className: "folder-tab-dot"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "folder-count"
  }, data.groups.length)), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "graph",
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "graph-caption"
  }, "A board thinks in concepts. The tags a card can carry branch from each one; hue belongs to the group, in board order."), /*#__PURE__*/React.createElement("div", {
    className: "graph-rows"
  }, data.groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.name,
    className: "graph-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: `graph-node graph-node--${g.hue}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "graph-node-name"
  }, g.name), /*#__PURE__*/React.createElement("span", {
    className: "graph-key"
  }, g.name.toLowerCase()), /*#__PURE__*/React.createElement("span", {
    className: "graph-tools"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Rename"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 12
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "data-danger": true,
    title: "Remove"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 12
  })))), /*#__PURE__*/React.createElement("span", {
    className: "graph-edge",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "graph-leaves"
  }, g.tags.map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "graph-leaf"
  }, /*#__PURE__*/React.createElement(Mark, {
    hue: g.hue
  }, t), /*#__PURE__*/React.createElement("span", {
    className: "graph-tools"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: "Rename"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 12
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "graph-leaf graph-leaf--new"
  }, /*#__PURE__*/React.createElement("input", {
    className: "paper-field",
    placeholder: "new tag",
    style: {
      width: "9rem",
      fontSize: 12
    }
  }))))))))), /*#__PURE__*/React.createElement("section", {
    className: "folder folder--section"
  }, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab"
  }, /*#__PURE__*/React.createElement("h2", null, "settings")), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1 / -1"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "cta-title"
  }, "Take the folder home"), /*#__PURE__*/React.createElement("p", {
    className: "cta-body"
  }, "Download every card as the markdown sheet it came from \u2014 lane, rank, priority, effort and target written back into the frontmatter.")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn cta-button"
  }, "Download sheets"), /*#__PURE__*/React.createElement("span", {
    className: "cta-note"
  }, "zip \xB7 ", data.cards.length, " sheets")), /*#__PURE__*/React.createElement("div", {
    className: "danger",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "cta-title"
  }, "Delete this project"), /*#__PURE__*/React.createElement("p", {
    className: "cta-body"
  }, "Boards, lanes, cards and history go with it. The sheets in git do not.")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn cta-button cta-button--danger"
  }, "Delete project"))))));
}
Object.assign(window, {
  ProjectScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProjectScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProjectsScreen.jsx
try { (() => {
const {
  Folder,
  Stamp,
  PaperLink,
  Icon
} = window.CardstockDesignSystem_acd70a;

/**
 * The projects page: one manila dossier per project, taking a full row. The
 * tab names the project and is the way in; the binders inside name the
 * boards. Nothing is written twice.
 */
function ProjectsScreen({
  data,
  onView
}) {
  const go = (e, v) => {
    e.preventDefault();
    onView(v);
  };
  return /*#__PURE__*/React.createElement("main", {
    style: {
      margin: "0 auto",
      width: "100%",
      maxWidth: "64rem",
      padding: "32px 24px"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      marginBottom: 32,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: "12px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "42rem"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 36,
      lineHeight: 1
    }
  }, "Projects"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 1.3,
      color: "var(--color-ink2)"
    }
  }, data.project.blurb)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm paper-btn--outline"
  }, "Import project"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "paper-btn paper-btn--sm"
  }, "New project"))), /*#__PURE__*/React.createElement("ul", {
    className: "folders"
  }, /*#__PURE__*/React.createElement("li", {
    className: "folder"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "folder-tab",
    onClick: e => go(e, "project")
  }, /*#__PURE__*/React.createElement("span", null, data.project.name)), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("p", {
    className: "folder-blurb"
  }, data.project.blurb), /*#__PURE__*/React.createElement("ul", {
    className: "binders",
    "aria-label": "Boards in Demo"
  }, /*#__PURE__*/React.createElement("li", {
    className: "binder"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "binder-name"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "binder-open",
    onClick: e => go(e, "board")
  }, data.board.name)), /*#__PURE__*/React.createElement("p", {
    className: "binder-count"
  }, data.cards.length, " cards"), /*#__PURE__*/React.createElement("div", {
    className: "binder-foot binder-foot--tools binder-foot--stacked"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-io"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "binder-tool",
    title: "Manage Product backlog"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "binder-io"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "binder-tool",
    title: "Download as sheets"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "binder-tool",
    title: "Import sheets"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload"
  })), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "binder-tool binder-tool--pen",
    onClick: e => go(e, "cockpit")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gauge"
  }), "Epic Cockpit")))), /*#__PURE__*/React.createElement("li", {
    className: "binder"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-rivets",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("h2", {
    className: "binder-name"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "binder-open",
    onClick: e => e.preventDefault()
  }, "Platform")), /*#__PURE__*/React.createElement("p", {
    className: "binder-count"
  }, "6 cards"), /*#__PURE__*/React.createElement("div", {
    className: "binder-foot binder-foot--tools binder-foot--stacked"
  }, /*#__PURE__*/React.createElement("span", {
    className: "binder-io"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "binder-tool",
    title: "Manage Platform"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "binder-io"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "binder-tool",
    title: "Download as sheets"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download"
  })), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "binder-tool binder-tool--pen",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "gauge"
  }), "Epic Cockpit"))))), /*#__PURE__*/React.createElement("div", {
    className: "folder-aside"
  }, /*#__PURE__*/React.createElement(Stamp, null, data.cards.length + 6, " cards", /*#__PURE__*/React.createElement("br", null), "filed"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "folder-go paper-link",
    onClick: e => go(e, "project")
  }, "Open project \u2192")))), /*#__PURE__*/React.createElement("li", {
    className: "folder folder--empty"
  }, /*#__PURE__*/React.createElement("span", {
    className: "folder-tab"
  }, /*#__PURE__*/React.createElement("span", null, "Marketing site")), /*#__PURE__*/React.createElement("div", {
    className: "folder-body"
  }, /*#__PURE__*/React.createElement("p", {
    className: "folder-blurb",
    style: {
      color: "var(--color-grey-faint)"
    }
  }, "No description."), /*#__PURE__*/React.createElement("p", {
    className: "binders-empty"
  }, "No boards yet \u2014 open the project to add one."), /*#__PURE__*/React.createElement("div", {
    className: "folder-aside"
  }, /*#__PURE__*/React.createElement(Stamp, {
    faint: true
  }, "nothing", /*#__PURE__*/React.createElement("br", null), "filed"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "folder-go paper-link",
    onClick: e => e.preventDefault()
  }, "Open project \u2192"))))));
}
Object.assign(window, {
  ProjectsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProjectsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Shell.jsx
try { (() => {
const {
  PaperTopbar,
  Portrait,
  Icon
} = window.CardstockDesignSystem_acd70a;

/** The app chrome: the paper topbar, its wordmark, and the user menu. */
function Shell({
  view,
  onView,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100%"
    }
  }, /*#__PURE__*/React.createElement("header", {
    className: "paper-topbar",
    style: {
      display: "flex",
      height: "3rem",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 1rem"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onView("projects");
    },
    style: {
      fontFamily: "var(--font-display)",
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: "-0.012em",
      color: "var(--color-ink-strong)",
      textDecoration: "none"
    }
  }, "cardstock"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13.5
    }
  }, "Ana Lima", /*#__PURE__*/React.createElement("span", {
    className: "portrait portrait--topbar",
    style: {
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-grey)"
    }
  }, "AL"), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 13
  }))), children);
}

/** The row of view links every board-scoped page carries under its title. */
function ViewLinks({
  view,
  onView,
  items
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.9rem",
      marginTop: "0.4rem",
      fontSize: 12.5
    }
  }, items.map(([key, label]) => /*#__PURE__*/React.createElement("a", {
    key: key,
    href: "#",
    className: "paper-link",
    onClick: e => {
      e.preventDefault();
      onView(key);
    },
    style: key === view ? {
      color: "var(--color-ink)",
      textDecoration: "underline"
    } : undefined
  }, label)));
}
Object.assign(window, {
  Shell,
  ViewLinks
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/TimelineScreen.jsx
try { (() => {
const {
  Sq,
  Stat,
  Icon,
  EpicLabel
} = window.CardstockDesignSystem_acd70a;

/**
 * Timeline: what has been raised, what is dated, and what has been forgotten.
 * Work begins at its raised date; the watchlist calls out anything still
 * unplanned after the project window.
 */
function TimelineScreen({
  data,
  onView,
  view
}) {
  const [windowDays, setWindowDays] = React.useState(14);
  const rows = data.cards.filter(c => c.signal === "forgotten");
  const laneName = key => data.lanes.find(l => l.key === key)?.name ?? key;
  const built = data.cards.filter(c => c.status === "built");
  const shipped = data.cards.filter(c => c.status === "shipped");
  return /*#__PURE__*/React.createElement("main", {
    style: {
      margin: "0 auto",
      width: "100%",
      maxWidth: "64rem",
      padding: "28px 24px 48px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "eyebrow",
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onView("board");
    }
  }, "\u2190 ", data.board.name)), /*#__PURE__*/React.createElement("h1", null, "Timeline"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 10,
      fontSize: 13.5,
      color: "var(--color-ink2)"
    }
  }, "Work begins at its raised date. The watchlist calls out anything still unplanned after ", windowDays, " days."), /*#__PURE__*/React.createElement(ViewLinks, {
    view: view,
    onView: onView,
    items: [["board", "Board"], ["cockpit", "Epic Cockpit"], ["calendar", "Calendar"], ["project", "Project"]]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 20,
      alignItems: "baseline",
      margin: "22px 0 18px",
      padding: "14px 0",
      borderTop: "1px solid var(--border-hairline)",
      borderBottom: "1px solid var(--border-hairline)",
      fontSize: 12.5,
      color: "var(--color-grey)"
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--color-ink)",
      fontSize: 14
    }
  }, data.cards.length), " raised"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--pen-blue)",
      fontSize: 14
    }
  }, "2"), " dated"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--pen-red)",
      fontSize: 14
    }
  }, rows.length), " forgotten"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--color-ink)",
      fontSize: 14
    }
  }, "0"), " missing a raised date"), /*#__PURE__*/React.createElement("label", {
    style: {
      marginLeft: "auto",
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "Window"), /*#__PURE__*/React.createElement("select", {
    className: "paper-field",
    style: {
      fontSize: 12.5
    },
    value: windowDays,
    onChange: e => setWindowDays(Number(e.target.value))
  }, /*#__PURE__*/React.createElement("option", {
    value: 7
  }, "Last 7 days"), /*#__PURE__*/React.createElement("option", {
    value: 14
  }, "Last 14 days"), /*#__PURE__*/React.createElement("option", {
    value: 30
  }, "Last 30 days")))), /*#__PURE__*/React.createElement("section", {
    className: "paper-card paper-card--static",
    style: {
      boxShadow: "inset 3px 0 0 var(--pen-red), var(--shadow-card)",
      padding: "18px 22px"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 22
    }
  }, "Needs attention"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 4,
      fontSize: 12.5,
      color: "var(--color-grey)"
    }
  }, "Unplanned past the project window, or still open after its target.")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--pen-red)"
    }
  }, rows.length, " cards")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, rows.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    style: {
      display: "grid",
      gridTemplateColumns: "108px minmax(0,1fr) auto auto 108px",
      alignItems: "center",
      gap: 14,
      padding: "10px 0",
      borderTop: "1px solid var(--border-hairline)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    tone: "muted",
    flat: true
  }, "assess"), /*#__PURE__*/React.createElement(Stat, {
    tone: "blocked",
    flat: true
  }, "forgotten")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      minWidth: 0,
      alignItems: "baseline",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--color-grey-faint)"
    }
  }, "#", c.id), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      color: "var(--color-ink)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, c.title)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: "var(--color-grey)",
      whiteSpace: "nowrap"
    }
  }, c.raised, " \xB7 no target"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 4
    }
  }, c.priority && /*#__PURE__*/React.createElement(Sq, {
    on: true,
    pen: PRIORITY_PEN[c.priority]
  }, "P", c.priority), c.effort && /*#__PURE__*/React.createElement(Sq, {
    on: true,
    pen: EFFORT_PEN[c.effort]
  }, c.effort)), /*#__PURE__*/React.createElement("span", {
    className: "stat stat--faint",
    style: {
      justifyContent: "flex-end"
    }
  }, laneName(c.lane)))))), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 22,
      marginTop: 32
    }
  }, "Relative to today"), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 4,
      fontSize: 12.5,
      color: "var(--color-grey)"
    }
  }, "What crossed Built and Shipped during the last ", windowDays, " days."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
      gap: 16,
      marginTop: 14
    }
  }, [["Built", built, "var(--pen-blue)"], ["Shipped", shipped, "var(--pen-green)"]].map(([label, list, pen]) => /*#__PURE__*/React.createElement("section", {
    key: label,
    className: "paper-card paper-card--static",
    style: {
      borderTop: `2px solid ${pen}`,
      padding: "14px 16px"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: "var(--color-grey)"
    }
  }, list.length)), list.length ? list.map(c => /*#__PURE__*/React.createElement("p", {
    key: c.id,
    style: {
      marginTop: 10,
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
      color: "var(--color-grey-faint)"
    }
  }, "#", c.id), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, c.title), /*#__PURE__*/React.createElement("span", {
    className: "stat stat--faint"
  }, "today"))) : /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 10,
      fontSize: 12.5,
      color: "var(--color-grey-faint)"
    }
  }, "Nothing crossed in this window.")))));
}
Object.assign(window, {
  TimelineScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/TimelineScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.js
try { (() => {
// Demo board, matching the seed in supabase/seed.sql and the screenshots in
// the cardstock repo. Lane kinds — not names — drive behaviour.
window.CS_DATA = {
  project: {
    slug: "demo",
    name: "Demo",
    blurb: "A project is a collection of boards. A board is where cards go to be worked; its epic cockpit is where you take stock."
  },
  board: {
    slug: "backlog",
    name: "Product backlog"
  },
  groups: [{
    name: "Area",
    hue: 2,
    tags: ["Billing", "Onboarding", "Reports", "Cross-cutting"]
  }, {
    name: "Step",
    hue: 4,
    tags: ["Spec", "Build", "QA"]
  }, {
    name: "Kind",
    hue: 3,
    tags: ["Bug", "Feature", "Chore"]
  }, {
    name: "Objective",
    hue: 5,
    tags: ["Retention", "Trust"]
  }],
  lanes: [{
    key: "unsorted",
    name: "Unsorted",
    kind: "inbox"
  }, {
    key: "now",
    name: "Now",
    kind: "work"
  }, {
    key: "next",
    name: "Next",
    kind: "work"
  }, {
    key: "later",
    name: "Later",
    kind: "work"
  }, {
    key: "nice",
    name: "Nice-to-have",
    kind: "work"
  }, {
    key: "parked",
    name: "Parked",
    kind: "work"
  }, {
    key: "needs",
    name: "Needs input",
    kind: "waiting",
    sla: 5
  }, {
    key: "built",
    name: "Built",
    kind: "built"
  }, {
    key: "done",
    name: "Done",
    kind: "done"
  }],
  cards: [{
    id: "11",
    lane: "unsorted",
    title: "Search results page loads slowly with many filters",
    epic: "Reports",
    status: "backlog",
    raised: "Aug 13",
    signal: "forgotten",
    tags: [{
      name: "Reports",
      hue: 2
    }, {
      name: "Bug",
      hue: 3
    }],
    note: "Ten filters on, the page takes eleven seconds."
  }, {
    id: "12",
    lane: "unsorted",
    title: "Team members can be invited by email from Settings",
    epic: "Cross-cutting",
    status: "backlog",
    raised: "Aug 14",
    signal: "forgotten",
    tags: [{
      name: "Cross-cutting",
      hue: 2
    }, {
      name: "Feature",
      hue: 3
    }]
  }, {
    id: "13",
    lane: "unsorted",
    title: "Onboarding checklist forgets progress after sign-out",
    epic: "Onboarding",
    status: "backlog",
    raised: "Aug 15",
    signal: "forgotten",
    tags: [{
      name: "Onboarding",
      hue: 2
    }, {
      name: "Bug",
      hue: 3
    }]
  }, {
    id: "1",
    lane: "now",
    title: "Sign-up form loses what you typed when the email is invalid",
    epic: "Onboarding",
    status: "backlog",
    raised: "Aug 1",
    signal: "forgotten",
    priority: 1,
    effort: "L",
    tags: [{
      name: "Onboarding",
      hue: 2
    }, {
      name: "Bug",
      hue: 3
    }, {
      name: "Trust",
      hue: 5
    }],
    note: "Validation clears the whole form, not just the bad field."
  }, {
    id: "2",
    lane: "now",
    title: "Invoice PDF shows the wrong currency for EU customers",
    epic: "Billing",
    status: "backlog",
    raised: "Aug 3",
    priority: 1,
    effort: "M",
    tags: [{
      name: "Billing",
      hue: 2
    }, {
      name: "Bug",
      hue: 3
    }],
    note: "Every invoice renders in USD regardless of the account."
  }, {
    id: "6",
    lane: "now",
    title: "Export any report as CSV",
    epic: "Reports",
    status: "wip",
    raised: "Aug 8",
    signal: "forgotten",
    priority: 2,
    effort: "L",
    tags: [{
      name: "Reports",
      hue: 2
    }, {
      name: "Feature",
      hue: 3
    }],
    note: "As long as I can slice it and dice it."
  }, {
    id: "10",
    lane: "next",
    title: "First run shows a two-minute tour",
    epic: "Onboarding",
    status: "backlog",
    raised: "Aug 12",
    priority: 1,
    effort: "M",
    tint: "blue",
    tags: [{
      name: "Onboarding",
      hue: 2
    }, {
      name: "Retention",
      hue: 5
    }]
  }, {
    id: "3",
    lane: "next",
    title: "Weekly report can be scheduled to email itself",
    epic: "Reports",
    status: "backlog",
    raised: "Aug 5",
    signal: "forgotten",
    priority: 2,
    effort: "M",
    tags: [{
      name: "Reports",
      hue: 2
    }, {
      name: "Feature",
      hue: 3
    }]
  }, {
    id: "4",
    lane: "nice",
    title: "Dark mode for the whole app",
    epic: "Cross-cutting",
    status: "backlog",
    raised: "Aug 6",
    signal: "forgotten",
    effort: "H",
    tags: [{
      name: "Cross-cutting",
      hue: 2
    }]
  }, {
    id: "9",
    lane: "parked",
    title: "Nightly build takes forty minutes",
    epic: "Cross-cutting",
    status: "held",
    raised: "Aug 10",
    effort: "M",
    tags: [{
      name: "Chore",
      hue: 3
    }]
  }, {
    id: "5",
    lane: "needs",
    title: "Should trials require a card?",
    epic: null,
    status: "blocked",
    raised: "Aug 7",
    signal: "forgotten",
    needs: "a decision from Finance",
    days: 6,
    tags: [{
      name: "Billing",
      hue: 2
    }]
  }, {
    id: "7",
    lane: "built",
    title: "Password reset email lands in spam",
    epic: "Cross-cutting",
    status: "built",
    raised: "Aug 9",
    effort: "L",
    tags: [{
      name: "Cross-cutting",
      hue: 2
    }, {
      name: "QA",
      hue: 4
    }]
  }, {
    id: "8",
    lane: "done",
    title: "Board loads under a second with 400 cards",
    epic: "Reports",
    status: "shipped",
    raised: "Jul 28",
    effort: "M",
    tint: "green",
    tags: [{
      name: "Chore",
      hue: 3
    }]
  }],
  epics: [{
    name: "Onboarding",
    owner: "Ana",
    outcome: "A new team reaches a first board in a day.",
    outlook: "at-risk",
    delivered: 1,
    total: 5,
    blocked: 0,
    late: 2,
    commitment: "Oct 15, 2026"
  }, {
    name: "Billing",
    owner: "Rafa",
    outcome: "Invoices are right the first time, in every currency.",
    outlook: "attention",
    delivered: 2,
    total: 4,
    blocked: 1,
    late: 1,
    commitment: "Nov 2, 2026"
  }, {
    name: "Reports",
    owner: "Owner not set",
    outcome: "Anything on screen can be sliced and taken away.",
    outlook: "on-track",
    delivered: 3,
    total: 4,
    blocked: 0,
    late: 0,
    commitment: "Sep 30, 2026"
  }, {
    name: "Cross-cutting",
    owner: "Ana",
    outcome: "Outcome not described yet.",
    outlook: "planning",
    delivered: 0,
    total: 3,
    blocked: 0,
    late: 0,
    commitment: "Not set"
  }],
  people: [{
    name: "Ana Lima",
    email: "ana@demo.test",
    role: "admin",
    me: true
  }, {
    name: "Rafa Costa",
    email: "rafa@demo.test",
    role: "member"
  }, {
    name: "No name yet",
    email: "owner@demo.test",
    role: "owner"
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.js", error: String((e && e.message) || e) }); }

__ds_ns.BoardCard = __ds_scope.BoardCard;

__ds_ns.CalendarSlip = __ds_scope.CalendarSlip;

__ds_ns.EpicTome = __ds_scope.EpicTome;

__ds_ns.Binder = __ds_scope.Binder;

__ds_ns.Folder = __ds_scope.Folder;

__ds_ns.LaneMap = __ds_scope.LaneMap;

__ds_ns.Letterhead = __ds_scope.Letterhead;

__ds_ns.Portrait = __ds_scope.Portrait;

__ds_ns.PaperTooltip = __ds_scope.PaperTooltip;

__ds_ns.CARD_COLORS = __ds_scope.CARD_COLORS;

__ds_ns.ColorPicker = __ds_scope.ColorPicker;

__ds_ns.PaperButton = __ds_scope.PaperButton;

__ds_ns.BinderTool = __ds_scope.BinderTool;

__ds_ns.PaperField = __ds_scope.PaperField;

__ds_ns.Fieldset = __ds_scope.Fieldset;

__ds_ns.FieldLabel = __ds_scope.FieldLabel;

__ds_ns.PaperLink = __ds_scope.PaperLink;

__ds_ns.LUCIDE_NODES = __ds_scope.LUCIDE_NODES;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.EpicLabel = __ds_scope.EpicLabel;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Mark = __ds_scope.Mark;

__ds_ns.MARK_HUES = __ds_scope.MARK_HUES;

__ds_ns.Sq = __ds_scope.Sq;

__ds_ns.PRIORITY_PEN = __ds_scope.PRIORITY_PEN;

__ds_ns.EFFORT_PEN = __ds_scope.EFFORT_PEN;

__ds_ns.Stamp = __ds_scope.Stamp;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.STATUS_TONE = __ds_scope.STATUS_TONE;

__ds_ns.LANE_INK = __ds_scope.LANE_INK;

__ds_ns.LaneHead = __ds_scope.LaneHead;

__ds_ns.PaperCard = __ds_scope.PaperCard;

__ds_ns.PaperLane = __ds_scope.PaperLane;

__ds_ns.PaperTopbar = __ds_scope.PaperTopbar;

__ds_ns.PaperWell = __ds_scope.PaperWell;

})();
