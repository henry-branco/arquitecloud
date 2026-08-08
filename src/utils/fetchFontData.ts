export async function fetchFontData(url: string | URL): Promise<ArrayBuffer> {
  const target = new URL(url);
  // Astro's SSG build server binds to :: and mints URLs with that host.
  // Amplify's build container has no IPv6, so fetching :: fails with
  // EADDRNOTAVAIL. Point at the dual-stack socket via IPv4 loopback instead.
  if (
    target.hostname === "::" ||
    target.hostname === "[::]" ||
    target.hostname === ""
  ) {
    target.hostname = "127.0.0.1";
  }
  const res = await fetch(target);
  return res.arrayBuffer();
}
