// Inline scripts for <head>. They run synchronously while the HTML is parsed,
// before first paint and before React hydrates. Plain module (no "use client"),
// so the server layout receives real strings.

export const THEME_KEY = "ascendex-theme";

/** Applies a saved dark/light choice before paint, so it never flashes. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// Some hosts and proxies inject a comment into <head> at serve time (one we
// deployed to added a "this site is hosted on..." note after <meta charset>). React hydrates <head>,
// sees a node it never rendered, and throws hydration error #418, re-rendering the
// whole page on the client. React itself puts no comments or whitespace text in
// <head>, so this inline script, which runs before hydration, removes exactly
// those injected nodes.
export const HEAD_CLEANUP = `(function(){try{var h=document.head,n=h.firstChild;while(n){var x=n.nextSibling;if(n.nodeType===8||(n.nodeType===3&&!n.nodeValue.trim()))h.removeChild(n);n=x}}catch(e){}})()`;
