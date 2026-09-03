export default async (req) => {
  try {
    const url = new URL(req.url);

    const startPage = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const pages = Math.min(
      3,
      Math.max(
        1,
        parseInt(url.searchParams.get("pages") || "1", 10)
      )
    );

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const allMovies = [];
    const allSourceUrls = new Set();

    const processedPages = [];

    let discovered = 0;
    let skippedExisting = 0;
    let imported = 0;
    let saved = 0;

    // --------------------------------------------------
    // 1. Get ALL existing source URLs from Supabase
    // --------------------------------------------------

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
      const text = await existingResponse.text();
      throw new Error(
        `Could not read existing movies: ${existingResponse.status} ${text}`
      );
    }

    const existingMovies = await existingResponse.json();

    const existingUrls = new Set(
      existingMovies
        .map(movie => movie.source_url)
        .filter(Boolean)
    );

    // --------------------------------------------------
    // 2. Process requested catalog pages
    // --------------------------------------------------

    for (
      let page = startPage;
      page < startPage + pages;
      page++
    ) {
      const catalogUrl =
        `https://www.oshakurfilms.com/movies?page=${page}`;

      const response = await fetch(catalogUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        throw new Error(
          `OSHAkur catalog returned ${response.status} on page ${page}`
        );
      }

      const html = await response.text();

      const sourceUrls = [];
      const seenOnPage = new Set();

      const hrefRegex =
        /href=["']([^"']*\/watch\/[^"'?#]+)["']/gi;

      let match;

      while ((match = hrefRegex.exec(html)) !== null) {
        const sourceUrl = new URL(
          match[1],
          "https://www.oshakurfilms.com"
        ).href
          .split("?")[0]
          .split("#")[0];

        if (seenOnPage.has(sourceUrl)) continue;

        seenOnPage.add(sourceUrl);
        sourceUrls.push(sourceUrl);
      }

      processedPages.push({
        page,
        discovered: sourceUrls.length,
        newCandidates: 0,
        skippedExisting: 0
      });

      discovered += sourceUrls.length;

      // --------------------------------------------------
      // 3. Remove duplicates before fetching movie pages
      // --------------------------------------------------

      for (const sourceUrl of sourceUrls) {
        // Already processed in this import
        if (allSourceUrls.has(sourceUrl)) {
          continue;
        }

        allSourceUrls.add(sourceUrl);

        // Already exists in Supabase
        if (existingUrls.has(sourceUrl)) {
          skippedExisting++;
          processedPages[processedPages.length - 1]
            .skippedExisting++;
          continue;
        }

        processedPages[processedPages.length - 1]
          .newCandidates++;

        // --------------------------------------------------
        // 4. Fetch individual movie page
        // --------------------------------------------------

        try {
          const movieResponse = await fetch(sourceUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });

          if (!movieResponse.ok) {
            console.warn(
              `Skipping ${sourceUrl}: HTTP ${movieResponse.status}`
            );
            continue;
          }

          const movieHtml = await movieResponse.text();

          const title =
            extractMeta(movieHtml, "og:title") ||
            extractTitle(movieHtml) ||
            "Untitled";

          const poster =
            extractMeta(movieHtml, "og:image") ||
            null;

          const summary =
            extractMeta(movieHtml, "description") ||
            extractSummary(movieHtml) ||
            null;

          const category =
            extractCategory(movieHtml);

          const watchUrl =
            extractWatchUrl(movieHtml);

          const duration =
            extractDuration(movieHtml);

          const movie = {
            source_url: sourceUrl,
            title: cleanText(title),
            poster,
            summary: cleanText(summary),
            category,
            watch_url: watchUrl,
            duration
          };

          allMovies.push(movie);
          imported++;

        } catch (movieError) {
          console.warn(
            `Failed to process ${sourceUrl}:`,
            movieError.message
          );
        }
      }
    }

    // --------------------------------------------------
    // 5. Save ONLY new movies
    // --------------------------------------------------

    if (allMovies.length > 0) {
      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/oshakur_movies?on_conflict=source_url`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(allMovies)
        }
      );

      if (!saveResponse.ok) {
        const text = await saveResponse.text();

        throw new Error(
          `Supabase save failed: ${saveResponse.status} ${text}`
        );
      }

      saved = allMovies.length;
    }

    return json({
      success: true,

      startPage,

      pagesProcessed: pages,

      nextPage: startPage + pages,

      discovered,

      skippedExisting,

      newMovies: allMovies.length,

      imported,

      saved,

      processedPages,

      movies: allMovies
    });

  } catch (error) {
    console.error("OSHAkur importer error:", error);

    return json(
      {
        success: false,
        error: error.message
      },
      500
    );
  }
};


// ======================================================
// Helpers
// ======================================================

function extractMeta(html, property) {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );

  const match = html.match(regex);

  return match ? decodeHtml(match[1]) : null;
}


function extractTitle(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  return match
    ? decodeHtml(match[1].trim())
    : null;
}


function extractSummary(html) {
  const patterns = [
    /<p[^>]*class=["'][^"']*(?:description|summary)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    /<div[^>]*class=["'][^"']*(?:description|summary)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const regex of patterns) {
    const match = html.match(regex);

    if (match) {
      return stripHtml(match[1]);
    }
  }

  return null;
}


function extractCategory(html) {
  const categories = [
    "Action",
    "Drama",
    "Horror",
    "Indian",
    "Cartoon",
    "Romance",
    "Scifi",
    "Others"
  ];

  const lowerHtml = html.toLowerCase();

  for (const category of categories) {
    if (
      lowerHtml.includes(
        `>${category.toLowerCase()}<`
      ) ||
      lowerHtml.includes(
        `"${category.toLowerCase()}"`
      )
    ) {
      return category;
    }
  }

  return null;
}


function extractWatchUrl(html) {
  const regex =
    /href=["']([^"']+)["']/gi;

  const allowedHosts = [
    "audinifer.com",
    "vibuxer.com",
    "streamhg",
    "hgcloud.to"
  ];

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = new URL(
        match[1],
        "https://www.oshakurfilms.com"
      );

      const host = href.hostname.toLowerCase();

      if (
        allowedHosts.some(
          allowed =>
            host.includes(allowed)
        )
      ) {
        return href.href;
      }

    } catch {
      // Ignore malformed URLs
    }
  }

  return null;
}


function extractDuration(html) {
  const patterns = [
    /\b(\d{1,2}:\d{2}:\d{2})\b/,
    /\b(\d{1,3}:\d{2})\b/
  ];

  for (const regex of patterns) {
    const match = html.match(regex);

    if (match) {
      return match[1];
    }
  }

  return null;
}


function stripHtml(value) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}


function cleanText(value) {
  if (!value) return null;

  return stripHtml(String(value));
}


function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}


function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control":
          "public, max-age=300"
      }
    }
  );
}
