/* @ds-bundle: {"format":4,"namespace":"PackAthleticClubDesignSystem_ad379b","components":[{"name":"AthleteCard","sourcePath":"components/cards/AthleteCard.jsx"},{"name":"ClassCard","sourcePath":"components/cards/ClassCard.jsx"},{"name":"PhotoTile","sourcePath":"components/cards/PhotoTile.jsx"},{"name":"Button","sourcePath":"components/controls/Button.jsx"},{"name":"Chip","sourcePath":"components/controls/Chip.jsx"},{"name":"Tag","sourcePath":"components/controls/Tag.jsx"}],"sourceHashes":{"components/cards/AthleteCard.jsx":"95ba7da40a60","components/cards/ClassCard.jsx":"e69769304ddc","components/cards/PhotoTile.jsx":"7d4b2fa0bbb2","components/controls/Button.jsx":"41d737162c30","components/controls/Chip.jsx":"72a34fc4085a","components/controls/Tag.jsx":"f818a1961a69","ui_kits/member-app/App.jsx":"23355c49df03","ui_kits/member-app/Book.jsx":"3ddeda58f69e","ui_kits/member-app/ClassDetail.jsx":"ec250dbab6ba","ui_kits/member-app/Log.jsx":"6c30aa2cab9f","ui_kits/member-app/Profile.jsx":"0936950bbef6","ui_kits/member-app/Shell.jsx":"a3f86c16c346","ui_kits/member-app/Today.jsx":"8870ef51f433"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PackAthleticClubDesignSystem_ad379b = window.PackAthleticClubDesignSystem_ad379b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/cards/AthleteCard.jsx
try { (() => {
function AthleteCard({
  name,
  photo,
  breed,
  age,
  stage,
  since,
  streak,
  stats = [],
  compact
}) {
  const initial = /*#__PURE__*/React.createElement("span", {
    className: "pk-athlete-initial"
  }, (name || "?").charAt(0));
  const img = photo ? /*#__PURE__*/React.createElement("img", {
    className: "pk-athlete-img",
    src: photo,
    alt: name
  }) : initial;
  const sub = [breed, age, stage].filter(Boolean).join(" · ");
  const streakTag = streak ? /*#__PURE__*/React.createElement("span", {
    className: "pk-tag pk-tag-signal"
  }, streak, " day streak") : null;
  if (compact) {
    return /*#__PURE__*/React.createElement("article", {
      className: "pk-athlete pk-athlete-compact"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pk-athlete-thumb"
    }, img), /*#__PURE__*/React.createElement("div", {
      className: "pk-athlete-body"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "pk-athlete-name"
    }, name), /*#__PURE__*/React.createElement("p", {
      className: "pk-athlete-sub"
    }, sub)), /*#__PURE__*/React.createElement("div", {
      className: "pk-athlete-top",
      style: {
        alignSelf: "flex-start"
      }
    }, streakTag));
  }
  return /*#__PURE__*/React.createElement("article", {
    className: "pk-athlete"
  }, img, /*#__PURE__*/React.createElement("div", {
    className: "pk-athlete-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pk-tag pk-tag-glass"
  }, since ? "Member since " + since : "Pack athlete"), streakTag), /*#__PURE__*/React.createElement("div", {
    className: "pk-athlete-body"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pk-athlete-name"
  }, name), /*#__PURE__*/React.createElement("p", {
    className: "pk-athlete-sub"
  }, sub), stats.length ? /*#__PURE__*/React.createElement("dl", {
    className: "pk-athlete-stats"
  }, stats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pk-stat"
  }, /*#__PURE__*/React.createElement("dd", null, s.value), /*#__PURE__*/React.createElement("dt", null, s.label)))) : null));
}
Object.assign(__ds_scope, { AthleteCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/AthleteCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/PhotoTile.jsx
try { (() => {
function PhotoTile({
  image,
  label,
  selected,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pk-tile" + (selected ? " pk-tile-on" : ""),
    onClick: onClick,
    "aria-pressed": !!selected
  }, image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: ""
  }) : null, /*#__PURE__*/React.createElement("span", {
    className: "pk-tile-label"
  }, label));
}
Object.assign(__ds_scope, { PhotoTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/PhotoTile.jsx", error: String((e && e.message) || e) }); }

// components/controls/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const cx = (...a) => a.filter(Boolean).join(" ");
function Button({
  variant = "primary",
  size = "md",
  wide,
  block,
  icon,
  className,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button"
  }, rest, {
    className: cx("pk-btn", "pk-btn-" + variant, size === "sm" && "pk-btn-sm", wide && "pk-btn-wide", block && "pk-btn-block", className)
  }), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Button.jsx", error: String((e && e.message) || e) }); }

// components/controls/Chip.jsx
try { (() => {
const cx = (...a) => a.filter(Boolean).join(" ");
function Chip({
  selected,
  glass,
  icon,
  onClick,
  className,
  children
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: cx("pk-chip", glass && "pk-chip-glass", selected && "pk-chip-on", className),
    "aria-pressed": !!selected,
    onClick: onClick
  }, icon, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Chip.jsx", error: String((e && e.message) || e) }); }

// components/controls/Tag.jsx
try { (() => {
function Tag({
  tone = "neutral",
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "pk-tag pk-tag-" + tone
  }, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Tag.jsx", error: String((e && e.message) || e) }); }

// components/cards/ClassCard.jsx
try { (() => {
function spotsCopy(n) {
  return n === 0 ? "Full. Waitlist open" : n === 1 ? "Last spot" : n + " spots left";
}
function ClassCard({
  layout = "tile",
  image,
  discipline,
  premium,
  title,
  partner,
  place,
  time,
  duration,
  credits,
  spotsLeft,
  onClick
}) {
  const hasSpots = typeof spotsLeft === "number";
  const low = hasSpots && spotsLeft <= 2;
  const creditLabel = credits + (credits === 1 ? " credit" : " credits");
  const img = image ? /*#__PURE__*/React.createElement("img", {
    className: "pk-class-img",
    src: image,
    alt: ""
  }) : null;
  const spots = hasSpots ? /*#__PURE__*/React.createElement("p", {
    className: "pk-class-spots" + (low ? " pk-class-spots-low" : "")
  }, spotsCopy(spotsLeft)) : null;
  if (layout === "row") {
    return /*#__PURE__*/React.createElement("article", {
      className: "pk-class pk-class-row",
      onClick: onClick,
      style: onClick ? {
        cursor: "pointer"
      } : null
    }, /*#__PURE__*/React.createElement("div", {
      className: "pk-class-thumb"
    }, img), /*#__PURE__*/React.createElement("div", {
      className: "pk-class-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "pk-class-meta",
      style: {
        margin: "0 0 4px"
      }
    }, [time, duration].filter(Boolean).join(" · ")), /*#__PURE__*/React.createElement("h3", {
      className: "pk-class-title"
    }, title), /*#__PURE__*/React.createElement("p", {
      className: "pk-class-meta"
    }, [partner, place].filter(Boolean).join(" · ")), spots), /*#__PURE__*/React.createElement("div", {
      className: "pk-class-credits"
    }, credits, /*#__PURE__*/React.createElement("small", null, credits === 1 ? "credit" : "credits")));
  }
  return /*#__PURE__*/React.createElement("article", {
    className: "pk-class",
    onClick: onClick,
    style: onClick ? {
      cursor: "pointer"
    } : null
  }, img, /*#__PURE__*/React.createElement("div", {
    className: "pk-class-top"
  }, /*#__PURE__*/React.createElement("span", null, premium ? /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: "premium"
  }, "Premium") : discipline ? /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: "glass"
  }, discipline) : null), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: "glass"
  }, creditLabel)), /*#__PURE__*/React.createElement("div", {
    className: "pk-class-body"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pk-class-title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "pk-class-meta"
  }, [time, partner, place].filter(Boolean).join(" · ")), spots));
}
Object.assign(__ds_scope, { ClassCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/ClassCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/App.jsx
try { (() => {
function App() {
  const [tab, setTab] = React.useState(() => localStorage.getItem("pk-kit-tab") || "today");
  const [cls, setCls] = React.useState(null);
  const [theme, setTheme] = React.useState("light");
  const [sheet, setSheet] = React.useState(false);
  const [credits, setCredits] = React.useState(7);
  const [upNext, setUpNext] = React.useState({
    when: "Tomorrow · 6:00 pm",
    title: "Scent Work 101",
    partner: "Northside Canine",
    place: "1.1 mi",
    image: PH + "grass.jpg"
  });
  const scroller = React.useRef(null);
  const go = t => {
    setTab(t);
    setCls(null);
    localStorage.setItem("pk-kit-tab", t);
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const overPhoto = !!cls || tab === "today";
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": theme,
    className: "kit-page",
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      boxSizing: "border-box",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 20,
      right: 20,
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(PK.Chip, {
    selected: theme === "light",
    onClick: () => setTheme("light")
  }, "Light"), /*#__PURE__*/React.createElement(PK.Chip, {
    selected: theme === "dark",
    onClick: () => setTheme("dark")
  }, "Dark")), /*#__PURE__*/React.createElement(Phone, {
    overPhoto: overPhoto
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, cls ? /*#__PURE__*/React.createElement(ClassDetail, {
    cls: cls,
    onBack: () => setCls(null),
    onBook: () => setSheet(true)
  }) : /*#__PURE__*/React.createElement("div", {
    ref: scroller,
    className: "kit-scroll",
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, tab === "today" && /*#__PURE__*/React.createElement(TodayScreen, {
    credits: credits,
    onOpen: setCls,
    onTab: go,
    upNext: upNext
  }), tab === "book" && /*#__PURE__*/React.createElement(BookScreen, {
    onOpen: setCls
  }), tab === "log" && /*#__PURE__*/React.createElement(LogScreen, null), tab === "dog" && /*#__PURE__*/React.createElement(ProfileScreen, null))), cls ? null : /*#__PURE__*/React.createElement(TabBar, {
    tab: tab,
    onTab: go
  }), sheet && cls ? /*#__PURE__*/React.createElement(BookingSheet, {
    cls: cls,
    credits: credits,
    onClose: () => setSheet(false),
    onConfirm: (d, t) => {
      setCredits(c => c - cls.credits);
      setUpNext({
        when: d + " · " + t,
        title: cls.title,
        partner: cls.partner,
        place: cls.place,
        image: cls.image
      });
    }
  }) : null));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Book.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BookScreen({
  onOpen
}) {
  const {
    Chip,
    ClassCard,
    PhotoTile
  } = PK;
  const [day, setDay] = React.useState(0);
  const [disc, setDisc] = React.useState(null);
  const [q, setQ] = React.useState("");
  const list = CLASSES.filter(c => (!disc || c.discipline === disc) && (c.title + c.partner).toLowerCase().includes(q.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "64px 0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "pk-display-xl",
    style: {
      margin: 0
    }
  }, "Book"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(SearchPill, {
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "kit-hscroll",
    style: {
      marginTop: 14
    }
  }, DAYS.map((d, i) => /*#__PURE__*/React.createElement(Chip, {
    key: d,
    selected: day === i,
    onClick: () => setDay(i)
  }, d))), /*#__PURE__*/React.createElement(Section, {
    title: "Disciplines"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10
    }
  }, DISCIPLINES.map(([d, img]) => /*#__PURE__*/React.createElement(PhotoTile, {
    key: d,
    image: PH + img + ".jpg",
    label: d,
    selected: disc === d,
    onClick: () => setDisc(disc === d ? null : d)
  })))), /*#__PURE__*/React.createElement("section", {
    className: "kit-fade",
    key: (disc || "all") + day,
    style: {
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 20px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: 0
    }
  }, disc ? disc + " classes" : "All classes"), disc ? /*#__PURE__*/React.createElement(Chip, {
    onClick: () => setDisc(null),
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "x",
      size: 14
    })
  }, "Clear") : /*#__PURE__*/React.createElement("span", {
    className: "pk-caption pk-muted"
  }, list.length, " this week")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
      padding: "0 20px"
    }
  }, list.length ? list.map(c => /*#__PURE__*/React.createElement(ClassCard, _extends({
    key: c.id,
    layout: "row"
  }, c, {
    onClick: () => onOpen(c)
  }))) : /*#__PURE__*/React.createElement("p", {
    className: "pk-body pk-muted",
    style: {
      margin: 0
    }
  }, "No ", disc ? disc.toLowerCase() : "", " classes match. Try another day."))));
}
window.BookScreen = BookScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Book.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/ClassDetail.jsx
try { (() => {
function ClassDetail({
  cls,
  onBack,
  onBook
}) {
  const {
    Button,
    Tag
  } = PK;
  const full = cls.spotsLeft === 0;
  const cr = cls.credits + (cls.credits === 1 ? " credit" : " credits");
  const facts = [["Duration", cls.duration], ["Intensity", cls.intensity + " of 5"], ["Group", cls.group], ["Spots", full ? "Full" : cls.spotsLeft + " left"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "kit-scroll",
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: "relative",
      height: 460,
      color: "#fff",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: cls.image,
    alt: "",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,rgba(0,0,0,.4) 0%,rgba(0,0,0,0) 24%,rgba(0,0,0,0) 40%,rgba(0,0,0,.72) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 58,
      left: 20,
      right: 20,
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(GlassButton, {
    icon: "chevron-left",
    label: "Back",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(GlassButton, {
    icon: "share",
    label: "Share"
  }), /*#__PURE__*/React.createElement(GlassButton, {
    icon: "bookmark",
    label: "Save"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12
    }
  }, cls.premium ? /*#__PURE__*/React.createElement(Tag, {
    tone: "premium"
  }, "Premium") : null, /*#__PURE__*/React.createElement(Tag, {
    tone: "glass"
  }, cls.discipline), /*#__PURE__*/React.createElement(Tag, {
    tone: "glass"
  }, cr)), /*#__PURE__*/React.createElement("h1", {
    className: "pk-display-xl",
    style: {
      margin: 0
    }
  }, cls.title), /*#__PURE__*/React.createElement("p", {
    className: "pk-label",
    style: {
      margin: "10px 0 0",
      color: "rgba(255,255,255,.85)"
    }
  }, cls.time, " \xB7 ", cls.partner))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "24px 20px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 8
    }
  }, facts.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      background: "var(--surface-raised)",
      borderRadius: 20,
      padding: "12px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pk-caption pk-muted"
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "pk-label",
    style: {
      fontWeight: 600,
      marginTop: 2,
      color: k === "Spots" && cls.spotsLeft <= 1 ? "var(--kennel-red)" : "var(--ink)"
    }
  }, v)))), /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: "32px 0 10px"
    }
  }, "What happens"), /*#__PURE__*/React.createElement("p", {
    className: "pk-body",
    style: {
      margin: 0
    }
  }, cls.about), /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: "32px 0 14px"
    }
  }, "Trainer"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 9999,
      background: "var(--pitch)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 600
    }
  }, "MH"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pk-heading"
  }, "Maren Holt"), /*#__PURE__*/React.createElement("div", {
    className: "pk-caption pk-muted"
  }, "AKC herding judge \xB7 14 years")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    },
    className: "pk-label pk-num"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "star",
    size: 14
  }), "4.9")), /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: "32px 0 14px"
    }
  }, "Location"), /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pk-label",
    style: {
      fontWeight: 600
    }
  }, cls.partner), /*#__PURE__*/React.createElement("div", {
    className: "pk-caption pk-muted"
  }, cls.place, " away \xB7 gravel lot by the gate")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "Directions")), /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: "32px 0 10px"
    }
  }, "Requirements"), /*#__PURE__*/React.createElement("p", {
    className: "pk-body",
    style: {
      margin: 0
    }
  }, "Rabies, DHPP and Bordetella current. 12 months or older. On leash until the trainer releases your dog."))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      padding: "14px 20px 32px",
      background: "var(--bg)",
      boxShadow: "var(--shadow-float)"
    }
  }, full ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "pk-caption",
    style: {
      margin: "0 0 10px",
      color: "var(--kennel-red)"
    }
  }, "This class is full. Join the waitlist or pick another time."), /*#__PURE__*/React.createElement(Button, {
    block: true
  }, "Join waitlist")) : /*#__PURE__*/React.createElement(Button, {
    variant: "signal",
    block: true,
    onClick: onBook
  }, "Book for ", cr)));
}
function BookingSheet({
  cls,
  credits,
  onClose,
  onConfirm
}) {
  const {
    Button,
    Chip
  } = PK;
  const [slot, setSlot] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const short = credits < cls.credits;
  const dayName = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday"
  }[cls.time.split(" ")[0]];
  const slots = [cls.time.split(" ").slice(1).join(" "), "9:00 am", "5:30 pm"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 30,
      background: "rgba(0,0,0,.4)",
      display: "flex",
      alignItems: "flex-end"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "kit-sheet-in",
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      background: "var(--bg)",
      borderRadius: "32px 32px 0 0",
      padding: "10px 20px 34px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 5,
      borderRadius: 9999,
      background: "var(--surface-sunken)",
      margin: "0 auto 18px"
    }
  }), done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 220,
      borderRadius: 28,
      overflow: "hidden",
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: cls.image,
    alt: "",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--scrim)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 18
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "pk-display-xl",
    style: {
      margin: 0
    }
  }, "Booked."), /*#__PURE__*/React.createElement("p", {
    className: "pk-body",
    style: {
      margin: "6px 0 0"
    }
  }, cls.title, ", ", dayName, " ", slots[slot], "."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    style: {
      flex: 1
    }
  }, "Add to calendar"), /*#__PURE__*/React.createElement(Button, {
    style: {
      flex: 1
    },
    onClick: onClose
  }, "Done"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "pk-wide pk-muted",
    style: {
      margin: 0
    }
  }, dayName, " \xB7 ", cls.partner), /*#__PURE__*/React.createElement("h2", {
    className: "pk-display-lg",
    style: {
      margin: "8px 0 0"
    }
  }, cls.title), /*#__PURE__*/React.createElement("p", {
    className: "pk-label",
    style: {
      margin: "22px 0 10px"
    }
  }, "Time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, slots.map((s, i) => /*#__PURE__*/React.createElement(Chip, {
    key: s,
    selected: slot === i,
    onClick: () => setSlot(i)
  }, s))), /*#__PURE__*/React.createElement("p", {
    className: "pk-label",
    style: {
      margin: "20px 0 10px"
    }
  }, "Dog"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    selected: true,
    icon: /*#__PURE__*/React.createElement("img", {
      src: JUNO.photo,
      alt: "",
      style: {
        width: 24,
        height: 24,
        borderRadius: 9999,
        objectFit: "cover",
        marginLeft: -10
      }
    })
  }, "Juno")), /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 22,
      padding: "16px 18px",
      borderRadius: 20
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pk-body"
  }, cls.credits, " ", cls.credits === 1 ? "credit" : "credits"), /*#__PURE__*/React.createElement("span", {
    className: "pk-label pk-num",
    style: {
      color: short ? "var(--kennel-red)" : "var(--ink-muted)"
    }
  }, short ? "You have " + credits + " credits left" : credits - cls.credits + " of 12 left after booking")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, short ? /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    block: true
  }, "Buy more credits") : /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => {
      setDone(true);
      onConfirm(dayName, slots[slot]);
    }
  }, "Confirm booking")))));
}
Object.assign(window, {
  ClassDetail,
  BookingSheet
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/ClassDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Log.jsx
try { (() => {
function LogScreen() {
  const active = {
    2: 1,
    3: 3,
    5: 2,
    8: 3,
    9: 1,
    11: 2,
    12: 3,
    15: 2,
    16: 3,
    18: 1,
    19: 2,
    22: 3,
    23: 2,
    24: 1,
    26: 3,
    27: 2,
    29: 1
  };
  const shade = [null, "color-mix(in oklab, var(--ink) 25%, var(--surface-raised))", "color-mix(in oklab, var(--ink) 55%, var(--surface-raised))", "var(--ink)"];
  const cells = [null].concat(Array.from({
    length: 30
  }, (_, i) => i + 1));
  const sessions = [["Lure Sprint Heats", "Sep 27", "Dev Patel", "Fastest heat yet. Needs a longer warm-up.", "sprint"], ["Herding Fundamentals", "Sep 24", "Maren Holt", "Great recall today, work on waiting at the gate.", "collie"], ["Scent Work 101", "Sep 22", "Ana Ruiz", "Found the target in under a minute on the third search.", "grass"]];
  const miles = [["First herding class", true], ["25 sessions", true], ["1 year with Pack", false], ["50 sessions", false]];
  const stat = (v, l) => /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pk-display-xl pk-num"
  }, v), /*#__PURE__*/React.createElement("div", {
    className: "pk-caption pk-muted",
    style: {
      marginTop: 4
    }
  }, l));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "64px 0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "pk-display-xl",
    style: {
      margin: 0
    }
  }, "Log"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 24
    }
  }, stat(14, "Sessions in Sept"), stat("11.5", "Hours active"), stat(9, "Day streak"))), /*#__PURE__*/React.createElement(Section, {
    title: "September"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 6
    }
  }, ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pk-caption pk-muted",
    style: {
      textAlign: "center"
    }
  }, d)), cells.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      aspectRatio: "1",
      borderRadius: 9999,
      background: d ? shade[active[d]] || "var(--bg)" : "transparent",
      fontSize: 11,
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: active[d] >= 2 ? "var(--bg)" : "var(--ink-muted)",
      boxShadow: d === 29 ? "0 0 0 2px var(--surface-raised), 0 0 0 3.5px var(--agility)" : "none"
    }
  }, d || "")))))), /*#__PURE__*/React.createElement(Section, {
    title: "This week's balance"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: 14,
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "60%",
      borderRadius: 9999,
      background: "var(--ink)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "25%",
      borderRadius: 9999,
      background: "var(--turf)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "15%",
      borderRadius: 9999,
      background: "var(--surface-sunken)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      marginTop: 10
    },
    className: "pk-caption"
  }, /*#__PURE__*/React.createElement("span", null, "Physical 60%"), /*#__PURE__*/React.createElement("span", null, "Mental 25%"), /*#__PURE__*/React.createElement("span", {
    className: "pk-muted"
  }, "Social 15%")), /*#__PURE__*/React.createElement("p", {
    className: "pk-label pk-muted",
    style: {
      margin: "10px 0 0"
    }
  }, "Mostly sprints this week. Add a scent session to balance it out."))), /*#__PURE__*/React.createElement(Section, {
    title: "Milestones"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kit-hscroll"
  }, miles.map(([m, on]) => /*#__PURE__*/React.createElement("div", {
    key: m,
    style: {
      width: 132,
      flex: "none",
      padding: 16,
      borderRadius: 24,
      background: on ? "var(--agility)" : "var(--surface-raised)",
      color: on ? "var(--on-agility)" : "var(--ink-muted)",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: on ? "award" : "lock",
    size: 24
  }), /*#__PURE__*/React.createElement("div", {
    className: "pk-label",
    style: {
      fontWeight: 600,
      marginTop: 28
    }
  }, m))))), /*#__PURE__*/React.createElement(Section, {
    title: "Sessions"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px",
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, sessions.map(([t, d, tr, n, img]) => /*#__PURE__*/React.createElement("div", {
    key: t + d,
    style: {
      display: "flex",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: PH + img + ".jpg",
    alt: "",
    style: {
      width: 56,
      height: 56,
      borderRadius: 16,
      objectFit: "cover",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pk-heading"
  }, t), /*#__PURE__*/React.createElement("span", {
    className: "pk-caption pk-muted",
    style: {
      flex: "none"
    }
  }, d)), /*#__PURE__*/React.createElement("p", {
    className: "pk-caption pk-muted",
    style: {
      margin: "2px 0 6px"
    }
  }, tr), /*#__PURE__*/React.createElement("p", {
    className: "pk-label",
    style: {
      margin: 0
    }
  }, "\"", n, "\"")))))));
}
window.LogScreen = LogScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Log.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Profile.jsx
try { (() => {
function LevelsBack() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 320,
      height: 460,
      borderRadius: 28,
      background: "var(--pitch)",
      color: "#fff",
      padding: "28px 24px",
      boxSizing: "border-box",
      boxShadow: "var(--shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "pk-wide",
    style: {
      margin: 0,
      color: "var(--on-pitch-muted)"
    }
  }, "Juno \xB7 Levels"), /*#__PURE__*/React.createElement("h2", {
    className: "pk-display-xl",
    style: {
      margin: "10px 0 0"
    }
  }, "Five disciplines."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20,
      marginTop: 30
    }
  }, JUNO.levels.map(([d, l, p]) => /*#__PURE__*/React.createElement("div", {
    key: d
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 14,
      lineHeight: "20px",
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", null, d), /*#__PURE__*/React.createElement("span", {
    className: "pk-num",
    style: {
      color: "var(--on-pitch-muted)"
    }
  }, "Level ", l)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 9999,
      background: "rgba(255,255,255,.14)",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: p * 100 + "%",
      height: "100%",
      borderRadius: 9999,
      background: "var(--agility)"
    }
  }))))));
}
function ProfileScreen() {
  const {
    AthleteCard,
    Tag,
    Chip
  } = PK;
  const [flip, setFlip] = React.useState(false);
  const vax = [["Rabies", "Current", "Expires Mar 2028", "neutral"], ["DHPP", "Current", "Expires Jan 2027", "neutral"], ["Bordetella", "Due soon", "Expires Oct 14", "warning"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "60px 0 32px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 20px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    selected: !flip,
    onClick: () => setFlip(false)
  }, "Card"), /*#__PURE__*/React.createElement(Chip, {
    selected: flip,
    onClick: () => setFlip(true)
  }, "Levels")), /*#__PURE__*/React.createElement("button", {
    "aria-label": "Settings",
    style: {
      width: 44,
      height: 44,
      borderRadius: 9999,
      border: 0,
      background: "var(--surface-raised)",
      color: "var(--ink)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: flip ? "b" : "f",
    className: "kit-flip-anim",
    onClick: () => setFlip(f => !f),
    style: {
      cursor: "pointer"
    }
  }, flip ? /*#__PURE__*/React.createElement(LevelsBack, null) : /*#__PURE__*/React.createElement(AthleteCard, JUNO))), /*#__PURE__*/React.createElement(Section, {
    title: "Life stage"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, ["Puppy", "Prime", "Senior"].map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 9999,
      background: s === "Senior" ? "var(--surface-sunken)" : "var(--ink)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "pk-caption",
    style: {
      marginTop: 8,
      fontWeight: s === "Prime" ? 600 : 500,
      color: s === "Prime" ? "var(--ink)" : "var(--ink-muted)"
    }
  }, s)))), /*#__PURE__*/React.createElement("p", {
    className: "pk-label pk-muted",
    style: {
      margin: "10px 0 0"
    }
  }, "Senior starts around age 8. Programming shifts to swim, scent work and slow walks."))), /*#__PURE__*/React.createElement(Section, {
    title: "Health and records"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, vax.map(([n, s, e, t]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pk-label",
    style: {
      fontWeight: 600
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    className: "pk-caption pk-muted"
  }, e)), /*#__PURE__*/React.createElement(Tag, {
    tone: t === "neutral" ? "neutral" : t
  }, s)))), /*#__PURE__*/React.createElement("p", {
    className: "pk-caption pk-muted",
    style: {
      margin: "10px 4px 0"
    }
  }, "Vet: Cedar Animal Clinic \xB7 (555) 014-2290"))), /*#__PURE__*/React.createElement(Section, {
    title: "Temperament"
  }, /*#__PURE__*/React.createElement("p", {
    className: "pk-body",
    style: {
      margin: "0 20px"
    }
  }, "Loves dogs. Working-dog energy. Trainer note: \"Fixates on moving things. Reward the look-away.\"")));
}
window.ProfileScreen = ProfileScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Profile.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Shell.jsx
try { (() => {
const PK = window.PackAthleticClubDesignSystem_ad379b;
const PH = "../../assets/photos/";
const LUCIDE = "https://unpkg.com/lucide-static@0.460.0/icons/";
function Icon({
  name,
  size = 20,
  style
}) {
  const m = "url(" + LUCIDE + name + ".svg) center/contain no-repeat";
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      flex: "none",
      display: "inline-block",
      background: "currentColor",
      WebkitMask: m,
      mask: m,
      ...style
    }
  });
}
const JUNO = {
  name: "Juno",
  photo: PH + "juno.jpg",
  breed: "Border Collie",
  age: "3 yrs",
  stage: "Prime",
  since: 2026,
  streak: 9,
  stats: [{
    value: 42,
    label: "Sessions"
  }, {
    value: 38,
    label: "Hours"
  }, {
    value: 5,
    label: "Disciplines"
  }],
  levels: [["Herding", 2, .55], ["Scent", 1, .3], ["Sprint", 3, .8], ["Agility", 2, .4], ["Behavior", 1, .2]]
};
const DISCIPLINES = [["Herding", "collie"], ["Scent", "grass"], ["Sprint", "sprint"], ["Agility", "weave"], ["Behavior", "hurdle"], ["Free roam", "leap"]];
const CLASSES = [{
  id: "herd",
  discipline: "Herding",
  image: PH + "collie.jpg",
  premium: true,
  title: "Herding Fundamentals",
  partner: "Ridgeline Dog Sport",
  place: "2.4 mi",
  time: "Thu 7:30 am",
  duration: "60 min",
  credits: 3,
  spotsLeft: 1,
  intensity: 4,
  group: "6 dogs",
  about: "Juno works a small flock of ducks on a fenced field with a trainer beside her. The session covers stock awareness, outruns and a calm stop. Owners stay on the field and learn the handling cues. Expect a tired, focused dog."
}, {
  id: "scent",
  discipline: "Scent",
  image: PH + "grass.jpg",
  title: "Scent Work 101",
  partner: "Northside Canine",
  place: "1.1 mi",
  time: "Wed 6:00 pm",
  duration: "45 min",
  credits: 1,
  spotsLeft: 5,
  intensity: 2,
  group: "8 dogs",
  about: "Dogs search boxes and luggage for a single target odor. Each dog works alone while the others rest in crates. Good for sharp, busy dogs who need a mental day."
}, {
  id: "sprint",
  discipline: "Sprint",
  image: PH + "sprint.jpg",
  title: "Lure Sprint Heats",
  partner: "Eastfield Park",
  place: "3.0 mi",
  time: "Sat 9:00 am",
  duration: "40 min",
  credits: 2,
  spotsLeft: 0,
  intensity: 5,
  group: "10 dogs",
  about: "Timed straight-line heats behind a lure on grass. Warm-up and cool-down are included. Times are logged to the dog's profile."
}, {
  id: "agility",
  discipline: "Agility",
  image: PH + "weave.jpg",
  title: "Agility Foundations",
  partner: "Ridgeline Dog Sport",
  place: "2.4 mi",
  time: "Thu 6:00 pm",
  duration: "50 min",
  credits: 2,
  spotsLeft: 4,
  intensity: 3,
  group: "6 dogs",
  about: "Low jumps, tunnels and a first look at weave poles. Handlers work on crosses and a clean start line."
}, {
  id: "behavior",
  discipline: "Behavior",
  image: PH + "hurdle.jpg",
  title: "Focus and Recall",
  partner: "Northside Canine",
  place: "1.1 mi",
  time: "Fri 5:30 pm",
  duration: "45 min",
  credits: 1,
  spotsLeft: 3,
  intensity: 2,
  group: "8 dogs",
  about: "Recall under distraction, a solid stay and loose-leash work between stations. Small group, lots of reps."
}, {
  id: "roam",
  discipline: "Free roam",
  image: PH + "leap.jpg",
  title: "Open Field Session",
  partner: "Eastfield Park",
  place: "3.0 mi",
  time: "Sun 8:00 am",
  duration: "90 min",
  credits: 1,
  spotsLeft: 12,
  intensity: 3,
  group: "Open",
  about: "Fenced ten-acre field with staff on site. Temperament-screened dogs only."
}];
const DAYS = ["Today", "Wed 30", "Thu 1", "Fri 2", "Sat 3", "Sun 4", "Mon 5"];
function Phone({
  children,
  overPhoto
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 390,
      height: 844,
      borderRadius: 52,
      background: "var(--bg)",
      color: "var(--ink)",
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 0 0 10px #0b0c0b, 0 40px 80px -24px rgba(0,0,0,.45)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 30px 0 38px",
      fontWeight: 600,
      fontSize: 16,
      zIndex: 20,
      color: overPhoto ? "#fff" : "var(--ink)",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "signal",
    size: 16
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "wifi",
    size: 16
  }), /*#__PURE__*/React.createElement(Icon, {
    name: "battery-full",
    size: 18
  }))), children);
}
function GlassButton({
  icon,
  label,
  onClick,
  dot,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": label,
    className: "kit-glass",
    style: {
      position: "relative",
      height: 44,
      minWidth: 44,
      padding: children ? "0 16px" : 0,
      border: 0,
      borderRadius: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      cursor: "pointer",
      font: "inherit",
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 20
  }) : null, children, dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 8,
      right: 9,
      width: 9,
      height: 9,
      borderRadius: 9999,
      background: "var(--agility)"
    }
  }) : null);
}
function TabBar({
  tab,
  onTab
}) {
  const items = [["today", "Today", "house"], ["book", "Book", "calendar-search"], ["log", "Log", "activity"], ["dog", "Juno", null]];
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: "none",
      display: "flex",
      justifyContent: "space-around",
      padding: "10px 12px 30px",
      background: "var(--bg)",
      borderTop: "1px solid var(--line)"
    }
  }, items.map(([id, label, icon]) => {
    const on = tab === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => onTab(id),
      style: {
        font: "inherit",
        background: "none",
        border: 0,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        width: 72,
        minHeight: 44,
        color: on ? "var(--ink)" : "var(--ink-faint)"
      }
    }, icon ? /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 25
    }) : /*#__PURE__*/React.createElement("img", {
      src: JUNO.photo,
      alt: "",
      style: {
        width: 26,
        height: 26,
        borderRadius: 9999,
        objectFit: "cover",
        boxShadow: on ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--ink)" : "none",
        opacity: on ? 1 : .7
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        lineHeight: "16px",
        fontWeight: on ? 600 : 500
      }
    }, label));
  }));
}
function Section({
  title,
  action,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      marginTop: 32,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 20px",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    className: "pk-title",
    style: {
      margin: 0
    }
  }, title), action ? /*#__PURE__*/React.createElement("button", {
    onClick: action.onClick,
    "aria-label": action.label,
    style: {
      width: 36,
      height: 36,
      borderRadius: 9999,
      border: 0,
      background: "var(--surface-raised)",
      color: "var(--ink)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 18
  })) : null), children);
}
function Panel({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-raised)",
      borderRadius: 28,
      padding: 20,
      ...style
    }
  }, children);
}
function SearchPill({
  value,
  onChange,
  placeholder = "Search classes, trainers, places"
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 10,
      height: 52,
      padding: "0 18px",
      background: "var(--surface-raised)",
      borderRadius: 9999,
      color: "var(--ink-muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 20
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    style: {
      font: "inherit",
      fontSize: 16,
      border: 0,
      outline: 0,
      background: "none",
      color: "var(--ink)",
      flex: 1,
      minWidth: 0
    }
  }));
}
Object.assign(window, {
  PK,
  PH,
  Icon,
  JUNO,
  DISCIPLINES,
  CLASSES,
  DAYS,
  Phone,
  GlassButton,
  TabBar,
  Section,
  Panel,
  SearchPill
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Shell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/Today.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TodayScreen({
  credits,
  onOpen,
  onTab,
  upNext
}) {
  const {
    ClassCard,
    Button,
    Tag
  } = PK;
  const [checked, setChecked] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 32
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      position: "relative",
      height: 500,
      color: "#fff",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: JUNO.photo,
    alt: "",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "50% 35%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg,rgba(0,0,0,.4) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,0) 45%,rgba(0,0,0,.66) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 58,
      left: 20,
      right: 20,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(GlassButton, {
    label: "Juno",
    onClick: () => onTab("dog"),
    style: {
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      margin: "0 -4px"
    }
  }, "J")), /*#__PURE__*/React.createElement(GlassButton, {
    icon: "map-pin",
    label: "Location"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pk-wide",
    style: {
      fontSize: 12
    }
  }, "Austin \xB7 South")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(GlassButton, {
    icon: "bell",
    label: "Notifications",
    dot: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    tone: "glass"
  }, "Tuesday \xB7 Sep 29"), /*#__PURE__*/React.createElement(Tag, {
    tone: "signal"
  }, JUNO.streak, " day streak")), /*#__PURE__*/React.createElement("h1", {
    className: "pk-display-xl",
    style: {
      margin: 0
    }
  }, "Juno is due for a hard day."))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginTop: -28,
      background: "var(--bg)",
      borderRadius: "32px 32px 0 0",
      paddingTop: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px",
      display: "flex",
      gap: 10
    },
    onClick: () => onTab("book")
  }, /*#__PURE__*/React.createElement(SearchPill, null), /*#__PURE__*/React.createElement("button", {
    "aria-label": "Filters",
    style: {
      width: 52,
      height: 52,
      borderRadius: 9999,
      border: 0,
      background: "var(--surface-raised)",
      color: "var(--ink)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sliders-horizontal",
    size: 20
  }))), /*#__PURE__*/React.createElement(Section, {
    title: "Up next"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, upNext ? /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: upNext.image,
    alt: "",
    style: {
      width: 64,
      height: 64,
      borderRadius: 16,
      objectFit: "cover",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "pk-wide pk-muted",
    style: {
      margin: 0
    }
  }, upNext.when), /*#__PURE__*/React.createElement("h4", {
    className: "pk-display-md",
    style: {
      margin: "5px 0 0"
    }
  }, upNext.title), /*#__PURE__*/React.createElement("p", {
    className: "pk-caption pk-muted",
    style: {
      margin: "4px 0 0"
    }
  }, upNext.partner, " \xB7 ", upNext.place))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "quiet",
    style: {
      flex: 1,
      background: "var(--bg)"
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "navigation",
      size: 16
    })
  }, "Directions"), /*#__PURE__*/React.createElement(Button, {
    style: {
      flex: 1
    },
    onClick: () => setChecked(true),
    disabled: checked
  }, checked ? "Checked in" : "Check in"))) : /*#__PURE__*/React.createElement(Panel, null, /*#__PURE__*/React.createElement("p", {
    className: "pk-body",
    style: {
      margin: 0
    }
  }, "Nothing booked this week. Pick a class to keep Juno's streak going."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => onTab("book")
  }, "Find a class"))))), /*#__PURE__*/React.createElement(Section, {
    title: "Recommended for Juno",
    action: {
      label: "See all",
      onClick: () => onTab("book")
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "kit-hscroll"
  }, CLASSES.slice(0, 4).map(c => /*#__PURE__*/React.createElement(ClassCard, _extends({
    key: c.id
  }, c, {
    onClick: () => onOpen(c)
  }))))), /*#__PURE__*/React.createElement(Section, {
    title: "Credits"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pk-display-2xl pk-num"
  }, credits), /*#__PURE__*/React.createElement("span", {
    className: "pk-heading pk-muted"
  }, "of 12")), /*#__PURE__*/React.createElement("p", {
    className: "pk-caption pk-muted",
    style: {
      margin: "6px 0 0"
    }
  }, "Credits left \xB7 resets Oct 1")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      alignItems: "flex-end",
      height: 56
    }
  }, Array.from({
    length: 12
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 8,
      height: 56,
      borderRadius: 9999,
      background: i < credits ? "var(--ink)" : "var(--surface-sunken)"
    }
  }))))))));
}
window.TodayScreen = TodayScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/Today.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AthleteCard = __ds_scope.AthleteCard;

__ds_ns.ClassCard = __ds_scope.ClassCard;

__ds_ns.PhotoTile = __ds_scope.PhotoTile;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Tag = __ds_scope.Tag;

})();
