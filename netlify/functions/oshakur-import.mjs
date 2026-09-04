export default async (req) => {
  try {
    const url = new URL(req.url);

    const requestedPage = parseInt(
      url.searchParams.get("page") || "1",
      10
    );

    const page = Math.max(1, requestedPage);
    const pageSize = 24;

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        "Supabase environment variables are missing"
      );
    }

    /*
    =========================================================
    HELPERS
    =========================================================
    */

    function cleanText(text) {
      if (!text) return "";

      return text
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    function normalizeDuration(value) {
      if (!value) return null;

      const text = String(value).trim();

      /*
       * HH:MM:SS
       */
      let match = text.match(
        /\b(\d{1,2}):(\d{2}):(\d{2})\b/
      );

      if (match) {
        return `${match[1].padStart(2, "0")}:${match[2]}:${match[3]}`;
      }

      /*
       * MM:SS
       */
      match = text.match(
        /\b(\d{1,3}):(\d{2})\b/
      );

      if (match) {
        return `00:${match[1].padStart(2, "0")}:${match[2]}`;
      }

      /*
       * ISO duration:
       * PT2H10M11S
       */
      match = text.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i
      );

      if (match) {
        const hours = String(match[1] || 0).padStart(2, "0");
        const minutes = String(match[2] || 0).padStart(2, "0");
        const seconds = String(match[3] || 0).padStart(2, "0");

        return `${hours}:${minutes}:${seconds}`;
      }

      /*
       * "2h 10m 11s"
       */
      match = text.match(
        /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i
      );

      if (
        match &&
        (match[1] || match[2] || match[3])
      ) {
        const hours = String(match[1] || 0).padStart(2, "0");
        const minutes = String(match[2] || 0).padStart(2, "0");
        const seconds = String(match[3] || 0).padStart(2, "0");

        return `${hours}:${minutes}:${seconds}`;
      }

      return null;
    }

    function extractDuration(html) {
      if (!html) return null;

      const patterns = [
        /"duration"\s*:\s*"([^"]+)"/i,
        /"duration"\s*:\s*'([^']+)'/i,
        /data-duration=["']([^"']+)["']/i,
        /duration=["']([^"']+)["']/i,
        /<meta[^>]+property=["']video:duration["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']duration["'][^>]+content=["']([^"']+)["']/i
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);

        if (match) {
          const duration =
            normalizeDuration(match[1]);

          if (duration) {
            return duration;
          }
        }
      }

      /*
       * Search visible page text for:
       * 02:10:11
       * 1:57:15
       */
      const timeMatches = html.match(
        /\b\d{1,2}:\d{2}:\d{2}\b/g
      );

      if (timeMatches?.length) {
        return normalizeDuration(
          timeMatches[0]
        );
      }

      return null;
    }

    function findWatchUrl(html) {
      if (!html) return null;

      /*
       * Find all URLs in the OSHAkur page.
       */
      const urls = html.match(
        /https?:\/\/[^\s"'<>\\]+/gi
      ) || [];

      const allowedHosts = [
        "audinifer.com",
        "vibuxer.com",
        "streamhg",
        "hgcloud.to"
      ];

      const blockedHosts = [
        "3xyy.com"
      ];

      for (let rawUrl of urls) {
        let candidate = rawUrl
          .replace(/&amp;/g, "&")
          .replace(/[),.;]+$/g, "");

        try {
          const parsed =
            new URL(candidate);

          const hostname =
            parsed.hostname.toLowerCase();

          /*
           * Block known advertisement URLs.
           */
          if (
            blockedHosts.some(
              host =>
                hostname === host ||
                hostname.endsWith(`.${host}`)
            )
          ) {
            continue;
          }

          if (
            parsed.pathname
              .toLowerCase()
              .includes("afu.php")
          ) {
            continue;
          }

          /*
           * Only accept known watch hosts.
           */
          const allowed =
            allowedHosts.some(host =>
              hostname === host ||
              hostname.endsWith(`.${host}`) ||
              hostname.includes(host)
            );

          if (!allowed) {
            continue;
          }

          return parsed.href;

        } catch {
          continue;
        }
      }

      return null;
    }

    async function getExistingUrls() {
      const existing = new Set();

      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const endpoint =
          `${supabaseUrl}/rest/v1/oshakur_movies` +
          `?select=source_url` +
          `&source_url=not.is.null` +
          `&limit=${batchSize}` +
          `&offset=${offset}`;

        const response =
          await fetch(endpoint, {
            headers: {
              apikey: serviceKey,
              Authorization:
                `Bearer ${serviceKey}`,
              Accept: "application/json"
            }
          });

        if (!response.ok) {
          const text =
            await response.text();

          throw new Error(
            `Failed to read existing movies: ${response.status} ${text}`
          );
        }

        const rows =
          await response.json();

        for (const row of rows) {
          if (row.source_url) {
            existing.add(
              row.source_url
            );
          }
        }

        if (rows.length < batchSize) {
          break;
        }

        offset += batchSize;
      }

      return existing;
    }

    /*
    =========================================================
    LOAD EXISTING MOVIES
    =========================================================
    */

    const existingUrls =
      await getExistingUrls();

    /*
    =========================================================
    FETCH EXACT OSHAKUR PAGE
    =========================================================
    */

    const apiUrl =
      new URL(
        "https://api.oshakurfilms.com/api/movies"
      );

    apiUrl.searchParams.set(
      "page",
      String(page)
    );

    apiUrl.searchParams.set(
      "size",
      String(pageSize)
    );

    apiUrl.searchParams.set(
      "isPublished",
      "true"
    );

    apiUrl.searchParams.set(
      "sortBy",
      "createdAt"
    );

    apiUrl.searchParams.set(
      "sortDirection",
      "desc"
    );

    /*
     * Cache-busting parameter.
     * This helps prevent an intermediary cache
     * from returning an old page.
     */
    apiUrl.searchParams.set(
      "_",
      Date.now().toString()
    );

    const apiResponse =
      await fetch(apiUrl.href, {
        headers: {
          Accept:
            "application/json",
          "User-Agent":
            "Mozilla/5.0 MoviePulse Importer"
        }
      });

    if (!apiResponse.ok) {
      const text =
        await apiResponse.text();

      throw new Error(
        `OSHAkur API returned ${apiResponse.status}: ${text}`
      );
    }

    const apiData =
      await apiResponse.json();

    /*
    =========================================================
    READ API PAGINATION
    =========================================================
    */

    const movies =
      Array.isArray(apiData.data)
        ? apiData.data
        : Array.isArray(apiData.movies)
          ? apiData.movies
          : Array.isArray(apiData.items)
            ? apiData.items
            : [];

    const totalPages =
      Number(apiData.totalPages) ||
      1;

    const currentApiPage =
      Number(apiData.currentPage) ||
      page;

    const apiHasNext =
      apiData.hasNext === true ||
      currentApiPage < totalPages;

    /*
    =========================================================
    IMPORT
    =========================================================
    */

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const skippedReasons = {
      duplicate: 0,
      noLinks: 0,
      noWatchUrl: 0,
      invalid: 0
    };

    /*
     * Protect against the API returning the same page.
     */
    const pageSourceUrls = new Set();

    for (const apiMovie of movies) {

      try {

        if (!apiMovie) {
          skipped++;
          skippedReasons.invalid++;
          continue;
        }

        const title =
          cleanText(
            apiMovie.title ||
            "Untitled"
          );

        const slug =
          String(
            apiMovie.slug || ""
          ).trim();

        if (!slug) {
          skipped++;
          skippedReasons.invalid++;
          continue;
        }

        const sourceUrl =
          `https://www.oshakurfilms.com/watch/${slug}`;

        /*
         * Prevent duplicate movies inside
         * the same API response.
         */
        if (
          pageSourceUrls.has(sourceUrl)
        ) {
          skipped++;
          skippedReasons.duplicate++;
          continue;
        }

        pageSourceUrls.add(sourceUrl);

        /*
         * Already imported?
         */
        if (
          existingUrls.has(sourceUrl)
        ) {
          skipped++;
          skippedReasons.duplicate++;
          continue;
        }

        /*
         * OSHAkur says there are no links.
         */
        if (
          Number(apiMovie.linksCount || 0) <= 0
        ) {
          skipped++;
          skippedReasons.noLinks++;
          continue;
        }

        /*
        =====================================================
        FETCH MOVIE PAGE
        =====================================================
        */

        let moviePageResponse;

        try {
          moviePageResponse =
            await fetch(sourceUrl, {
              headers: {
                Accept:
                  "text/html,application/xhtml+xml",
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
              }
            });
        } catch (pageError) {
          console.error(
            `Failed to fetch ${title}:`,
            pageError
          );

          errors++;
          continue;
        }

        if (!moviePageResponse.ok) {
          console.error(
            `Movie page returned ${moviePageResponse.status}: ${title}`
          );

          errors++;
          continue;
        }

        const html =
          await moviePageResponse.text();

        /*
        =====================================================
        FIND REAL WATCH URL
        =====================================================
        */

        const watchUrl =
          findWatchUrl(html);

        /*
         * IMPORTANT:
         * Movies without a real watch link
         * are NEVER inserted.
         */
        if (!watchUrl) {
          skipped++;
          skippedReasons.noWatchUrl++;
          continue;
        }

        /*
        =====================================================
        DURATION
        =====================================================
        */

        const duration =
          extractDuration(html);

        /*
        =====================================================
        BUILD MOVIE
        =====================================================
        */

        const movie = {
          source_url: sourceUrl,

          title,

          poster:
            apiMovie.imgUrl ||
            null,

          summary:
            cleanText(
              apiMovie.description ||
              "No description available."
            ),

          category:
            cleanText(
              apiMovie.category ||
              "Other"
            ),

          watch_url:
            watchUrl,

          duration:
            duration || null
        };

        /*
        =====================================================
        INSERT INTO SUPABASE
        =====================================================
        */

        const insertResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/oshakur_movies`,
            {
              method: "POST",

              headers: {
                apikey: serviceKey,

                Authorization:
                  `Bearer ${serviceKey}`,

                "Content-Type":
                  "application/json",

                Prefer:
                  "return=minimal"
              },

              body:
                JSON.stringify(movie)
            }
          );

        if (!insertResponse.ok) {

          const errorText =
            await insertResponse.text();

          /*
           * Duplicate created between our
           * initial check and insert.
           */
          if (
            insertResponse.status === 409
          ) {
            skipped++;
            skippedReasons.duplicate++;
            existingUrls.add(sourceUrl);
            continue;
          }

          console.error(
            `Supabase insert failed for ${title}:`,
            errorText
          );

          errors++;
          continue;
        }

        imported++;

        /*
         * Remember it during this invocation.
         */
        existingUrls.add(sourceUrl);

        console.log(
          `Imported: ${title}`
        );

      } catch (movieError) {

        console.error(
          "Movie import error:",
          movieError
        );

        errors++;
      }
    }

    /*
    =========================================================
    RESULT
    =========================================================
    */

    return new Response(
      JSON.stringify(
        {
          success: true,

          message:
            `OSHAkur page ${page} processed`,

          page,

          apiCurrentPage:
            currentApiPage,

          pageSize,

          moviesOnPage:
            movies.length,

          totalPages,

          imported,

          skipped,

          errors,

          skippedReasons,

          hasNext:
            apiHasNext,

          nextPage:
            apiHasNext
              ? currentApiPage + 1
              : null
        },
        null,
        2
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",

          "Cache-Control":
            "no-store"
        }
      }
    );

  } catch (error) {

    console.error(
      "OSHAkur importer error:",
      error
    );

    return new Response(
      JSON.stringify(
        {
          success: false,
          error:
            error.message ||
            "Unknown importer error"
        },
        null,
        2
      ),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};
