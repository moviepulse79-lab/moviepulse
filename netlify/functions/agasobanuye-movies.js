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

    // ==========================================
    // FIND MOVIE LINKS
    // ==========================================

    const hrefRegex =
      /href=["']([^"']*\/movies\/[^"'?#]+)["']/gi;

    let match;

    while ((match = hrefRegex.exec(html)) !== null) {

      const sourceUrl = new URL(
        match[1],
        "https://agasobanuyefree.com"
      ).href;

      const cleanUrl = sourceUrl
        .split("?")[0]
        .split("#")[0];

      const parsed = new URL(cleanUrl);

      // Only Agasobanuye FREE
      if (
        parsed.hostname !== "agasobanuyefree.com" &&
        parsed.hostname !== "www.agasobanuyefree.com"
      ) {
        continue;
      }

      const parts = parsed.pathname
        .split("/")
        .filter(Boolean);

      // Must be /movies/slug
      if (
        parts.length !== 2 ||
        parts[0] !== "movies"
      ) {
        continue;
      }

      const slug = parts[1];

      if (!slug || seen.has(slug)) {
        continue;
      }

      seen.add(slug);

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
        duration: "",

        sourceUrl: cleanUrl,

        watchUrl:
          `${cleanUrl}/watch`,

        server2Url:
          `${cleanUrl}/watch/server/2`
      });

      if (movies.length >= limit) {
        break;
      }
    }

    // ==========================================
    // FETCH MOVIE DETAILS
    // ==========================================

    const detailedMovies = await Promise.all(
      movies.map(async movie => {

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

          // ========================================
          // POSTER
          // ========================================

          let poster = "";

          // 1. Open Graph image
          const ogImage =
            detailHtml.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            );

          if (ogImage) {
            poster = ogImage[1];
          }

          // 2. Reverse attribute order
          if (!poster) {

            const ogImageReverse =
              detailHtml.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
              );

            if (ogImageReverse) {
              poster = ogImageReverse[1];
            }
          }

          // 3. Twitter image
          if (!poster) {

            const twitterImage =
              detailHtml.match(
                /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
              );

            if (twitterImage) {
              poster = twitterImage[1];
            }
          }

          // 4. JSON-LD image
          if (!poster) {

            const jsonLdMatches =
              detailHtml.match(
                /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
              );

            if (jsonLdMatches) {

              for (const block of jsonLdMatches) {

                try {

                  const jsonText =
                    block
                      .replace(
                        /<script[^>]*>/i,
                        ""
                      )
                      .replace(
                        /<\/script>/i,
                        ""
                      )
                      .trim();

                  const json =
                    JSON.parse(jsonText);

                  if (
                    json &&
                    typeof json.image === "string"
                  ) {
                    poster = json.image;
                    break;
                  }

                  if (
                    json &&
                    Array.isArray(json.image) &&
                    json.image.length
                  ) {
                    poster = json.image[0];
                    break;
                  }

                } catch {
                  // Ignore invalid JSON-LD
                }
              }
            }
          }

          // 5. Normal images
          if (!poster) {

            const imageRegex =
              /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;

            let imageMatch;

            const possibleImages = [];

            while (
              (imageMatch =
                imageRegex.exec(detailHtml)) !== null
            ) {

              const imageUrl =
                imageMatch[1];

              if (
                !imageUrl ||
                imageUrl.startsWith("data:")
              ) {
                continue;
              }

              possibleImages.push(
                new URL(
                  imageUrl,
                  movie.sourceUrl
                ).href
              );
            }

            poster =
              possibleImages.find(src =>
                /poster|cover|thumbnail|movie/i.test(src)
              ) ||
              possibleImages.find(src =>
                /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)
              ) ||
              "";
          }

          // Make poster absolute
          if (poster) {
            poster = new URL(
              poster,
              movie.sourceUrl
            ).href;
          }

          // ========================================
          // DESCRIPTION
          // ========================================

          let summary = "";

          const description =
            detailHtml.match(
              /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
            );

          if (description) {
            summary =
              description[1].trim();
          }

          // ========================================
          // TITLE
          // ========================================

          const titleMatch =
            detailHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {

            let pageTitle =
              titleMatch[1]
                .replace(/\s+/g, " ")
                .trim();

            // Remove site name
            pageTitle =
              pageTitle
                .replace(
                  /\s*[-|–]\s*Agasobanuye.*$/i,
                  ""
                )
                .trim();

            if (pageTitle) {
              movie.title = pageTitle;
            }
          }

          // ========================================
          // CATEGORY
          // ========================================

          const categoryMatch =
            detailHtml.match(
              /(?:Genre|Category)[^<]{0,50}<\/[^>]+>\s*<[^>]+>([^<]+)/i
            );

          if (categoryMatch) {
            movie.category =
              categoryMatch[1].trim();
          }

          return {
            ...movie,
            poster,
            summary
          };

        } catch (error) {

          console.error(
            "Movie detail error:",
            movie.sourceUrl,
            error
          );


          // -----------------------------------------
// GET REAL ABYSSPLAYER EMBED URL
// -----------------------------------------

let playerUrl = "";

try {
    const server2Response = await fetch(
        movie.server2Url,
        {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,*/*;q=0.8"
            }
        }
    );

    if (server2Response.ok) {

        const server2Html =
            await server2Response.text();

        const iframeRegex =
            /<iframe[^>]+src=["']([^"']+)["']/gi;

        let iframeMatch;

        while (
            (iframeMatch =
                iframeRegex.exec(server2Html)) !== null
        ) {

            try {

                const iframeUrl =
                    new URL(
                        iframeMatch[1],
                        movie.server2Url
                    ).href;

                const iframeHost =
                    new URL(iframeUrl).hostname;

                if (
                    iframeHost === "abyssplayer.com" ||
                    iframeHost.endsWith(".abyssplayer.com")
                ) {
                    playerUrl = iframeUrl;
                    break;
                }

            } catch {}
        }
    }

} catch (error) {

    console.error(
        "Player extraction failed:",
        movie.sourceUrl,
        error
    );
}

          return movie;
        }
      })
    );

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


// ==========================================
// JSON
// ==========================================

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
