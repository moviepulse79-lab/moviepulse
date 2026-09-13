export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const category = url.searchParams.get("category");

    let targetUrl = `https://agasobanuyefree.com/movies?page=${page}`;

    if (category) {
      targetUrl += `&category=${encodeURIComponent(category)}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`Agasobanuye FREE returned ${response.status}`);
    }

    const html = await response.text();

    const movies = [];
    const seen = new Set();

    /*
      Find movie detail URLs.

      We deliberately exclude:
      /watch
      /watch/server
      download links
      category/search links
    */

    const hrefRegex =
      /href=["']([^"']*\/movies\/[^"'?#]+)["']/gi;

    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      let href = match[1];

      const sourceUrl = new URL(
        href,
        "https://agasobanuyefree.com"
      ).href;

      const cleanUrl = sourceUrl
        .split("?")[0]
        .split("#")[0];

      if (
        cleanUrl.includes("/watch") ||
        cleanUrl.includes("/category") ||
        cleanUrl.includes("/search")
      ) {
        continue;
      }

      if (seen.has(cleanUrl)) continue;

      seen.add(cleanUrl);

      /*
        Extract the movie slug.
        Example:
        /movies/dc-by-perfect
      */

      const parts = new URL(cleanUrl).pathname
        .split("/")
        .filter(Boolean);

      const slug = parts[parts.length - 1];

      if (!slug || slug === "movies") continue;

      movies.push({
        id: slug,
        title: slug
          .replace(/-by-[^-]+$/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase()),

        sourceUrl: cleanUrl,

        /*
          Official Agasobanuye watch page.
          We use their own player route rather than
          extracting/bypassing the underlying video file.
        */
        watchUrl: `${cleanUrl}/watch`,

        /*
          Server 2 is the AbyssPlayer route we tested.
        */
        server2Url: `${cleanUrl}/watch/server/2`
      });
    }

    return json({
      success: true,
      source: "Agasobanuye FREE",
      page,
      category: category || null,
      count: movies.length,
      movies
    });

  } catch (error) {
    console.error("Agasobanuye function error:", error);

    return json(
      {
        success: false,
        error: error.message
      },
      500
    );
  }
};


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      }
    }
  );
}
