export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const limit = Math.min(
      Math.max(
        parseInt(url.searchParams.get("limit") || "12", 10),
        1
      ),
      24
    );

    const category = url.searchParams.get("category");

    const targetUrl =
      `https://agasobanuyefree.com/movies?page=${page}` +
      (category
        ? `&category=${encodeURIComponent(category)}`
        : "");

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
          "en-US,en;q=0.9"
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
    --------------------------------------------------
    FIND MOVIE LINKS
    --------------------------------------------------
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

      const parsed = new URL(cleanUrl);

      /*
      ONLY allow Agasobanuye FREE
      */

      if (
        parsed.hostname !== "agasobanuyefree.com" &&
        parsed.hostname !== "www.agasobanuyefree.com"
      ) {
        continue;
      }

      /*
      Only movie detail URLs
      */

      const pathParts = parsed.pathname
        .split("/")
        .filter(Boolean);

      if (
        pathParts.length !== 2 ||
        pathParts[0] !== "movies"
      ) {
        continue;
      }

      const slug = pathParts[1];

      if (!slug || seen.has(slug)) {
        continue;
      }

      seen.add(slug);

      /*
      --------------------------------------------------
      TITLE
      --------------------------------------------------
      */

      let title = slug
        .replace(/-by-[^-]+$/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      movies.push({
        id: slug,

        title,

        poster: "",

        summary: "",

        category: "Agasobanuye",

        sourceUrl: cleanUrl,

        watchUrl:
          `${cleanUrl}/watch`,

        server2Url:
          `${cleanUrl}/watch/server/2`
      });

      /*
      Stop collecting after enough movies.
      */

      if (movies.length >= limit) {
        break;
      }
    }

    /*
    --------------------------------------------------
    GET POSTERS + DETAILS
    --------------------------------------------------
    */

    const detailedMovies = await Promise.all(
      movies.map(async (movie) => {

        try {

          const detailResponse = await fetch(
            movie.sourceUrl,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                "Accept":
                  "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8"
              }
            }
          );

          if (!detailResponse.ok) {
            return movie;
          }

          const detailHtml =
            await detailResponse.text();

          /*
          ------------------------------------------------
          FIND POSTER
          ------------------------------------------------
          */

          let poster = "";

          const imageRegex =
            /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;

          let imageMatch;

          const images = [];

          while (
            (imageMatch =
              imageRegex.exec(detailHtml)) !== null
          ) {

            let imageUrl =
              imageMatch[1];

            if (
              !imageUrl ||
              imageUrl.startsWith("data:")
            ) {
              continue;
            }

            imageUrl = new URL(
              imageUrl,
              movie.sourceUrl
            ).href;

            images.push(imageUrl);
          }

          /*
          Prefer images that look like movie posters.
          */

          poster =
            images.find(src =>
              /poster|movie|cover|thumbnail|uploads|storage/i
                .test(src)
            ) ||
            images.find(src =>
              /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)
            ) ||
            "";

          /*
          ------------------------------------------------
          FIND DESCRIPTION
          ------------------------------------------------
          */

          let summary = "";

          const descriptionMatch =
            detailHtml.match(
              /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
            );

          if (descriptionMatch) {
            summary =
              descriptionMatch[1].trim();
          }

          /*
          ------------------------------------------------
          FIND TITLE
          ------------------------------------------------
          */

          const titleMatch =
            detailHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {

            const pageTitle =
              titleMatch[1]
                .replace(/\s+/g, " ")
                .trim();

            if (
              pageTitle &&
              !/agasobanuye/i.test(pageTitle)
            ) {
              movie.title = pageTitle;
            }
          }

          return {
            ...movie,
            poster,
            summary
          };

        } catch (error) {

          console.error(
            `Failed to inspect ${movie.sourceUrl}`,
            error
          );

          return movie;
        }
      })
    );

    /*
    --------------------------------------------------
    RESPONSE
    --------------------------------------------------
    */

    return json({
      success: true,

      source: "Agasobanuye FREE",

      page,

      limit,

      category: category || null,

      count: detailedMovies.length,

      hasNext:
        detailedMovies.length >= limit,

      movies: detailedMovies
    });

  } catch (error) {

    console.error(
      "Agasobanuye function error:",
      error
    );

    return json(
      {
        success: false,
        error: error.message,
        movies: []
      },
      500
    );
  }
};


/*
==================================================
JSON RESPONSE
==================================================
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
