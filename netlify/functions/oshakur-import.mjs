export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const requestedCategory =
      url.searchParams.get("category") || null;

    // --------------------------------------------------
    // ENVIRONMENT VARIABLES
    // --------------------------------------------------

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    // --------------------------------------------------
    // OSHAKUR CATALOG
    // --------------------------------------------------

    let catalogUrl =
      `https://www.oshakurfilms.com/movies?page=${page}`;

    if (requestedCategory) {
      catalogUrl +=
        `&category=${encodeURIComponent(
          requestedCategory
        )}`;
    }

    const catalogResponse =
      await fetch(catalogUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });

    if (!catalogResponse.ok) {
      throw new Error(
        `OSHAkur catalog returned ${catalogResponse.status}`
      );
    }

    const catalogHtml =
      await catalogResponse.text();

    // --------------------------------------------------
    // FIND MOVIE URLS
    // --------------------------------------------------

    const movieUrls = [];
    const seen = new Set();

    const hrefRegex =
      /href=["']([^"']*\/watch\/[^"'?#]+)["']/gi;

    let match;

    while (
      (match = hrefRegex.exec(catalogHtml)) !== null
    ) {

      const rawHref = match[1];

      const absoluteUrl =
        new URL(
          rawHref,
          "https://www.oshakurfilms.com"
        ).href;

      const cleanUrl =
        absoluteUrl
          .split("?")[0]
          .split("#")[0];

      if (
        !cleanUrl.includes(
          "oshakurfilms.com/watch/"
        )
      ) {
        continue;
      }

      if (seen.has(cleanUrl)) {
        continue;
      }

      seen.add(cleanUrl);

      movieUrls.push(cleanUrl);
    }

    // --------------------------------------------------
    // IMPORT MOVIES
    // --------------------------------------------------

    const movies = [];

    for (
      const sourceUrl of movieUrls
    ) {

      try {

        const movieResponse =
          await fetch(sourceUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });

        if (!movieResponse.ok) {
          console.error(
            "Movie page failed:",
            sourceUrl,
            movieResponse.status
          );

          continue;
        }

        const html =
          await movieResponse.text();

        // ------------------------------------------------
        // TITLE
        // ------------------------------------------------

        const title =
          extractMeta(
            html,
            "og:title"
          ) ||
          extractTitleTag(html) ||
          "Untitled";

        // ------------------------------------------------
        // POSTER
        // ------------------------------------------------

        const poster =
          extractMeta(
            html,
            "og:image"
          ) || null;

        // ------------------------------------------------
        // SUMMARY
        // ------------------------------------------------

        const summary =
          extractMovieSummary(html) ||
          extractMeta(
            html,
            "description"
          ) ||
          "No description available.";

        // ------------------------------------------------
        // CATEGORY
        // ------------------------------------------------

        const category =
          extractCategory(
            html,
            requestedCategory
          );

        // ------------------------------------------------
        // WATCH URL
        // ------------------------------------------------

        const watchUrl =
          extractWatchUrl(html);

        // ------------------------------------------------
        // MOVIE OBJECT
        // ------------------------------------------------

        const movie = {

          title:
            cleanText(title),

          poster:
            poster
              ? decodeHtml(poster)
              : null,

          summary:
            cleanText(summary),

          category:
            category || "Other",

          watchUrl:
            watchUrl || null,

          duration:
            null,

          sourceUrl

        };

        movies.push(movie);

      } catch (movieError) {

        console.error(
          "Movie import failed:",
          sourceUrl,
          movieError.message
        );

      }

    }

    // --------------------------------------------------
    // SAVE TO SUPABASE
    // --------------------------------------------------

    let saved = 0;
    let failed = 0;

    if (movies.length > 0) {

      const supabaseRows =
        movies.map(movie => ({
          source_url:
            movie.sourceUrl,

          title:
            movie.title,

          poster:
            movie.poster,

          summary:
            movie.summary,

          category:
            movie.category,

          watch_url:
            movie.watchUrl,

          duration:
            movie.duration,

          updated_at:
            new Date().toISOString()
        }));

      const supabaseResponse =
        await fetch(
          `${SUPABASE_URL}/rest/v1/oshakur_movies?on_conflict=source_url`,
          {
            method: "POST",

            headers: {

              "apikey":
                SUPABASE_SERVICE_ROLE_KEY,

              "Authorization":
                `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

              "Content-Type":
                "application/json",

              "Prefer":
                "resolution=merge-duplicates,return=minimal"
            },

            body:
              JSON.stringify(
                supabaseRows
              )
          }
        );

      if (!supabaseResponse.ok) {

        const errorText =
          await supabaseResponse.text();

        throw new Error(
          `Supabase save failed (${supabaseResponse.status}): ${errorText}`
        );

      }

      saved =
        supabaseRows.length;

    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return json({

      success:
        true,

      page,

      category:
        requestedCategory,

      discovered:
        movieUrls.length,

      imported:
        movies.length,

      saved,

      failed,

      movies

    });

  } catch (error) {

    console.error(
      "OSHAkur importer error:",
      error
    );

    return json(
      {
        success:
          false,

        error:
          error.message
      },
      500
    );

  }
};


// ======================================================
// META EXTRACTION
// ======================================================

function extractMeta(
  html,
  name
) {

  const escaped =
    name.replace(
      /[-\/\\^$*+?.()|[\]{}]/g,
      "\\$&"
    );

  const regex =
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i"
    );

  const match =
    html.match(regex);

  if (match) {

    return decodeHtml(
      match[1]
    );

  }

  const reverseRegex =
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i"
    );

  const reverseMatch =
    html.match(reverseRegex);

  return reverseMatch
    ? decodeHtml(reverseMatch[1])
    : null;

}


// ======================================================
// TITLE
// ======================================================

function extractTitleTag(
  html
) {

  const match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  return match
    ? decodeHtml(match[1])
    : null;

}


// ======================================================
// SUMMARY
// ======================================================

function extractMovieSummary(
  html
) {

  const patterns = [

    /<div[^>]+class=["'][^"']*(?:description|summary|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,

    /<p[^>]+class=["'][^"']*(?:description|summary|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,

    /<div[^>]+class=["'][^"']*(?:movie-description|movie-summary)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      html.match(pattern);

    if (match) {

      const text =
        stripHtml(
          match[1]
        );

      if (
        text.length > 20
      ) {

        return decodeHtml(
          text
        );

      }

    }

  }

  return null;

}


// ======================================================
// CATEGORY
// ======================================================

function extractCategory(
  html,
  requestedCategory = null
) {

  if (requestedCategory) {

    return normalizeCategory(
      requestedCategory
    );

  }

  const h1Match =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (h1Match) {

    const h1End =
      h1Match.index +
      h1Match[0].length;

    const afterTitle =
      html.substring(
        h1End,
        h1End + 2000
      );

    const visibleText =
      cleanText(
        stripHtml(
          afterTitle
        )
      );

    const categories = [

      "Action",
      "Drama",
      "Horror",
      "Indian",
      "Cartoon",
      "Romance",
      "Scifi",
      "Sci-Fi",
      "Others"

    ];

    for (
      const category of categories
    ) {

      const regex =
        new RegExp(
          `\\b${escapeRegex(
            category
          )}\\b`,
          "i"
        );

      if (
        regex.test(
          visibleText
        )
      ) {

        return normalizeCategory(
          category
        );

      }

    }

  }

  return "Other";

}


// ======================================================
// WATCH URL
// ======================================================

function extractWatchUrl(
  html
) {

  const allowedHosts = [

    "audinifer.com",
    "vibuxer.com",
    "streamhg",
    "hgcloud.to"

  ];

  const hrefRegex =
    /href=["']([^"']+)["']/gi;

  let match;

  while (
    (match =
      hrefRegex.exec(html)) !== null
  ) {

    let href =
      decodeHtml(
        match[1]
      );

    if (
      !/^https?:\/\//i.test(
        href
      )
    ) {
      continue;
    }

    const lower =
      href.toLowerCase();

    const allowed =
      allowedHosts.some(
        host =>
          lower.includes(host)
      );

    if (!allowed) {
      continue;
    }

    return href;

  }

  return null;

}


// ======================================================
// CATEGORY NORMALIZATION
// ======================================================

function normalizeCategory(
  value
) {

  if (!value) {
    return null;
  }

  const text =
    cleanText(
      decodeHtml(value)
    );

  const lower =
    text.toLowerCase();

  if (
    lower.includes("action")
  ) {
    return "Action";
  }

  if (
    lower.includes("drama")
  ) {
    return "Drama";
  }

  if (
    lower.includes("horror")
  ) {
    return "Horror";
  }

  if (
    lower.includes("indian")
  ) {
    return "Indian";
  }

  if (
    lower.includes("cartoon")
  ) {
    return "Cartoon";
  }

  if (
    lower.includes("romance")
  ) {
    return "Romance";
  }

  if (
    lower.includes("scifi") ||
    lower.includes("sci-fi") ||
    lower.includes("sci fi")
  ) {
    return "Scifi";
  }

  if (
    lower.includes("other")
  ) {
    return "Others";
  }

  return null;

}


// ======================================================
// REGEX ESCAPE
// ======================================================

function escapeRegex(
  value
) {

  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

}


// ======================================================
// STRIP HTML
// ======================================================

function stripHtml(
  value
) {

  return String(value || "")

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


// ======================================================
// CLEAN TEXT
// ======================================================

function cleanText(
  value
) {

  return decodeHtml(
    String(value || "")
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


// ======================================================
// HTML ENTITY DECODER
// ======================================================

function decodeHtml(
  value
) {

  return String(value || "")

    .replace(
      /&amp;/g,
      "&"
    )

    .replace(
      /&quot;/g,
      '"'
    )

    .replace(
      /&#39;|&#x27;/gi,
      "'"
    )

    .replace(
      /&lt;/g,
      "<"
    )

    .replace(
      /&gt;/g,
      ">"
    )

    .replace(
      /&nbsp;/g,
      " "
    )

    .replace(
      /&#x2F;/gi,
      "/"
    );

}


// ======================================================
// JSON RESPONSE
// ======================================================

function json(
  data,
  status = 200
) {

  return new Response(

    JSON.stringify(
      data,
      null,
      2
    ),

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
