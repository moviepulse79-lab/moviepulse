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

    // Get existing movies so we don't import duplicates
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

    const allMovies = [];
    const processedPages = [];

    let discovered = 0;
    let skippedExisting = 0;
    let imported = 0;
    let saved = 0;

    let totalPages = null;
    let totalItems = null;
    let hasNext = false;

    for (
      let page = startPage;
      page < startPage + pages;
      page++
    ) {
      const apiUrl =
        `https://api.oshakurfilms.com/api/movies` +
        `?page=${page}` +
        `&size=24` +
        `&isPublished=true` +
        `&sortBy=createdAt` +
        `&sortDirection=desc`;

      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `OSHAkur API returned ${response.status} on page ${page}: ${text}`
        );
      }

      const apiData = await response.json();

      const apiMovies = Array.isArray(apiData.data)
        ? apiData.data
        : [];

      totalPages = apiData.totalPages ?? totalPages;
      totalItems = apiData.totalItems ?? totalItems;
      hasNext = apiData.hasNext ?? false;

      discovered += apiMovies.length;

      const pageInfo = {
        page,
        discovered: apiMovies.length,
        skippedExisting: 0,
        newCandidates: 0,
        imported: 0
      };

      for (const apiMovie of apiMovies) {
        if (!apiMovie.slug) {
          continue;
        }

        const sourceUrl =
          `https://www.oshakurfilms.com/watch/${apiMovie.slug}`;

        if (existingUrls.has(sourceUrl)) {
          skippedExisting++;
          pageInfo.skippedExisting++;
          continue;
        }

        pageInfo.newCandidates++;

        let watchUrl = null;
        let duration = null;
        let pageSummary = null;
        let pagePoster = null;

        // If OSHAkur says there are no links,
        // don't waste another request fetching the page.
        if (
          typeof apiMovie.linksCount === "number" &&
          apiMovie.linksCount > 0
        ) {
          try {
            const movieResponse = await fetch(sourceUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                "Accept":
                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
              }
            });

            if (movieResponse.ok) {
              const movieHtml = await movieResponse.text();

              watchUrl = extractWatchUrl(movieHtml);
              duration = extractDuration(movieHtml);

              pageSummary =
                extractMeta(movieHtml, "description");

              pagePoster =
                extractMeta(movieHtml, "og:image");
            }
          } catch (pageError) {
            console.warn(
              `Could not inspect ${sourceUrl}:`,
              pageError.message
            );
          }
        }

        const movie = {
          source_url: sourceUrl,

          title:
            cleanText(apiMovie.title) ||
            "Untitled",

          poster:
            apiMovie.imgUrl ||
            pagePoster ||
            null,

          summary:
            cleanText(
              stripHtml(
                apiMovie.description || ""
              )
            ) ||
            cleanText(pageSummary) ||
            null,

          category:
            normalizeCategory(apiMovie.category),

          watch_url:
            watchUrl,

          duration:
            duration
        };

        allMovies.push(movie);

        imported++;
        pageInfo.imported++;

        existingUrls.add(sourceUrl);
      }

      processedPages.push(pageInfo);
    }

    // Save imported movies
    if (allMovies.length > 0) {
      const saveResponse = await fetch(
        `${supabaseUrl}/rest/v1/oshakur_movies?on_conflict=source_url`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer:
              "resolution=merge-duplicates,return=minimal"
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

      nextPage:
        startPage + pages,

      totalPages,
      totalItems,
      hasNext,

      discovered,
      skippedExisting,

      newMovies:
        allMovies.length,

      imported,
      saved,

      processedPages,

      movies:
        allMovies
    });

  } catch (error) {
    console.error(
      "OSHAkur importer error:",
      error
    );

    return json(
      {
        success: false,
        error: error.message
      },
      500
    );
  }
};


/* -----------------------------
   Extract permitted watch URL
----------------------------- */

function extractWatchUrl(html) {
  const regex =
    /href=["']([^"']+)["']/gi;

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

  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = new URL(
        match[1],
        "https://www.oshakurfilms.com"
      );

      const host =
        href.hostname.toLowerCase();

      const fullUrl =
        href.href.toLowerCase();

      // Block known advertising/redirect URLs
      if (
        blockedHosts.some(blocked =>
          host.includes(blocked) ||
          fullUrl.includes(blocked)
        )
      ) {
        continue;
      }

      // Only accept known video hosts
      if (
        allowedHosts.some(
          allowed =>
            host.includes(allowed)
        )
      ) {
        return href.href;
      }

    } catch {
      // Ignore invalid URLs
    }
  }

  return null;
}


/* -----------------------------
   Extract duration
----------------------------- */

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


/* -----------------------------
   Extract meta
----------------------------- */

function extractMeta(html, property) {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );

  const match =
    html.match(regex);

  return match
    ? decodeHtml(match[1])
    : null;
}


/* -----------------------------
   Category
----------------------------- */

function normalizeCategory(category) {
  if (!category) {
    return null;
  }

  const value =
    String(category)
      .trim()
      .toLowerCase();

  const categories = {
    action: "Action",
    drama: "Drama",
    horror: "Horror",
    indian: "Indian",
    cartoon: "Cartoon",
    romance: "Romance",
    scifi: "Scifi",
    "sci-fi": "Scifi",
    others: "Others"
  };

  return (
    categories[value] ||
    capitalizeWords(value)
  );
}


/* -----------------------------
   Text cleaning
----------------------------- */

function stripHtml(value) {
  return String(value)
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ""
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function cleanText(value) {
  if (!value) {
    return null;
  }

  return decodeHtml(
    stripHtml(String(value))
  );
}


function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}


function capitalizeWords(value) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


/* -----------------------------
   JSON response
----------------------------- */

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
          "application/json",

        "Cache-Control":
          "public, max-age=300"
      }
    }
  );
}
