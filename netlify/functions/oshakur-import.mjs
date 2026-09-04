export default async (req) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const apiBase =
      "https://api.oshakurfilms.com/api/movies";

    const pageSize = 24;

    let page = 1;
    let totalPages = 1;

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    /*
      Get movies already imported so we don't create duplicates.
    */

    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/oshakur_movies?select=source_url`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json"
        }
      }
    );

    if (!existingResponse.ok) {
      throw new Error(
        `Could not read existing movies: ${existingResponse.status}`
      );
    }

    const existingMovies = await existingResponse.json();

    const existingUrls = new Set(
      existingMovies
        .map(movie => movie.source_url)
        .filter(Boolean)
    );

    /*
      Go through ALL OSHAkur API pages.
    */

    while (page <= totalPages) {

      console.log(`Importing OSHAkur page ${page}/${totalPages}`);

      const apiUrl =
        `${apiBase}?page=${page}` +
        `&size=${pageSize}` +
        `&isPublished=true` +
        `&sortBy=createdAt` +
        `&sortDirection=desc`;

      const apiResponse = await fetch(apiUrl, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!apiResponse.ok) {
        throw new Error(
          `OSHAkur API returned ${apiResponse.status}`
        );
      }

      const apiData = await apiResponse.json();

      const apiMovies =
        apiData?.data ||
        apiData?.movies ||
        apiData?.items ||
        [];

      /*
        Detect total pages from the API response.
      */

      totalPages =
        Number(
          apiData?.totalPages ||
          apiData?.pagination?.totalPages ||
          apiData?.meta?.totalPages ||
          1
        );

      /*
        Safety fallback.
      */

      if (!Array.isArray(apiMovies) || apiMovies.length === 0) {
        break;
      }

      for (const apiMovie of apiMovies) {

        try {

          const slug = apiMovie.slug;

          if (!slug) {
            skipped++;
            continue;
          }

          const sourceUrl =
            `https://www.oshakurfilms.com/watch/${slug}`;

          /*
            Skip duplicates.
          */

          if (existingUrls.has(sourceUrl)) {
            skipped++;
            continue;
          }

          /*
            Only inspect movies that have links.
          */

          if (
            !apiMovie.linksCount ||
            Number(apiMovie.linksCount) <= 0
          ) {
            skipped++;
            continue;
          }

          /*
            Fetch the actual OSHAkur movie page.
          */

          const pageResponse =
            await fetch(sourceUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0"
              }
            });

          if (!pageResponse.ok) {
            skipped++;
            continue;
          }

          const html =
            await pageResponse.text();

          /*
            Find possible watch/embed URLs.
          */

          const allowedHosts = [
            "audinifer.com",
            "vibuxer.com",
            "streamhg",
            "hgcloud.to"
          ];

          const blockedHosts = [
            "3xyy.com",
            "afu.php"
          ];

          const urlRegex =
            /https?:\/\/[^\s"'<>\\]+/gi;

          const foundUrls =
            html.match(urlRegex) || [];

          let watchUrl = null;

          for (const rawUrl of foundUrls) {

            let cleanUrl = rawUrl
              .replace(/\\u0026/g, "&")
              .replace(/\\\//g, "/")
              .replace(/&amp;/g, "&")
              .replace(/[)"',]+$/g, "");

            const lower =
              cleanUrl.toLowerCase();

            if (
              blockedHosts.some(host =>
                lower.includes(host)
              )
            ) {
              continue;
            }

            if (
              allowedHosts.some(host =>
                lower.includes(host)
              )
            ) {
              watchUrl = cleanUrl;
              break;
            }
          }

          /*
            IMPORTANT:
            Don't save movies without a real watch link.
          */

          if (!watchUrl) {
            skipped++;
            continue;
          }

          /*
            Extract poster.
          */

          const poster =
            apiMovie.imgUrl ||
            null;

          /*
            Clean description.
          */

          const description =
            String(
              apiMovie.description || ""
            )
              .replace(/<[^>]*>/g, "")
              .replace(/\s+/g, " ")
              .trim();

          /*
            Build movie.
          */

          const movie = {
            source_url: sourceUrl,

            title:
              String(
                apiMovie.title ||
                "Untitled"
              ).trim(),

            poster,

            summary:
              description ||
              "No description available.",

            category:
              apiMovie.category ||
              "Other",

            watch_url:
              watchUrl,

            duration:
              null
          };

          /*
            Insert into Supabase.
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
              If duplicate, don't treat
              it as a fatal error.
            */

            if (
              insertResponse.status === 409
            ) {
              skipped++;
              existingUrls.add(sourceUrl);
              continue;
            }

            console.error(
              "Insert failed:",
              errorText
            );

            errors++;
            continue;
          }

          imported++;

          existingUrls.add(sourceUrl);

          console.log(
            `Imported: ${movie.title}`
          );

        } catch (movieError) {

          console.error(
            "Movie processing error:",
            movieError
          );

          errors++;
        }
      }

      page++;

    }

    return new Response(
      JSON.stringify({
        success: true,

        message:
          "OSHAkur import completed",

        imported,

        skipped,

        errors,

        pagesProcessed:
          page - 1
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  } catch (error) {

    console.error(
      "OSHAkur import error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
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
