// Applies the saved theme before the first paint, so the page never flashes
// the wrong colors. A plain script, because the native app's content security
// policy does not allow inline ones. Keep in step with src/theme.ts.
try {
  if (localStorage.getItem("glow-theme") === "daylight") {
    document.documentElement.dataset.theme = "daylight";
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", "#f8f7f4");
  }
} catch {}
