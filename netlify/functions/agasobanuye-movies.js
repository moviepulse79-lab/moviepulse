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

    // ==========================================
    // FETCH MOVIE LIST
    // ==========================================

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

      let sourceUrl;

      try {
        sourceUrl = new URL(
          match[1],
          "https://agasobanuyefree.com"
        ).href;
      } catch {
        continue;
      }

      const cleanUrl = sourceUrl
        .split("?")[0]
        .split("#")[0];

      let parsed;

      try {
        parsed = new URL(cleanUrl);
      } catch {
        continue;
      }

      if (
        parsed.hostname !== "agasobanuyefree.com" &&
        parsed.hostname !== "www.agasobanuyefree.com"
      ) {
        continue;
      }

      const parts = parsed.pathname
        .split("/")
        .filter(Boolean);

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

      const title = slug
        .replace(/-by-[^-]+$/i, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      movies.push({
        id: slug,
        title,
        poster: "",
        summary: "",
        category: "Movie",
        duration: "",
        sourceUrl: cleanUrl,
        watchUrl: `${cleanUrl}/watch`,
        server1Url: "",
        server2Url: `${cleanUrl}/watch/server/2`,
        playerUrl: "",
        playerType: ""
      });

      if (movies.length >= limit) {
        break;
      }
    }

    // ==========================================
    // FETCH DETAILS FOR EACH MOVIE
    // ==========================================

    const detailedMovies = await Promise.all(

      movies.map(async movie => {

        try {

          // ======================================
          // FETCH MOVIE DETAIL PAGE
          // ======================================

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

          // ======================================
          // POSTER
          // ======================================

          let poster = "";

          const ogImage =
            detailHtml.match(
              /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
            );

          if (ogImage) {
            poster = ogImage[1];
          }

          if (!poster) {

            const ogImageReverse =
              detailHtml.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
              );

            if (ogImageReverse) {
              poster = ogImageReverse[1];
            }
          }

          if (!poster) {

            const twitterImage =
              detailHtml.match(
                /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
              );

            if (twitterImage) {
              poster = twitterImage[1];
            }
          }

          // Normal images fallback

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

              try {

                possibleImages.push(
                  new URL(
                    imageUrl,
                    movie.sourceUrl
                  ).href
                );

              } catch {}
            }

            poster =
              possibleImages.find(src =>
                /poster|cover|thumbnail/i.test(src)
              ) ||
              possibleImages.find(src =>
                /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src)
              ) ||
              "";
          }

          if (poster) {

            try {
              poster = new URL(
                poster,
                movie.sourceUrl
              ).href;
            } catch {}
          }

          // ======================================
          // SUMMARY
          // ======================================

          let summary = "";

          const description =
            detailHtml.match(
              /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
            );

          if (description) {

            summary =
              description[1]
                .replace(/\s+/g, " ")
                .trim();
          }

          // ======================================
          // REAL TITLE
          // ======================================

          let realTitle = "";

          const h1Match =
            detailHtml.match(
              /<h1[^>]*>([\s\S]*?)<\/h1>/i
            );

          if (h1Match) {

            realTitle =
              h1Match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();
          }

          if (!realTitle) {

            const ogTitle =
              detailHtml.match(
                /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
              );

            if (ogTitle) {
              realTitle =
                ogTitle[1]
                  .replace(/\s+/g, " ")
                  .trim();
            }
          }

          if (!realTitle) {

            const ogTitleReverse =
              detailHtml.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
              );

            if (ogTitleReverse) {
              realTitle =
                ogTitleReverse[1]
                  .replace(/\s+/g, " ")
                  .trim();
            }
          }

          if (!realTitle) {

            const titleMatch =
              detailHtml.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
              );

            if (titleMatch) {

              realTitle =
                titleMatch[1]
                  .replace(/<[^>]+>/g, "")
                  .replace(/\s+/g, " ")
                  .trim();
            }
          }

          // ======================================
          // REMOVE SITE NAME FROM TITLE
          // ======================================

          realTitle =
            realTitle
              .replace(
                /\s*[-|–]\s*Agasobanuye\s*FREE.*$/i,
                ""
              )
              .replace(
                /\s*[-|–]\s*Agasobanuye.*$/i,
                ""
              )
              .replace(
                /\s*\|\s*Agasobanuye.*$/i,
                ""
              )
              .trim();

          if (!realTitle) {
            realTitle =
              movie.title ||
              "Untitled Movie";
          }

          // ======================================
          // CATEGORY
          // ======================================

          let movieCategory = "Movie";

          const categoryMatch =
            detailHtml.match(
              /(?:Genre|Category)[^<]{0,50}<\/[^>]+>\s*<[^>]+>([^<]+)/i
            );

          if (categoryMatch) {

            movieCategory =
              categoryMatch[1]
                .replace(/\s+/g, " ")
                .trim();
          }

          // ======================================
          // DURATION
          // ======================================

          let duration = "";

          const durationMatch =
            detailHtml.match(
              /(?:Duration|Runtime)[^<]{0,100}(\d{1,3}\s*(?:min|mins|minutes|h|hr|hrs))/i
            );

          if (durationMatch) {
            duration =
              durationMatch[1].trim();
          }

          // ======================================
          // PLAYER EXTRACTION
          // SERVER 1 MP4 FIRST
          // SERVER 2 ABYSSPLAYER FALLBACK
          // ======================================

          let playerUrl = "";
          let playerType = "";

          let server1Url = "";
          let server2PlayerUrl = "";

          // ======================================
          // SERVER 1
          // ======================================

          try {

            const server1UrlPage =
              `${movie.sourceUrl}/watch/server/1`;

            const server1Response =
              await fetch(
                server1UrlPage,
                {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                    "Accept":
                      "text/html,application/xhtml+xml,*/*;q=0.8",

                    "Accept-Language":
                      "en-US,en;q=0.9"
                  }
                }
              );

            if (server1Response.ok) {

              const server1Html =
                await server1Response.text();

              // ==================================
              // FIND DIRECT MP4 URL
              // ==================================

              const mp4Matches =
                server1Html.match(
                  /https?:\/\/[^"'\\\s<>]+\.mp4(?:\?[^"'\\\s<>]*)?/gi
                );

              if (
                mp4Matches &&
                mp4Matches.length
              ) {

                for (
                  const foundUrl
                  of mp4Matches
                ) {

                  try {

                    const cleanMp4 =
                      foundUrl
                        .replace(
                          /&amp;/g,
                          "&"
                        )
                        .replace(
                          /\\\//g,
                          "/"
                        );

                    const parsedMp4 =
                      new URL(cleanMp4);

                    const host =
                      parsedMp4.hostname
                        .toLowerCase();

                    if (
                      host ===
                        "media.agasobanuyenow.com" ||
                      host.endsWith(
                        ".agasobanuyenow.com"
                      )
                    ) {

                      server1Url =
                        parsedMp4.href;

                      break;
                    }

                  } catch {}
                }
              }

              // ==================================
              // VIDEO SRC FALLBACK
              // ==================================

              if (!server1Url) {

                const videoMatch =
                  server1Html.match(
                    /<video[^>]+src=["']([^"']+)["']/i
                  );

                if (videoMatch) {

                  try {

                    const videoUrl =
                      new URL(
                        videoMatch[1],
                        server1UrlPage
                      );

                    const host =
                      videoUrl.hostname
                        .toLowerCase();

                    if (
                      host ===
                        "media.agasobanuyenow.com" ||
                      host.endsWith(
                        ".agasobanuyenow.com"
                      )
                    ) {

                      server1Url =
                        videoUrl.href;
                    }

                  } catch {}
                }
              }

              // ==================================
              // SOURCE TAG FALLBACK
              // ==================================

              if (!server1Url) {

                const sourceMatch =
                  server1Html.match(
                    /<source[^>]+src=["']([^"']+\.mp4[^"']*)["']/i
                  );

                if (sourceMatch) {

                  try {

                    const sourceUrl =
                      new URL(
                        sourceMatch[1],
                        server1UrlPage
                      );

                    const host =
                      sourceUrl.hostname
                        .toLowerCase();

                    if (
                      host ===
                        "media.agasobanuyenow.com" ||
                      host.endsWith(
                        ".agasobanuyenow.com"
                      )
                    ) {

                      server1Url =
                        sourceUrl.href;
                    }

                  } catch {}
                }
              }

              // ==================================
              // HTML LINK FALLBACK
              // ==================================

              if (!server1Url) {

                const linkRegex =
                  /href=["']([^"']+\.mp4(?:\?[^"']*)?)["']/gi;

                let linkMatch;

                while (
                  (linkMatch =
                    linkRegex.exec(
                      server1Html
                    )) !== null
                ) {

                  try {

                    const mediaUrl =
                      new URL(
                        linkMatch[1],
                        server1UrlPage
                      );

                    const host =
                      mediaUrl.hostname
                        .toLowerCase();

                    if (
                      host ===
                        "media.agasobanuyenow.com" ||
                      host.endsWith(
                        ".agasobanuyenow.com"
                      )
                    ) {

                      server1Url =
                        mediaUrl.href;

                      break;
                    }

                  } catch {}
                }
              }
            }

          } catch (server1Error) {

            console.error(
              "Server 1 extraction failed:",
              movie.sourceUrl,
              server1Error
            );
          }

          // ======================================
          // SERVER 2 ABYSSPLAYER FALLBACK
          // ======================================

          if (!server1Url) {

            try {

              const playerResponse =
                await fetch(
                  movie.server2Url,
                  {
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                      "Accept":
                        "text/html,application/xhtml+xml,*/*;q=0.8",

                      "Accept-Language":
                        "en-US,en;q=0.9"
                    }
                  }
                );

              if (playerResponse.ok) {

                const playerHtml =
                  await playerResponse.text();

                // ==================================
                // FIND ABYSS IFRAME
                // ==================================

                const iframeRegex =
                  /<iframe[^>]+src=["']([^"']+)["']/gi;

                let iframeMatch;

                while (
                  (iframeMatch =
                    iframeRegex.exec(
                      playerHtml
                    )) !== null
                ) {

                  try {

                    const iframeUrl =
                      new URL(
                        iframeMatch[1],
                        movie.server2Url
                      ).href;

                    const host =
                      new URL(
                        iframeUrl
                      ).hostname
                        .toLowerCase();

                    if (
                      host ===
                        "abyssplayer.com" ||
                      host.endsWith(
                        ".abyssplayer.com"
                      )
                    ) {

                      server2PlayerUrl =
                        iframeUrl;

                      break;
                    }

                  } catch {}
                }

                // ==================================
                // RAW ABYSS URL FALLBACK
                // ==================================

                if (!server2PlayerUrl) {

                  const abyssMatch =
                    playerHtml.match(
                      /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<\s]+/i
                    );

                  if (abyssMatch) {

                    server2PlayerUrl =
                      abyssMatch[0];
                  }
                }
              }

            } catch (playerError) {

              console.error(
                "Server 2 extraction failed:",
                movie.server2Url,
                playerError
              );
            }
          }

          // ======================================
          // CHOOSE PLAYER
          // ======================================

          if (server1Url) {

            playerUrl =
              server1Url;

            playerType =
              "mp4";

          } else if (server2PlayerUrl) {

            playerUrl =
              server2PlayerUrl;

            playerType =
              "iframe";
          }

          // ======================================
          // RETURN COMPLETE MOVIE
          // ======================================

          return {
            ...movie,

            title:
              realTitle,

            poster,

            summary,

            category:
              movieCategory,

            duration,

            playerUrl,

            playerType,

            server1Url,

            server2PlayerUrl
          };

        } catch (error) {

          console.error(
            "Movie detail error:",
            movie.sourceUrl,
            error
          );

          return movie;
        }

      })

    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return json({
      success: true,

      source:
        "Agasobanuye FREE",

      page,

      limit,

      category:
        category || null,

      count:
        detailedMovies.length,

      hasNext:
        detailedMovies.length >= limit,

      movies:
        detailedMovies
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
          error.message,

        movies: []
      },
      500
    );
  }
};


// ==========================================
// JSON RESPONSE
// ==========================================

function json(
  data,
  status = 200
) {

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
