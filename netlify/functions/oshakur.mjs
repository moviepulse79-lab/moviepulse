export default async (req) => {
  try {
    const url = new URL(req.url);
    const movieUrl = url.searchParams.get("url");

    if (!movieUrl) {
      return json({
        success: false,
        error: "Missing movie URL"
      }, 400);
    }

    const parsed = new URL(movieUrl);

    if (
      parsed.hostname !== "www.oshakurfilms.com" &&
      parsed.hostname !== "oshakurfilms.com"
    ) {
      return json({
        success: false,
        error: "Only OSHAkur URLs are supported"
      }, 400);
    }

    const response = await fetch(movieUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`OSHAkur returned ${response.status}`);
    }

    const html = await response.text();

    // -------------------------
    // TITLE
    // -------------------------

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

    // -------------------------
    // POSTER
    // -------------------------

    let poster = null;

    const ogImage = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
    );

    if (ogImage) {
      poster = decode(ogImage[1]).trim();
    }

    // -------------------------
    // SUMMARY
    // -------------------------

    let summary = null;

    const metaDescription = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i
    );

    if (metaDescription) {
      summary = decode(metaDescription[1]).trim();
    }

    // -------------------------
    // CATEGORY
    // -------------------------

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

    // -------------------------
    // EXTERNAL WATCH LINK
    // -------------------------

    let watchUrl = null;

    /*
      Look for external video hosts inside the
      actual OSHAkur page source.
    */

    const externalHosts = [
      "audinifer.com",
      "vibuxer.com",
      "streamhg",
      "hgcloud.to"
    ];

    const allUrls = [];

    const urlRegex =
      /https?:\/\/[^\s"'<>\\]+/gi;

    let match;

    while ((match = urlRegex.exec(html)) !== null) {
      let found = match[0]
        .replace(/&amp;/g, "&")
        .replace(/[),.;]+$/, "");

      allUrls.push(found);
    }

    for (const found of allUrls) {
      if (
        externalHosts.some(host =>
          found.toLowerCase().includes(host)
        )
      ) {
        watchUrl = found;
        break;
      }
    }

    // -------------------------
    // ALSO CHECK HREFS
    // -------------------------

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
          watchUrl = new URL(href, movieUrl).href;
          break;
        }
      }
    }

    // -------------------------
    // RETURN
    // -------------------------

    return json({
      success: true,
      source: "OSHAkur",
      movie: {
        title,
        poster,
        summary,
        category,
        watchUrl,
        sourceUrl: movieUrl
      }
    });

  } catch (error) {
    return json({
      success: false,
      error: error.message
    }, 500);
  }
};


// -------------------------
// HELPERS
// -------------------------

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
