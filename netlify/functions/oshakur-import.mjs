export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    // Get catalog
    const catalogUrl =
      `https://www.oshakurfilms.com/movies?page=${page}`;

    const catalogResponse = await fetch(catalogUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
      }
    });

    if (!catalogResponse.ok) {
      throw new Error(
        `Catalog returned ${catalogResponse.status}`
      );
    }

    const catalogHtml = await catalogResponse.text();

    // Discover movie URLs
    const hrefRegex =
      /href=["']([^"']*\/watch\/[^"'?#]+)["']/gi;

    const movieUrls = [];
    const seen = new Set();

    let match;

    while ((match = hrefRegex.exec(catalogHtml)) !== null) {
      const sourceUrl = new URL(
        match[1],
        "https://www.oshakurfilms.com"
      ).href
        .split("?")[0]
        .split("#")[0];

      if (seen.has(sourceUrl)) continue;

      seen.add(sourceUrl);
      movieUrls.push(sourceUrl);
    }

    // Import each movie
    const movies = [];

    for (const sourceUrl of movieUrls) {
      try {
        const movieResponse = await fetch(sourceUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
          }
        });

        if (!movieResponse.ok) {
          movies.push({
            sourceUrl,
            success: false,
            error: `Movie returned ${movieResponse.status}`
          });

          continue;
        }

        const html = await movieResponse.text();

        const movie = extractMovie(html, sourceUrl);

        movies.push({
          success: true,
          ...movie
        });

      } catch (error) {
        movies.push({
          sourceUrl,
          success: false,
          error: error.message
        });
      }
    }

    return json({
      success: true,
      page,
      discovered: movieUrls.length,
      imported: movies.filter(m => m.success).length,
      movies
    });

  } catch (error) {
    return json({
      success: false,
      error: error.message
    }, 500);
  }
};


// ========================================
// MOVIE EXTRACTION
// ========================================

function extractMovie(html, sourceUrl) {

  // TITLE
  let title = null;

  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i
  );

  const titleTag = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (ogTitle) {
    title = decode(ogTitle[1]).trim();
  } else if (titleTag) {
    title = decode(titleTag[1])
      .replace(/\s*\|\s*OSHAkur.*$/i, "")
      .trim();
  }


  // POSTER
  let poster = null;

  const ogImage = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
  );

  if (ogImage) {
    poster = decode(ogImage[1]).trim();
  }


  // SUMMARY
  let summary = null;

  const description = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i
  );

  if (description) {
    summary = decode(description[1]).trim();
  }


  // CATEGORY
  let category = null;

  const categories = [
    "Action",
    "Drama",
    "Horror",
    "Romance",
    "Comedy",
    "Indian",
    "Cartoon",
    "Scifi",
    "Others"
  ];

  for (const item of categories) {

    const regex = new RegExp(
      `\\b${item}\\b`,
      "i"
    );

    if (regex.test(html)) {
      category = item;
      break;
    }
  }


  // WATCH LINK
  let watchUrl = null;

  const externalHosts = [
    "audinifer.com",
    "vibuxer.com",
    "streamhg",
    "hgcloud.to"
  ];

  const urlRegex =
    /https?:\/\/[^\s"'<>\\]+/gi;

  let match;

  while ((match = urlRegex.exec(html)) !== null) {

    let found = match[0]
      .replace(/&amp;/g, "&")
      .replace(/[),.;]+$/, "");

    if (
      externalHosts.some(host =>
        found.toLowerCase().includes(host)
      )
    ) {
      watchUrl = found;
      break;
    }
  }


  // ALSO CHECK HREFS
  if (!watchUrl) {

    const hrefRegex =
      /href=["']([^"']+)["']/gi;

    while ((match = hrefRegex.exec(html)) !== null) {

      let href = decode(match[1]);

      if (
        externalHosts.some(host =>
          href.toLowerCase().includes(host)
        )
      ) {

        watchUrl =
          new URL(href, sourceUrl).href;

        break;
      }
    }
  }


  // DURATION
  let duration = null;

  const durationRegex =
    /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/;

  const durationMatch =
    html.match(durationRegex);

  if (durationMatch) {
    duration = durationMatch[1];
  }


  return {
    title,
    poster,
    summary,
    category,
    watchUrl,
    duration,
    sourceUrl
  };
}


// ========================================
// HELPERS
// ========================================

function decode(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      }
    }
  );
}
