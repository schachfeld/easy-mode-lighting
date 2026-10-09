export function connectionUrl(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(
      "Enter a full Home Assistant address, such as http://homeassistant.local:8123.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an http:// or https:// address without credentials, a query, or a fragment.",
    );
  url.pathname = url.pathname.replace(/\/?$/, "/");
  return url.href;
}
export function websocketUrl(input) {
  const url = new URL("api/websocket", connectionUrl(input));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}
