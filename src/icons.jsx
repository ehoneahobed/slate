// Minimal, consistent 1.6px-stroke line icons. All 20x20, currentColor.
const Ic = ({d, s=1.6, children, size=18, fill="none"}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill={fill} stroke="currentColor"
       strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d ? <path d={d}/> : children}
  </svg>
);

const Icons = {
  Pen:        (p)=> <Ic {...p} d="M3 17l1.2-4 9.5-9.5a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L7 15.8 3 17zM12 5l3 3"/>,
  Highlight:  (p)=> <Ic {...p}><path d="M5 14l5-5 5 5-3 3H8l-3-3z"/><path d="M10 9l3-3 2 2-3 3"/><path d="M4 18h6"/></Ic>,
  Eraser:     (p)=> <Ic {...p}><path d="M3 14l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 17H6l-3-3z"/><path d="M9 9l5 5"/></Ic>,
  Lasso:      (p)=> <Ic {...p}><path d="M4 7c0-2 3-3.5 6-3.5s6 1.5 6 3.5-3 3.5-6 3.5"/><path d="M7 10c-1.5 1-1.5 3 0 4"/><circle cx="7.2" cy="15" r="1.2"/></Ic>,
  Shapes:     (p)=> <Ic {...p}><circle cx="7" cy="7" r="3.2"/><rect x="10.5" y="10.5" width="6" height="6" rx="1"/></Ic>,
  Text:       (p)=> <Ic {...p} d="M5 5h10M10 5v11M7.5 16h5"/>,
  Image:      (p)=> <Ic {...p}><rect x="3" y="4" width="14" height="12" rx="1.5"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="M4 14l4-4 3 3 3-3 2 2"/></Ic>,
  Media:      (p)=> <Ic {...p}><rect x="3" y="4.5" width="14" height="11" rx="1.5"/><path d="M9 8.5v3.5l3-1.75z" fill="currentColor"/></Ic>,
  Pdf:        (p)=> <Ic {...p}><path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/><path d="M7.5 13v-3H9a1 1 0 0 1 0 2H7.5M12 10v3m0-3h1.6M12 11.5h1.2"/></Ic>,
  Math:       (p)=> <Ic {...p}><path d="M4 7l2 6 3-10 2 8 2-4 3 4"/></Ic>,
  Code:       (p)=> <Ic {...p} d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12"/>,
  Ruler:      (p)=> <Ic {...p}><rect x="3" y="7" width="14" height="6" rx="1" transform="rotate(-20 10 10)"/><path d="M5.5 9.2l.8-.5M8 8l.8-.5M10.5 6.8l.8-.5M13 5.6l.8-.5"/></Ic>,
  Laser:      (p)=> <Ic {...p}><circle cx="10" cy="10" r="2"/><path d="M10 4v2M10 14v2M4 10h2M14 10h2M5.6 5.6l1.4 1.4M13 13l1.4 1.4M5.6 14.4L7 13M13 7l1.4-1.4"/></Ic>,
  Bucket:     (p)=> <Ic {...p}><path d="M6 3l8 8-5 5a2 2 0 0 1-2.8 0L3 13a2 2 0 0 1 0-2.8L6 3z"/><path d="M16 14s2 2.2 2 3.5a2 2 0 1 1-4 0c0-1.3 2-3.5 2-3.5z" fill="currentColor" stroke="none"/></Ic>,
  StickyNote: (p)=> <Ic {...p}><path d="M4 4h12v9l-3 3H4z"/><path d="M13 16v-3h3"/></Ic>,
  Link:       (p)=> <Ic {...p}><path d="M8 12l4-4M7 7L5 9a3 3 0 0 0 4.2 4.2L10 13M13 13l2-2a3 3 0 0 0-4.2-4.2L10 7"/></Ic>,
  Table:      (p)=> <Ic {...p}><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 9h14M3 13h14M9 4v12"/></Ic>,
  Youtube:    (p)=> <Ic {...p}><rect x="2.5" y="5" width="15" height="10" rx="2.5"/><path d="M9 8.2v3.6l3.2-1.8z" fill="currentColor"/></Ic>,
  Mic:        (p)=> <Ic {...p}><rect x="8" y="3" width="4" height="9" rx="2"/><path d="M5 10a5 5 0 0 0 10 0M10 15v3M7.5 18h5"/></Ic>,

  ChevronR:   (p)=> <Ic {...p} d="M8 5l5 5-5 5"/>,
  ChevronD:   (p)=> <Ic {...p} d="M5 8l5 5 5-5"/>,
  Plus:       (p)=> <Ic {...p} d="M10 4v12M4 10h12"/>,
  Search:     (p)=> <Ic {...p}><circle cx="9" cy="9" r="5"/><path d="M13 13l4 4"/></Ic>,
  Book:       (p)=> <Ic {...p}><path d="M4 4h5a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H4z"/><path d="M16 4h-5a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h5z"/></Ic>,
  Folder:     (p)=> <Ic {...p}><path d="M3 6a1 1 0 0 1 1-1h3l2 2h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></Ic>,
  Page:       (p)=> <Ic {...p}><path d="M5 3h7l3 3v11H5z"/><path d="M12 3v3h3"/></Ic>,
  Grid:       (p)=> <Ic {...p}><rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/></Ic>,
  Ruled:      (p)=> <Ic {...p} d="M4 5h12M4 9h12M4 13h12M4 17h12"/>,
  Dot:        (p)=> <Ic {...p} fill="currentColor" s={0}><circle cx="5" cy="5" r="1"/><circle cx="10" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="5" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><circle cx="5" cy="15" r="1"/><circle cx="10" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></Ic>,
  Blank:      (p)=> <Ic {...p}><rect x="4" y="3" width="12" height="14" rx="1"/></Ic>,
  Share:      (p)=> <Ic {...p}><circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><path d="M6.8 9l6.4-3M6.8 11l6.4 3"/></Ic>,
  Sparkles:   (p)=> <Ic {...p}><path d="M10 3l1.2 3.2L14 7.5 11.2 8.8 10 12 8.8 8.8 6 7.5l2.8-1.3z"/><path d="M16 12l.7 1.8L18.5 14l-1.8.7L16 16.5l-.7-1.8L13.5 14l1.8-.7z"/></Ic>,
  Close:      (p)=> <Ic {...p} d="M5 5l10 10M15 5L5 15"/>,
  More:       (p)=> <Ic {...p} fill="currentColor" s={0}><circle cx="5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15" cy="10" r="1.4"/></Ic>,
  Play:       (p)=> <Ic {...p} fill="currentColor" s={0}><path d="M6 4l10 6-10 6z"/></Ic>,
  Eye:        (p)=> <Ic {...p}><path d="M2.5 10s3-5 7.5-5 7.5 5 7.5 5-3 5-7.5 5S2.5 10 2.5 10z"/><circle cx="10" cy="10" r="2"/></Ic>,
  Check:      (p)=> <Ic {...p} d="M4 10l4 4 8-8"/>,
  Download:   (p)=> <Ic {...p} d="M10 3v10M5 10l5 5 5-5M4 17h12"/>,
  Copy:       (p)=> <Ic {...p}><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/></Ic>,
  Lock:       (p)=> <Ic {...p}><rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></Ic>,
  Globe:      (p)=> <Ic {...p}><circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2.5 2.5 2.5 11.5 0 14M10 3c-2.5 2.5-2.5 11.5 0 14"/></Ic>,
  Users:      (p)=> <Ic {...p}><circle cx="7" cy="7" r="2.5"/><path d="M2.5 16c0-2.5 2-4.5 4.5-4.5S11.5 13.5 11.5 16"/><circle cx="14" cy="8.5" r="2"/><path d="M12.5 16c0-2 1.5-3.5 3.5-3.5s3 1.2 3 3"/></Ic>,
  ArrowL:     (p)=> <Ic {...p} d="M12 5l-5 5 5 5M7 10h10"/>,
  Home:       (p)=> <Ic {...p} d="M3 10l7-6 7 6v7h-4v-5H7v5H3z"/>,
  Gear:       (p)=> <Ic {...p}><circle cx="10" cy="10" r="2.2"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4"/></Ic>,
  Palette:    (p)=> <Ic {...p}><path d="M10 3a7 7 0 0 0 0 14c1.5 0 2-1 2-2s-1-1.5 0-2.5 5-.2 5-3.5a6 6 0 0 0-7-6z"/><circle cx="6.5" cy="8.5" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="6" r=".8" fill="currentColor" stroke="none"/><circle cx="13.5" cy="8.5" r=".8" fill="currentColor" stroke="none"/></Ic>,
  Undo:       (p)=> <Ic {...p} d="M7 7l-3 3 3 3M4 10h8a4 4 0 0 1 0 8"/>,
  Redo:       (p)=> <Ic {...p} d="M13 7l3 3-3 3M16 10H8a4 4 0 0 0 0 8"/>,
  Menu:       (p)=> <Ic {...p} d="M3 6h14M3 10h14M3 14h14"/>,
  Drag:       (p)=> <Ic {...p} fill="currentColor" s={0}><circle cx="8" cy="5" r="1.1"/><circle cx="12" cy="5" r="1.1"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="10" r="1.1"/><circle cx="8" cy="15" r="1.1"/><circle cx="12" cy="15" r="1.1"/></Ic>,
  Pin:        (p)=> <Ic {...p} d="M10 3l3 3-1 1 1 4-3-1-2 5-2-5-3 1 1-4-1-1 3-3z"/>,
  Star:       (p)=> <Ic {...p} d="M10 3l2.2 4.5 5 .7-3.6 3.5.9 5L10 14.5 5.5 16.7l.9-5L2.8 8.2l5-.7z"/>,
  Clock:      (p)=> <Ic {...p}><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></Ic>,
  Trash:      (p)=> <Ic {...p} d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11M9 9v6M11 9v6"/>,
};

window.Icons = Icons;
