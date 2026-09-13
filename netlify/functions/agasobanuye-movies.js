export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(
        url.searchParams.get("page") || "1",
        10
      )
    );

    const limit = Math.min(
      Math.max(
        parseInt(
          url.searchParams.get("limit") || "12",
          10
        ),
        1
      ),
      24
    );

    const category =
      url.searchParams.get("category");

    const targetUrl =
      `https://agasobanuyefree.com/movies?page=${page}` +
      (
        category
          ? `&category=${encodeURIComponent(category)}`
          : ""
      );

    const response = await fetch(
      targetUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language":
            "en-US,en;q=0.9"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Agasobanuye FREE returned ${response.status}`
      );
    }

    const html =
      await response.text();

    const movies = [];
    const seen = new Set();

    const hrefRegex =
      /href=["']([^"']*\/movies\/[^"'?#]+)["']/gi;

    let match;

    while (
      (match = hrefRegex.exec(html)) !== null
    ) {

      let sourceUrl;

      try {
        sourceUrl = new URL(
          match[1],
          "https://agasobanuyefree.com"
        ).href;
      } catch {
        continue;
      }

      const cleanUrl =
        sourceUrl
          .split("?")[0]
          .split("#")[0];

      let parsed;

      try {
        parsed = new URL(cleanUrl);
      } catch {
        continue;
      }

      if (
        parsed.hostname !==
          "agasobanuyefree.com" &&
        parsed.hostname !==
          "www.agasobanuyefree.com"
      ) {
        continue;
      }

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      if (
        parts.length !== 2 ||
        parts[0] !== "movies"
      ) {
        continue;
      }

      const slug = parts[1];

      if (
        !slug ||
        seen.has(slug)
      ) {
        continue;
      }

      seen.add(slug);

      const title =
        slug
          .replace(
            /-by-[^-]+$/i,
            ""
          )
          .replace(
            /-/g,
            " "
          )
          .replace(
            /\b\w/g,
            c => c.toUpperCase()
          );

      movies.push({
        id: slug,
        title,
        poster: "",
        summary: "",
        category: "Movie",
        duration: "",
        sourceUrl: cleanUrl,

        watchUrl:
          `${cleanUrl}/watch`,

        server1Url:
          `${cleanUrl}/watch/server/1`,

        server2Url:
          `${cleanUrl}/watch/server/2`,

        playerUrl: "",
        playerType: ""
      });

      if (
        movies.length >= limit
      ) {
        break;
      }
    }

    /*
    ==========================================================
    PROCESS MOVIE DETAILS
    ==========================================================
    */

    const detailedMovies =
      await Promise.all(
        movies.map(
          async movie => {

            try {

              /*
              ==================================================
              MOVIE DETAIL PAGE
              ==================================================
              */

              const detailResponse =
                await fetch(
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

              if (
                !detailResponse.ok
              ) {
                return movie;
              }

              const detailHtml =
                await detailResponse.text();


              /*
              ==================================================
              POSTER
              ==================================================
              */

              let poster = "";

              const ogImage =
                detailHtml.match(
                  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
                );

              if (ogImage) {
                poster =
                  ogImage[1];
              }

              if (!poster) {

                const ogImageReverse =
                  detailHtml.match(
                    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
                  );

                if (ogImageReverse) {
                  poster =
                    ogImageReverse[1];
                }
              }

              if (!poster) {

                const twitterImage =
                  detailHtml.match(
                    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
                  );

                if (twitterImage) {
                  poster =
                    twitterImage[1];
                }
              }

              if (!poster) {

                const imageRegex =
                  /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;

                let imageMatch;

                const possibleImages = [];

                while (
                  (imageMatch =
                    imageRegex.exec(
                      detailHtml
                    )) !== null
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
                  possibleImages.find(
                    src =>
                      /poster|cover|thumbnail/i.test(
                        src
                      )
                  ) ||
                  possibleImages.find(
                    src =>
                      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(
                        src
                      )
                  ) ||
                  "";
              }

              if (poster) {

                try {

                  poster =
                    new URL(
                      poster,
                      movie.sourceUrl
                    ).href;

                } catch {}
              }


              /*
              ==================================================
              DESCRIPTION
              ==================================================
              */

              let summary = "";

              const description =
                detailHtml.match(
                  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
                );

              if (description) {

                summary =
                  description[1]
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim();
              }


              /*
              ==================================================
              TITLE
              ==================================================
              */

              let realTitle = "";

              const h1Match =
                detailHtml.match(
                  /<h1[^>]*>([\s\S]*?)<\/h1>/i
                );

              if (h1Match) {

                realTitle =
                  h1Match[1]
                    .replace(
                      /<[^>]+>/g,
                      ""
                    )
                    .replace(
                      /\s+/g,
                      " "
                    )
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
                      .replace(
                        /\s+/g,
                        " "
                      )
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
                      .replace(
                        /\s+/g,
                        " "
                      )
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
                      .replace(
                        /<[^>]+>/g,
                        ""
                      )
                      .replace(
                        /\s+/g,
                        " "
                      )
                      .trim();
                }
              }

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


              /*
              ==================================================
              CATEGORY
              ==================================================
              */

              let movieCategory =
                "Movie";

              const categoryMatch =
                detailHtml.match(
                  /(?:Genre|Category)[^<]{0,50}<\/[^>]+>\s*<[^>]+>([^<]+)/i
                );

              if (categoryMatch) {

                movieCategory =
                  categoryMatch[1]
                    .replace(
                      /\s+/g,
                      " "
                    )
                    .trim();
              }


              /*
              ==================================================
              DURATION
              ==================================================
              */

              let duration = "";

              const durationMatch =
                detailHtml.match(
                  /(?:Duration|Runtime)[^<]{0,100}(\d{1,3}\s*(?:min|mins|minutes|h|hr|hrs))/i
                );

              if (durationMatch) {

                duration =
                  durationMatch[1]
                    .trim();
              }


              /*
              ==================================================
              PLAYER VARIABLES
              ==================================================
              */

              let playerUrl = "";
              let playerType = "";

              let server1VideoUrl = "";
              let server2PlayerUrl = "";


              /*
              ==================================================
              HELPER:
              VALIDATE A REAL STREAM URL
              ==================================================
              */

              function isValidStreamUrl(
                value
              ) {

                if (!value) {
                  return false;
                }

                let decoded =
                  value
                    .replace(
                      /&amp;/g,
                      "&"
                    )
                    .replace(
                      /\\\//g,
                      "/"
                    )
                    .trim();

                if (
                  decoded.startsWith(
                    "//"
                  )
                ) {
                  decoded =
                    "https:" +
                    decoded;
                }

                let parsedUrl;

                try {

                  parsedUrl =
                    new URL(
                      decoded
                    );

                } catch {

                  return false;
                }

                const hostname =
                  parsedUrl.hostname
                    .toLowerCase();

                /*
                IMPORTANT:
                Never use Agasobanuye
                download URLs.
                */

                if (
                  parsedUrl.pathname
                    .toLowerCase()
                    .includes(
                      "/download/"
                    )
                ) {
                  return false;
                }

                /*
                Only accept the
                known media host.
                */

                if (
                  hostname !==
                    "media.agasobanuyenow.com" &&
                  !hostname.endsWith(
                    ".agasobanuyenow.com"
                  )
                ) {
                  return false;
                }

                /*
                Must look like a
                video file.
                */

                if (
                  !/\.(mp4|m3u8)(\?|$)/i.test(
                    parsedUrl.pathname
                  )
                ) {
                  return false;
                }

                return parsedUrl.href;
              }


              /*
              ==================================================
              1. FETCH THE PUBLIC WATCH PAGE
              ==================================================
              */

              try {

                const watchResponse =
                  await fetch(
                    movie.watchUrl,
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

                if (
                  watchResponse.ok
                ) {

                  const watchHtml =
                    await watchResponse.text();


                  /*
                  ----------------------------------------------
                  A. Look specifically for:
                     Video url:
                  ----------------------------------------------
                  */

                  const videoUrlPatterns = [

                    /Video\s*url\s*:\s*["']([^"']+)["']/i,

                    /Video\s*url\s*:\s*([^<\s"'\\]+)/i,

                    /video\s*url[^:]*:\s*["']([^"']+)["']/i,

                    /["']videoUrl["']\s*:\s*["']([^"']+)["']/i,

                    /["']video_url["']\s*:\s*["']([^"']+)["']/i,

                    /["']url["']\s*:\s*["'](https?:\/\/[^"']+\.mp4[^"']*)["']/i

                  ];


                  for (
                    const pattern
                    of videoUrlPatterns
                  ) {

                    const found =
                      watchHtml.match(
                        pattern
                      );

                    if (
                      found &&
                      found[1]
                    ) {

                      const valid =
                        isValidStreamUrl(
                          found[1]
                        );

                      if (valid) {

                        server1VideoUrl =
                          valid;

                        break;
                      }
                    }
                  }


                  /*
                  ----------------------------------------------
                  B. Look inside video/source tags
                  ----------------------------------------------
                  */

                  if (
                    !server1VideoUrl
                  ) {

                    const sourcePatterns = [

                      /<video[^>]+src=["']([^"']+)["']/gi,

                      /<source[^>]+src=["']([^"']+)["']/gi,

                      /<video[\s\S]{0,3000}?src=["']([^"']+)["']/gi

                    ];

                    for (
                      const pattern
                      of sourcePatterns
                    ) {

                      let sourceMatch;

                      while (
                        (
                          sourceMatch =
                            pattern.exec(
                              watchHtml
                            )
                        ) !== null
                      ) {

                        const valid =
                          isValidStreamUrl(
                            sourceMatch[1]
                          );

                        if (valid) {

                          server1VideoUrl =
                            valid;

                          break;
                        }
                      }

                      if (
                        server1VideoUrl
                      ) {
                        break;
                      }
                    }
                  }


                  /*
                  ----------------------------------------------
                  C. Look for media URL in player config
                  ----------------------------------------------
                  */

                  if (
                    !server1VideoUrl
                  ) {

                    const mediaMatches =
                      watchHtml.match(
                        /https?:\/\/[^"'\\<>\s]+\.mp4(?:\?[^"'\\<>\s]*)?/gi
                      );

                    if (
                      mediaMatches
                    ) {

                      for (
                        const foundUrl
                        of mediaMatches
                      ) {

                        const valid =
                          isValidStreamUrl(
                            foundUrl
                          );

                        if (valid) {

                          server1VideoUrl =
                            valid;

                          break;
                        }
                      }
                    }
                  }
                }

              } catch (
                watchError
              ) {

                console.error(
                  "Watch page extraction failed:",
                  movie.watchUrl,
                  watchError
                );
              }


              /*
              ==================================================
              2. SERVER 1 FALLBACK
              ==================================================
              */

              if (
                !server1VideoUrl
              ) {

                try {

                  const server1Response =
                    await fetch(
                      movie.server1Url,
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

                  if (
                    server1Response.ok
                  ) {

                    const server1Html =
                      await server1Response.text();


                    /*
                    ----------------------------------------------
                    First: Video URL explicitly exposed
                    ----------------------------------------------
                    */

                    const explicitPatterns = [

                      /Video\s*url\s*:\s*["']([^"']+)["']/i,

                      /Video\s*url\s*:\s*([^<\s"'\\]+)/i,

                      /video\s*url[^:]*:\s*["']([^"']+)["']/i,

                      /["']videoUrl["']\s*:\s*["']([^"']+)["']/i,

                      /["']video_url["']\s*:\s*["']([^"']+)["']/i

                    ];


                    for (
                      const pattern
                      of explicitPatterns
                    ) {

                      const found =
                        server1Html.match(
                          pattern
                        );

                      if (
                        found &&
                        found[1]
                      ) {

                        const valid =
                          isValidStreamUrl(
                            found[1]
                          );

                        if (valid) {

                          server1VideoUrl =
                            valid;

                          break;
                        }
                      }
                    }


                    /*
                    ----------------------------------------------
                    Second: video/source tags
                    ----------------------------------------------
                    */

                    if (
                      !server1VideoUrl
                    ) {

                      const tagPatterns = [

                        /<video[^>]+src=["']([^"']+)["']/gi,

                        /<source[^>]+src=["']([^"']+)["']/gi

                      ];


                      for (
                        const pattern
                        of tagPatterns
                      ) {

                        let found;

                        while (
                          (
                            found =
                              pattern.exec(
                                server1Html
                              )
                          ) !== null
                        ) {

                          const valid =
                            isValidStreamUrl(
                              found[1]
                            );

                          if (valid) {

                            server1VideoUrl =
                              valid;

                            break;
                          }
                        }

                        if (
                          server1VideoUrl
                        ) {
                          break;
                        }
                      }
                    }


                    /*
                    ----------------------------------------------
                    Third: absolute MP4 URL
                    BUT /download/ is rejected.
                    ----------------------------------------------
                    */

                    if (
                      !server1VideoUrl
                    ) {

                      const mp4Matches =
                        server1Html.match(
                          /https?:\/\/[^"'\\<>\s]+\.mp4(?:\?[^"'\\<>\s]*)?/gi
                        );

                      if (
                        mp4Matches
                      ) {

                        for (
                          const foundUrl
                          of mp4Matches
                        ) {

                          const valid =
                            isValidStreamUrl(
                              foundUrl
                            );

                          if (valid) {

                            server1VideoUrl =
                              valid;

                            break;
                          }
                        }
                      }
                    }
                  }

                } catch (
                  server1Error
                ) {

                  console.error(
                    "Server 1 extraction failed:",
                    movie.server1Url,
                    server1Error
                  );
                }
              }


              /*
              ==================================================
              3. SERVER 2 ABYSSPLAYER FALLBACK
              ==================================================
              */

              if (
                !server1VideoUrl
              ) {

                try {

                  const server2Response =
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

                  if (
                    server2Response.ok
                  ) {

                    const server2Html =
                      await server2Response.text();


                    /*
                    ----------------------------------------------
                    Find AbyssPlayer iframe
                    ----------------------------------------------
                    */

                    const iframeRegex =
                      /<iframe[^>]+src=["']([^"']+)["']/gi;

                    let iframeMatch;

                    while (
                      (
                        iframeMatch =
                          iframeRegex.exec(
                            server2Html
                          )
                      ) !== null
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
                          )
                            .hostname
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


                    /*
                    ----------------------------------------------
                    Fallback if iframe is not in normal markup
                    ----------------------------------------------
                    */

                    if (
                      !server2PlayerUrl
                    ) {

                      const abyssMatch =
                        server2Html.match(
                          /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<\s]+/i
                        );

                      if (
                        abyssMatch
                      ) {

                        server2PlayerUrl =
                          abyssMatch[0];
                      }
                    }
                  }

                } catch (
                  server2Error
                ) {

                  console.error(
                    "Server 2 extraction failed:",
                    movie.server2Url,
                    server2Error
                  );
                }
              }


              /*
              ==================================================
              4. CHOOSE PLAYER
              ==================================================
              */

              if (
                server1VideoUrl
              ) {

                playerUrl =
                  server1VideoUrl;

                playerType =
                  "mp4";

              } else if (
                server2PlayerUrl
              ) {

                playerUrl =
                  server2PlayerUrl;

                playerType =
                  "iframe";

              } else {

                playerUrl = "";
                playerType = "";
              }


              /*
              ==================================================
              RETURN MOVIE
              ==================================================
              */

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

                server1VideoUrl,

                server2PlayerUrl
              };

            } catch (
              error
            ) {

              console.error(
                "Movie detail error:",
                movie.sourceUrl,
                error
              );

              return movie;
            }
          }
        )
      );


    /*
    ==========================================================
    RESPONSE
    ==========================================================
    */

    return json(
      {
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
      }
    );

  } catch (
    error
  ) {

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


/*
==============================================================
JSON HELPER
==============================================================
*/

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
