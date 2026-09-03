export default async (req) => {
  try {
    const url = new URL(req.url);
    const movieUrl = url.searchParams.get("url");

    if (!movieUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing movie URL"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Only allow OSHAkur movie pages
    const parsedUrl = new URL(movieUrl);

    if (parsedUrl.hostname !== "www.oshakurfilms.com") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only OSHAkur movie URLs are supported"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const response = await fetch(movieUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`OSHAkur returned ${response.status}`);
    }

    const html = await response.text();

    // Remove scripts/styles before extracting visible text
    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");

    const text = cleanHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, " ")
      .trim();

    // Title
    let title = null;

    const ogTitle = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i
    );

    const pageTitle = html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    if (ogTitle) {
      title = ogTitle[1].trim();
    } else if (pageTitle) {
      title = pageTitle[1]
        .replace(/\s*\|\s*OSHAkur.*$/i, "")
        .trim();
    }

    // Poster
    let poster = null;

    const ogImage = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i
    );

    if (ogImage) {
      poster = ogImage[1].trim();
    }

    // Summary
    let summary = null;

    const description = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i
    );

    if (description) {
      summary = description[1].trim();
    }

    // Try to find an OSHAkur watch link
    const links = [];

    const linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const linkText = match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      links.push({
        href,
        text: linkText
      });
    }

    const watchLink = links.find((link) =>
      /watch|watch now|watch full movie/i.test(link.text)
    );

    let watchUrl = null;

    if (watchLink) {
      watchUrl = new URL(
        watchLink.href,
        movieUrl
      ).href;
    }

    // Category
    let category = null;

    const categoryMatch = text.match(
      /Category\s*[:\-]?\s*([A-Za-z][A-Za-z &]+)/i
    );

    if (categoryMatch) {
      category = categoryMatch[1].trim();
    }

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
