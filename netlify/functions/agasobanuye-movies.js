export default async (req) => {
  try {
    const requestUrl = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(requestUrl.searchParams.get("page") || "1", 10)
    );

    const limit = Math.min(
      Math.max(
        parseInt(requestUrl.searchParams.get("limit") || "12", 10),
        1
      ),
      50
    );

    const category = requestUrl.searchParams.get("category");

    let targetUrl = `https://agasobanuyefree.com/movies?page=${page}`;

    if (category) {
      targetUrl += `&category=${encodeURIComponent(category)}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Agasobanuye FREE returned ${response.status}`
      );
    }

    const html = await response.text();

    const movies = [];
    const seen = new Set();

    /*
      Find movie detail URLs.
    */
    const hrefRegex =
      /href=["']([^"']*\/movies\/[^"'?#]+)["']/gi;

    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      let href = match[1];

      let sourceUrl;

      try {
        sourceUrl = new URL(
          href,
          "https://agasobanuyefree.com"
        );
      } catch {
        continue;
      }

      /*
        Only accept Agasobanuye FREE URLs.
      */
      if (
        sourceUrl.hostname !== "agasobanuyefree.com" &&
        sourceUrl.hostname !== "www.agasobanuyefree.com"
      ) {
        continue;
      }

      const cleanUrl =
        `${sourceUrl.origin}${sourceUrl.pathname}`;

      /*
        Ignore watch/server/category/search routes.
      */
      if (
        cleanUrl.includes("/watch") ||
        cleanUrl.includes("/category") ||
        cleanUrl.includes("/search")
      ) {
        continue;
      }

      const parts = sourceUrl.pathname
        .split("/")
        .filter(Boolean);

      if (
        parts.length !== 2 ||
        parts[0] !== "movies"
      ) {
        continue;
      }

      const slug = parts[1];

      if (!slug || slug === "movies") {
        continue;
      }

      if (seen.has(slug)) {
        continue;
      }

      seen.add(slug);

      /*
        Convert slug into a readable title.
        Example:
        dc-by-perfect
        →
        DC
      */
      let title = slug
        .replace(/-by-[^-]+$/i, "")
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      title = title
        .split(" ")
        .map(word => {
          if (word.length <= 3) {
            return word.toUpperCase();
          }

          return (
            word.charAt(0).toUpperCase() +
            word.slice(1)
          );
        })
        .join(" ");

      movies.push({
        id: slug,

        title,

        sourceUrl: cleanUrl,

        watchUrl:
          `${cleanUrl}/watch`,

        server2Url:
          `${cleanUrl}/watch/server/2`
      });
    }

    /*
      Remove duplicates and apply the requested limit.
    */
    const limitedMovies =
      movies.slice(0, limit);

    /*
      If the source returned a full batch,
      there may be another page.
    */
    const hasNext =
      movies.length >= limit;

    return json({
      success: true,

      source: "Agasobanuye FREE",

      page,

      limit,

      category: category || null,

      count: limitedMovies.length,

      hasNext,

      movies: limitedMovies
    });

  } catch (error) {
    console.error(
      "Agasobanuye function error:",
      error
    );

    return json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to fetch Agasobanuye movies"
      },
      500
    );
  }
};


/*
  JSON response helper
*/
function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "public, max-age=300"
      }
    }
  );
}
