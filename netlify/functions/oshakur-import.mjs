
export default async (req) => {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL;

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error(
        "Supabase environment variables are missing"
      );
    }

    const url = new URL(req.url);

    /*
      Import ONE OSHAkur API page per request.

      Example:
      /.netlify/functions/oshakur-import?page=1
      /.netlify/functions/oshakur-import?page=2
    */

    const page = Math.max(
      1,
      parseInt(
        url.searchParams.get("page") || "1",
        10
      )
    );

    const pageSize = 24;

    const apiBase =
      "https://api.oshakurfilms.com/api/movies";

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    /*
      --------------------------------------------------
      Helper: clean text
      --------------------------------------------------
    */

    const cleanText = (value) => {
      return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    /*
      --------------------------------------------------
      Helper: convert duration to HH:MM:SS
      --------------------------------------------------
    */

    const normalizeDuration = (value) => {
      if (!value) {
        return null;
      }

      const text =
        String(value)
          .trim()
          .replace(/\s+/g, " ");

      /*
        Already formatted:

        01:57:15
        57:15
        1:02:33
      */

      const colonMatch =
        text.match(
          /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
        );

      if (colonMatch) {
        if (colonMatch[3]) {
          return (
            `${colonMatch[1].padStart(2, "0")}:` +
            `${colonMatch[2]}:` +
            `${colonMatch[3]}`
          );
        }

        return (
          `00:${colonMatch[1].padStart(2, "0")}:` +
          `${colonMatch[2]}`
        );
      }

      /*
        Look for text such as:

        1h 57m
        1h 57min
        117 min
        117 minutes
        1 hour 57 minutes
      */

      let hours = 0;
      let minutes = 0;
      let seconds = 0;

      const hourMatch =
        text.match(
          /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i
        );

      const minuteMatch =
        text.match(
          /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i
        );

      const secondMatch =
        text.match(
          /(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/i
        );

      if (hourMatch) {
        hours =
          Math.floor(
            Number(hourMatch[1])
          );
      }

      if (minuteMatch) {
        minutes =
          Math.floor(
            Number(minuteMatch[1])
          );
      }

      if (secondMatch) {
        seconds =
          Math.floor(
            Number(secondMatch[1])
          );
      }

      if (
        hourMatch ||
        minuteMatch ||
        secondMatch
      ) {
        return (
          `${String(hours).padStart(2, "0")}:` +
          `${String(minutes).padStart(2, "0")}:` +
          `${String(seconds).padStart(2, "0")}`
        );
      }

      /*
        ISO 8601 duration:

        PT1H57M15S
      */

      const isoMatch =
        text.match(
          /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i
        );

      if (isoMatch) {
        hours =
          Number(isoMatch[1] || 0);

        minutes =
          Number(isoMatch[2] || 0);

        seconds =
          Number(isoMatch[3] || 0);

        return (
          `${String(hours).padStart(2, "0")}:` +
          `${String(minutes).padStart(2, "0")}:` +
          `${String(seconds).padStart(2, "0")}`
        );
      }

      return null;
    };

    /*
      --------------------------------------------------
      Helper: extract duration from HTML
      --------------------------------------------------
    */

    const extractDuration = (html) => {

      /*
        Check common HTML metadata first.
      */

      const durationPatterns = [

        /<meta[^>]+(?:itemprop|property|name)=["']duration["'][^>]+content=["']([^"']+)["']/i,

        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:itemprop|property|name)=["']duration["']/i,

        /"duration"\s*:\s*"([^"]+)"/i,

        /"duration"\s*:\s*'([^']+)'/i,

        /data-duration=["']([^"']+)["']/i,

        /class=["'][^"']*duration[^"']*["'][^>]*>\s*([^<]+)/i
      ];

      for (
        const pattern of durationPatterns
      ) {

        const match =
          html.match(pattern);

        if (match) {

          const duration =
            normalizeDuration(
              match[1]
            );

          if (duration) {
            return duration;
          }
        }
      }

      /*
        Search visible text for formats like:

        Duration: 01:57:15
        Duration 1h 57m
      */

      const visibleText =
        html
          .replace(
            /<script[\s\S]*?<\/script>/gi,
            " "
          )
          .replace(
            /<style[\s\S]*?<\/style>/gi,
            " "
          )
          .replace(
            /<[^>]*>/g,
            " "
          )
          .replace(
            /\s+/g,
            " "
          );

      const visibleMatch =
        visibleText.match(
          /duration\s*[:\-]?\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?|(?:\d+\s*(?:h|hr|hrs|hour|hours)\s*)?(?:\d+\s*(?:m|min|mins|minute|minutes))?(?:\s*\d+\s*(?:s|sec|secs|second|seconds))?)/i
        );

      if (visibleMatch) {

        const duration =
          normalizeDuration(
            visibleMatch[1]
          );

        if (duration) {
          return duration;
        }
      }

      /*
        Search for plain HH:MM:SS patterns.

        We deliberately require the first number
        to be 0-9 hours to avoid grabbing dates.
      */

      const timeMatch =
        visibleText.match(
          /\b(\d{1,2}:\d{2}:\d{2})\b/
        );

      if (timeMatch) {
        return normalizeDuration(
          timeMatch[1]
        );
      }

      return null;
    };

    /*
      --------------------------------------------------
      Helper: find watch URL
      --------------------------------------------------
    */

    const findWatchUrl = (html) => {

      /*
        These are the hosts we currently accept.

        We only save the public external watch/embed
        URL found on the source page.
      */

      const allowedHosts = [
        "audinifer.com",
        "vibuxer.com",
        "streamhg",
        "hgcloud.to"
      ];

      /*
        Known ad/redirect hosts that must not be saved.
      */

      const blockedHosts = [
        "3xyy.com",
        "afu.php"
      ];

      const urlRegex =
        /https?:\/\/[^\s"'<>\\]+/gi;

      const foundUrls =
        html.match(urlRegex) || [];

      for (
        const rawUrl of foundUrls
      ) {

        let cleanUrl =
          rawUrl
            .replace(
              /\\u0026/g,
              "&"
            )
            .replace(
              /\\\//g,
              "/"
            )
            .replace(
              /&amp;/g,
              "&"
            )
            .replace(
              /[)"',]+$/g,
              ""
            );

        try {

          const parsed =
            new URL(cleanUrl);

          const hostname =
            parsed.hostname
              .toLowerCase();

          const fullUrl =
            cleanUrl.toLowerCase();

          /*
            Block known advertisement URLs.
          */

          if (
            blockedHosts.some(
              blocked =>
                hostname.includes(blocked) ||
                fullUrl.includes(blocked)
            )
          ) {
            continue;
          }

          /*
            Accept only our allowed hosts.
          */

          if (
            allowedHosts.some(
              allowed =>
                hostname === allowed ||
                hostname.endsWith(
                  `.${allowed}`
                ) ||
                hostname.includes(
                  allowed
                )
            )
          ) {
            return cleanUrl;
          }

        } catch {
          /*
            Ignore malformed URLs.
          */
        }
      }

      return null;
    };

    /*
      --------------------------------------------------
      Get movies already in Supabase
      --------------------------------------------------
    */

    const existingResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/oshakur_movies?select=source_url`,
        {
          headers: {
            apikey: serviceKey,
            Authorization:
              `Bearer ${serviceKey}`,
            Accept:
              "application/json"
          }
        }
      );

    if (!existingResponse.ok) {
      throw new Error(
        `Could not read existing movies: ${existingResponse.status}`
      );
    }

    const existingMovies =
      await existingResponse.json();

    const existingUrls =
      new Set(
        existingMovies
          .map(
            movie =>
              movie.source_url
          )
          .filter(Boolean)
      );

    /*
      --------------------------------------------------
      Fetch ONE OSHAkur API page
      --------------------------------------------------
    */

    console.log(
      `Importing OSHAkur page ${page}`
    );

    const apiUrl =
      `${apiBase}?page=${page}` +
      `&size=${pageSize}` +
      `&isPublished=true` +
      `&sortBy=createdAt` +
      `&sortDirection=desc`;

    const apiResponse =
      await fetch(
        apiUrl,
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!apiResponse.ok) {
      throw new Error(
        `OSHAkur API returned ${apiResponse.status}`
      );
    }

    const apiData =
      await apiResponse.json();

    /*
      Support the response formats
      returned by OSHAkur.
    */

    const apiMovies =
      apiData?.data ||
      apiData?.movies ||
      apiData?.items ||
      [];

    if (
      !Array.isArray(apiMovies)
    ) {
      throw new Error(
        "OSHAkur API returned an invalid movie list"
      );
    }

    /*
      --------------------------------------------------
      Detect total pages
      --------------------------------------------------
    */

    let totalPages =
      Number(
        apiData?.totalPages ||
        apiData?.pagination?.totalPages ||
        apiData?.meta?.totalPages ||
        0
      );

    /*
      If the API doesn't expose totalPages,
      estimate it from total/count fields.
    */

    if (!totalPages) {

      const total =
        Number(
          apiData?.total ||
          apiData?.pagination?.total ||
          apiData?.meta?.total ||
          0
        );

      if (total > 0) {
        totalPages =
          Math.ceil(
            total / pageSize
          );
      }
    }

    /*
      Final fallback.

      If this page contains fewer than pageSize
      movies, assume this is the final page.
    */

    if (!totalPages) {

      totalPages =
        apiMovies.length < pageSize
          ? page
          : page + 1;
    }

    /*
      --------------------------------------------------
      Process this page
      --------------------------------------------------
    */

    for (
      const apiMovie of apiMovies
    ) {

      try {

        const slug =
          apiMovie?.slug;

        /*
          No slug = cannot build source page.
        */

        if (!slug) {
          skipped++;
          continue;
        }

        const sourceUrl =
          `https://www.oshakurfilms.com/watch/${slug}`;

        /*
          Skip duplicates.
        */

        if (
          existingUrls.has(
            sourceUrl
          )
        ) {
          skipped++;
          continue;
        }

        /*
          If OSHAkur says there are no links,
          don't waste a request.
        */

        if (
          !apiMovie.linksCount ||
          Number(
            apiMovie.linksCount
          ) <= 0
        ) {
          skipped++;
          continue;
        }

        /*
          Fetch the public OSHAkur movie page.
        */

        const pageResponse =
          await fetch(
            sourceUrl,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (compatible; MoviePulseImporter/1.0)"
              }
            }
          );

        if (!pageResponse.ok) {
          console.log(
            `Skipping ${apiMovie.title}: source page returned ${pageResponse.status}`
          );

          skipped++;
          continue;
        }

        const html =
          await pageResponse.text();

        /*
          Find an allowed external watch URL.
        */

        const watchUrl =
          findWatchUrl(html);

        /*
          IMPORTANT:

          Movies without a real watch URL
          are NOT inserted into Supabase.
        */

        if (!watchUrl) {

          console.log(
            `Skipping ${apiMovie.title}: no valid watch link`
          );

          skipped++;
          continue;
        }

        /*
          Extract duration.
        */

        const duration =
          extractDuration(html);

        /*
          Clean description.
        */

        const description =
          cleanText(
            apiMovie.description ||
            ""
          );

        /*
          Build database record.
        */

        const movie = {

          source_url:
            sourceUrl,

          title:
            cleanText(
              apiMovie.title ||
              "Untitled"
            ),

          poster:
            apiMovie.imgUrl ||
            null,

          summary:
            description ||
            "No description available.",

          category:
            cleanText(
              apiMovie.category ||
              "Other"
            ),

          watch_url:
            watchUrl,

          duration:
            duration
        };

        /*
          ------------------------------------------------
          Insert into Supabase
          ------------------------------------------------
        */

        const insertResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/oshakur_movies`,
            {
              method: "POST",

              headers: {
                apikey:
                  serviceKey,

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

        /*
          Duplicate / unique constraint.
        */

        if (
          insertResponse.status === 409
        ) {

          skipped++;

          existingUrls.add(
            sourceUrl
          );

          continue;
        }

        if (
          !insertResponse.ok
        ) {

          const errorText =
            await insertResponse.text();

          console.error(
            `Insert failed for ${movie.title}:`,
            errorText
          );

          errors++;

          continue;
        }

        imported++;

        existingUrls.add(
          sourceUrl
        );

        console.log(
          `Imported: ${movie.title}` +
          `${duration ? ` (${duration})` : ""}`
        );

      } catch (movieError) {

        console.error(
          "Movie processing error:",
          movieError
        );

        errors++;
      }
    }

    /*
      --------------------------------------------------
      Determine next page
      --------------------------------------------------
    */

    const hasNext =
      page < totalPages &&
      apiMovies.length > 0;

    const nextPage =
      hasNext
        ? page + 1
        : null;

    /*
      --------------------------------------------------
      Return result
      --------------------------------------------------
    */

    return new Response(
      JSON.stringify(
        {
          success: true,

          message:
            `OSHAkur page ${page} processed`,

          page,

          pageSize,

          moviesOnPage:
            apiMovies.length,

          totalPages,

          imported,

          skipped,

          errors,

          hasNext,

          nextPage
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
      "OSHAkur import error:",
      error
    );

    return new Response(
      JSON.stringify(
        {
          success: false,
          error:
            error.message ||
            "Unknown error"
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
