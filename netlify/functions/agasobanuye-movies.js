export default async (req) => {
        /*
    ============================================================
    DOWNLOAD REQUEST
    ============================================================
    */

    const requestUrl = new URL(req.url);

    if (
        requestUrl.searchParams.get("action") === "download"
    ) {

        const downloadUrl =
            requestUrl.searchParams.get("url");

        if (!downloadUrl) {
            return json(
                {
                    success: false,
                    error: "Missing download URL"
                },
                400
            );
        }

        try {

            const parsed =
                new URL(downloadUrl);

            /*
            Only allow the Agasobanuye media server.
            */

            if (
                parsed.hostname !==
                "media.agasobanuyenow.com"
            ) {
                return json(
                    {
                        success: false,
                        error: "Invalid download host"
                    },
                    403
                );
            }

            const fileResponse =
                await fetch(
                    downloadUrl,
                    {
                        method: "GET",
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0"
                        }
                    }
                );

            /*
            If the source itself rejects the request,
            return the actual status instead of pretending
            the download worked.
            */

            if (!fileResponse.ok) {

                return json(
                    {
                        success: false,
                        error:
                            `Download server returned ${fileResponse.status}`,
                        status:
                            fileResponse.status
                    },
                    fileResponse.status
                );

            }

            const contentType =
                fileResponse.headers.get(
                    "content-type"
                ) ||
                "application/octet-stream";

            const contentLength =
                fileResponse.headers.get(
                    "content-length"
                );

            const headers = {
                "Content-Type":
                    contentType,

                "Content-Disposition":
                    "attachment"
            };

            if (contentLength) {
                headers[
                    "Content-Length"
                ] = contentLength;
            }

            return new Response(
                fileResponse.body,
                {
                    status: 200,
                    headers
                }
            );

        } catch (downloadError) {

            console.error(
                "Download request failed:",
                downloadError
            );

            return json(
                {
                    success: false,
                    error:
                        downloadError.message
                },
                500
            );
        }
    }
    
    if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
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

    /*
    ============================================================
    MOVIE CATALOGUE
    ============================================================
    */

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

      const slug =
        parts[1];

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

        /*
        ========================================================
        NEW DOWNLOAD FIELD
        ========================================================
        */

        downloadUrl: "",

        /*
        ========================================================
        EXISTING WATCH FIELDS
        ========================================================
        */

        playerUrl: "",

        playerType: "",

        server1PlayerUrl: "",

        server2PlayerUrl: "",

        server1VideoUrl: ""
      });

      if (
        movies.length >= limit
      ) {
        break;
      }
    }

    /*
    ============================================================
    HELPERS
    ============================================================
    */

    function decodeUrl(value) {
      if (!value) {
        return "";
      }

      let result =
        value
          .replace(
            /&amp;/g,
            "&"
          )
          .replace(
            /\\\//g,
            "/"
          )
          .replace(
            /&quot;/g,
            '"'
          )
          .replace(
            /&#39;/g,
            "'"
          )
          .replace(
            /&#x2F;/gi,
            "/"
          )
          .trim();

      if (
        result.startsWith("//")
      ) {
        result =
          "https:" +
          result;
      }

      return result;
    }

    /*
    ============================================================
    DOWNLOAD URL EXTRACTION
    ============================================================
    */

    function isDownloadUrl(value) {
      if (!value) {
        return false;
      }

      const decoded =
        decodeUrl(value);

      if (!decoded) {
        return false;
      }

      try {
        const parsed =
          new URL(decoded);

        if (
          parsed.protocol !==
            "http:" &&
          parsed.protocol !==
            "https:"
        ) {
          return false;
        }

        const pathname =
          parsed.pathname.toLowerCase();

        /*
        Accept direct downloadable media files.
        */

        if (
          pathname.includes("/download/") &&
          /\.(mp4|m4v|webm|mov)(?:$)/i.test(
            pathname
          )
        ) {
          return parsed.href;
        }

        /*
        Some download systems use download.php
        or a download query parameter.
        */

        if (
          pathname.endsWith(
            "/download.php"
          ) ||
          pathname.includes(
            "/download.php"
          )
        ) {
          return parsed.href;
        }

        if (
          parsed.searchParams.has(
            "download"
          )
        ) {
          return parsed.href;
        }

        return false;

      } catch {
        return false;
      }
    }

    /*
    ============================================================
    EXTRACT DOWNLOAD LINK FROM MOVIE DETAIL PAGE
    ============================================================
    */

    function extractDownloadUrl(
      html,
      pageUrl
    ) {
      if (!html) {
        return "";
      }

      /*
      ------------------------------------------------------------
      1. Normal <a href="..."> download links
      ------------------------------------------------------------
      */

      const anchorRegex =
        /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

      let found;

      while (
        (
          found =
            anchorRegex.exec(html)
        ) !== null
      ) {
        const href =
          found[1] || "";

        const linkText =
          (found[2] || "")
            .replace(
              /<[^>]+>/g,
              " "
            )
            .replace(
              /\s+/g,
              " "
            )
            .trim()
            .toLowerCase();

        const candidate =
          absoluteUrl(
            href,
            pageUrl
          );

        const valid =
          isDownloadUrl(
            candidate
          );

        if (valid) {
          return valid;
        }

        /*
        If the anchor is clearly a Download button,
        check the URL even when the extension isn't
        immediately visible.
        */

        if (
          linkText.includes(
            "download"
          )
        ) {
          try {
            const parsed =
              new URL(candidate);

            const pathname =
              parsed.pathname.toLowerCase();

            if (
              pathname.includes(
                "/download"
              ) ||
              parsed.searchParams.has(
                "download"
              )
            ) {
              return parsed.href;
            }

          } catch {}
        }
      }

      /*
      ------------------------------------------------------------
      2. Direct media/download URLs anywhere in HTML
      ------------------------------------------------------------
      */

      const directDownloadRegex =
        /https?:\/\/[^"'\\<>\s]+\/download\/[^"'\\<>\s]+/gi;

      const directMatches =
        html.match(
          directDownloadRegex
        ) || [];

      for (
        const candidate
        of directMatches
      ) {
        const valid =
          isDownloadUrl(
            candidate
          );

        if (valid) {
          return valid;
        }
      }

      /*
      ------------------------------------------------------------
      3. Relative /download/... URLs
      ------------------------------------------------------------
      */

      const relativeDownloadRegex =
        /["']([^"']*\/download\/[^"']+)["']/gi;

      while (
        (
          found =
            relativeDownloadRegex.exec(
              html
            )
        ) !== null
      ) {
        const candidate =
          absoluteUrl(
            found[1],
            pageUrl
          );

        const valid =
          isDownloadUrl(
            candidate
          );

        if (valid) {
          return valid;
        }
      }

      /*
      ------------------------------------------------------------
      4. download.php URLs
      ------------------------------------------------------------
      */

      const downloadPhpRegex =
        /https?:\/\/[^"'\\<>\s]+download\.php[^"'\\<>\s]*/gi;

      const phpMatches =
        html.match(
          downloadPhpRegex
        ) || [];

      for (
        const candidate
        of phpMatches
      ) {
        const valid =
          isDownloadUrl(
            candidate
          );

        if (valid) {
          return valid;
        }
      }

      return "";
    }

    /*
    ============================================================
    PUBLIC MEDIA URL
    ============================================================
    */

    function isPublicMediaUrl(value) {
      if (!value) {
        return false;
      }

      const decoded =
        decodeUrl(value);

      if (!decoded) {
        return false;
      }

      /*
      IMPORTANT:
      Download URLs are still rejected here because this
      function is ONLY for WATCH media extraction.
      */

      if (
        isDownloadUrl(decoded)
      ) {
        return false;
      }

      try {
        const parsed =
          new URL(decoded);

        if (
          parsed.protocol !==
            "http:" &&
          parsed.protocol !==
            "https:"
        ) {
          return false;
        }

        const pathname =
          parsed.pathname
            .toLowerCase();

        if (
          /\.(mp4|m3u8|webm|mov)(?:$|\?)/i.test(
            pathname
          )
        ) {
          return parsed.href;
        }

        return false;

      } catch {
        return false;
      }
    }

    /*
    ============================================================
    PUBLIC PLAYER URL
    ============================================================
    */

    function isPublicPlayerUrl(value) {
      if (!value) {
        return false;
      }

      const decoded =
        decodeUrl(value);

      if (!decoded) {
        return false;
      }

      if (
        isDownloadUrl(decoded)
      ) {
        return false;
      }

      try {
        const parsed =
          new URL(decoded);

        if (
          parsed.protocol !==
            "http:" &&
          parsed.protocol !==
            "https:"
        ) {
          return false;
        }

        const hostname =
          parsed.hostname.toLowerCase();

        if (
          hostname ===
            "abyssplayer.com" ||
          hostname.endsWith(
            ".abyssplayer.com"
          )
        ) {
          return parsed.href;
        }

        return false;

      } catch {
        return false;
      }
    }

    /*
    ============================================================
    ABSOLUTE URL
    ============================================================
    */

    function absoluteUrl(
      value,
      baseUrl
    ) {
      if (!value) {
        return "";
      }

      try {
        return new URL(
          decodeUrl(value),
          baseUrl
        ).href;
      } catch {
        return "";
      }
    }

    /*
    ============================================================
    SERVER 1 EXTRACTION
    ============================================================
    */

    function extractServer1(
      html,
      pageUrl
    ) {
      if (!html) {
        return {
          videoUrl: "",
          playerUrl: "",
          playerType: ""
        };
      }

      let videoUrl = "";

      let playerUrl = "";

      /*
      ------------------------------------------------------------
      1. Explicit video URL variables
      ------------------------------------------------------------
      */

      const explicitPatterns = [

        /["']videoUrl["']\s*:\s*["']([^"']+)["']/i,

        /["']video_url["']\s*:\s*["']([^"']+)["']/i,

        /["']videoURL["']\s*:\s*["']([^"']+)["']/i,

        /["']video["']\s*:\s*["']([^"']+)["']/i,

        /["']file["']\s*:\s*["']([^"']+)["']/i,

        /["']src["']\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,

        /Video\s*url\s*:\s*["']([^"']+)["']/i,

        /Video\s*URL\s*:\s*["']([^"']+)["']/i,

        /Video\s*url\s*:\s*([^<\s"'\\]+)/i,

        /https?:\/\/[^"'\\<>\s]+\.m3u8(?:\?[^"'\\<>\s]*)?/i,

        /https?:\/\/[^"'\\<>\s]+\.mp4(?:\?[^"'\\<>\s]*)?/i

      ];

      for (
        const pattern
        of explicitPatterns
      ) {
        const found =
          html.match(pattern);

        if (
          found &&
          found[1]
        ) {
          const candidate =
            absoluteUrl(
              found[1],
              pageUrl
            );

          const valid =
            isPublicMediaUrl(
              candidate
            );

          if (valid) {
            videoUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      2. <video src="">
      ------------------------------------------------------------
      */

      if (!videoUrl) {
        const videoSrcRegex =
          /<video\b[^>]*\bsrc=["']([^"']+)["']/gi;

        let found;

        while (
          (
            found =
              videoSrcRegex.exec(
                html
              )
          ) !== null
        ) {
          const candidate =
            absoluteUrl(
              found[1],
              pageUrl
            );

          const valid =
            isPublicMediaUrl(
              candidate
            );

          if (valid) {
            videoUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      3. <source src="">
      ------------------------------------------------------------
      */

      if (!videoUrl) {
        const sourceRegex =
          /<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

        let found;

        while (
          (
            found =
              sourceRegex.exec(
                html
              )
          ) !== null
        ) {
          const candidate =
            absoluteUrl(
              found[1],
              pageUrl
            );

          const valid =
            isPublicMediaUrl(
              candidate
            );

          if (valid) {
            videoUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      4. data-src / data-video / data-file
      ------------------------------------------------------------
      */

      if (!videoUrl) {
        const dataPatterns = [

          /\bdata-video=["']([^"']+)["']/gi,

          /\bdata-video-url=["']([^"']+)["']/gi,

          /\bdata-src=["']([^"']+)["']/gi,

          /\bdata-file=["']([^"']+)["']/gi

        ];

        for (
          const pattern
          of dataPatterns
        ) {
          let found;

          while (
            (
              found =
                pattern.exec(
                  html
                )
            ) !== null
          ) {
            const candidate =
              absoluteUrl(
                found[1],
                pageUrl
              );

            const valid =
              isPublicMediaUrl(
                candidate
              );

            if (valid) {
              videoUrl =
                valid;

              break;
            }
          }

          if (videoUrl) {
            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      5. Any visible MP4/M3U8 in Server 1 HTML
      ------------------------------------------------------------
      */

      if (!videoUrl) {
        const mediaRegex =
          /https?:\/\/[^"'\\<>\s]+?\.(?:mp4|m3u8)(?:\?[^"'\\<>\s]*)?/gi;

        const matches =
          html.match(
            mediaRegex
          ) || [];

        for (
          const candidate
          of matches
        ) {
          const valid =
            isPublicMediaUrl(
              candidate
            );

          if (valid) {
            videoUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      6. Public Server 1 player iframe
      ------------------------------------------------------------
      */

      if (!videoUrl) {
        const iframeRegex =
          /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

        let found;

        while (
          (
            found =
              iframeRegex.exec(
                html
              )
          ) !== null
        ) {
          const candidate =
            absoluteUrl(
              found[1],
              pageUrl
            );

          const valid =
            isPublicPlayerUrl(
              candidate
            );

          if (valid) {
            playerUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      7. Public player URLs written directly in HTML
      ------------------------------------------------------------
      */

      if (
        !videoUrl &&
        !playerUrl
      ) {
        const abyssRegex =
          /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<>\s]+/gi;

        const matches =
          html.match(
            abyssRegex
          ) || [];

        for (
          const candidate
          of matches
        ) {
          const valid =
            isPublicPlayerUrl(
              candidate
            );

          if (valid) {
            playerUrl =
              valid;

            break;
          }
        }
      }

      /*
      ------------------------------------------------------------
      RESULT
      ------------------------------------------------------------
      */

      if (videoUrl) {
        return {
          videoUrl,
          playerUrl: "",
          playerType: "mp4"
        };
      }

      if (playerUrl) {
        return {
          videoUrl: "",
          playerUrl,
          playerType: "iframe"
        };
      }

      return {
        videoUrl: "",
        playerUrl: "",
        playerType: ""
      };
    }

    /*
    ============================================================
    SERVER 2 EXTRACTION
    ============================================================
    */

    function extractServer2(
      html,
      pageUrl
    ) {
      if (!html) {
        return "";
      }

      /*
      Look for public AbyssPlayer iframe.
      */

      const iframeRegex =
        /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

      let found;

      while (
        (
          found =
            iframeRegex.exec(
              html
            )
        ) !== null
      ) {
        const candidate =
          absoluteUrl(
            found[1],
            pageUrl
          );

        const valid =
          isPublicPlayerUrl(
            candidate
          );

        if (valid) {
          return valid;
        }
      }

      /*
      Fallback: direct AbyssPlayer URL
      visible in page HTML.
      */

      const abyssRegex =
        /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<>\s]+/gi;

      const matches =
        html.match(
          abyssRegex
        ) || [];

      for (
        const candidate
        of matches
      ) {
        const valid =
          isPublicPlayerUrl(
            candidate
          );

        if (valid) {
          return valid;
        }
      }

      return "";
    }

    /*
    ============================================================
    MOVIE DETAILS
    ============================================================
    */

    const detailedMovies =
      await Promise.all(
        movies.map(
          async movie => {

            try {

              /*
              ----------------------------------------------------
              DETAIL PAGE
              ----------------------------------------------------
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
              ====================================================
              NEW DOWNLOAD EXTRACTION
              ====================================================
              */

              let downloadUrl =
                "";

              try {
                downloadUrl =
                  extractDownloadUrl(
                    detailHtml,
                    movie.sourceUrl
                  );
              } catch (
                downloadError
              ) {
                console.error(
                  "Download URL extraction failed:",
                  movie.sourceUrl,
                  downloadError
                );
              }

              /*
              ----------------------------------------------------
              POSTER
              ----------------------------------------------------
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
                  (
                    imageMatch =
                      imageRegex.exec(
                        detailHtml
                      )
                  ) !== null
                ) {

                  const imageUrl =
                    imageMatch[1];

                  if (
                    !imageUrl ||
                    imageUrl.startsWith(
                      "data:"
                    )
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
              ----------------------------------------------------
              SUMMARY
              ----------------------------------------------------
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
              ----------------------------------------------------
              TITLE
              ----------------------------------------------------
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
              ----------------------------------------------------
              CATEGORY
              ----------------------------------------------------
              */

              let movieCategory =
                "Movie";

              const categoryMatch =
                detailHtml.match(
                  /(?:Genre|Category)[^<]{0,80}<\/[^>]+>\s*<[^>]+>([^<]+)/i
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
              ----------------------------------------------------
              DURATION
              ----------------------------------------------------
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
              ====================================================
              SERVER 1 FIRST
              ====================================================
              */

              let server1VideoUrl = "";

              let server1PlayerUrl = "";

              let server1PlayerType = "";

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

                  const server1 =
                    extractServer1(
                      server1Html,
                      movie.server1Url
                    );

                  server1VideoUrl =
                    server1.videoUrl;

                  server1PlayerUrl =
                    server1.playerUrl;

                  server1PlayerType =
                    server1.playerType;

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

              /*
              ====================================================
              SERVER 1 RESULT
              ====================================================
              */

              if (
                server1VideoUrl
              ) {

                return {
                  ...movie,

                  title:
                    realTitle,

                  poster,

                  summary,

                  category:
                    movieCategory,

                  duration,

                  /*
                  NEW
                  */

                  downloadUrl,

                  /*
                  EXISTING WATCH
                  */

                  playerUrl:
                    server1VideoUrl,

                  playerType:
                    "mp4",

                  server1VideoUrl,

                  server1PlayerUrl,

                  server2PlayerUrl:
                    "",

                  sourcePriority:
                    "server1"
                };
              }

              /*
              ====================================================
              SERVER 1 PUBLIC PLAYER RESULT
              ====================================================
              */

              if (
                server1PlayerUrl
              ) {

                return {
                  ...movie,

                  title:
                    realTitle,

                  poster,

                  summary,

                  category:
                    movieCategory,

                  duration,

                  /*
                  NEW
                  */

                  downloadUrl,

                  /*
                  EXISTING WATCH
                  */

                  playerUrl:
                    server1PlayerUrl,

                  playerType:
                    server1PlayerType ||
                    "iframe",

                  server1VideoUrl:
                    "",

                  server1PlayerUrl,

                  server2PlayerUrl:
                    "",

                  sourcePriority:
                    "server1"
                };
              }

              /*
              ====================================================
              SERVER 2 FALLBACK
              ====================================================
              */

              let server2PlayerUrl =
                "";

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

                  server2PlayerUrl =
                    extractServer2(
                      server2Html,
                      movie.server2Url
                    );
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

              /*
              ====================================================
              SERVER 2 RESULT
              ====================================================
              */

              if (
                server2PlayerUrl
              ) {

                return {
                  ...movie,

                  title:
                    realTitle,

                  poster,

                  summary,

                  category:
                    movieCategory,

                  duration,

                  /*
                  NEW
                  */

                  downloadUrl,

                  /*
                  EXISTING WATCH
                  */

                  playerUrl:
                    server2PlayerUrl,

                  playerType:
                    "iframe",

                  server1VideoUrl:
                    "",

                  server1PlayerUrl:
                    "",

                  server2PlayerUrl,

                  sourcePriority:
                    "server2"
                };
              }

              /*
              ====================================================
              NOTHING AVAILABLE
              ====================================================
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

                /*
                NEW
                */

                downloadUrl,

                /*
                EXISTING WATCH
                */

                playerUrl:
                  "",

                playerType:
                  "",

                server1VideoUrl:
                  "",

                server1PlayerUrl:
                  "",

                server2PlayerUrl:
                  "",

                sourcePriority:
                  "none"
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
    ============================================================
    RESPONSE
    ============================================================
    */

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
============================================================
JSON RESPONSE HELPER
============================================================
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
          "public, max-age=300",

        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Methods":
          "GET, OPTIONS",

        "Access-Control-Allow-Headers":
          "Content-Type"
      }
    }
  );
}


