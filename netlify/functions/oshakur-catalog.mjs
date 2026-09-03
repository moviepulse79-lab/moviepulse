export default async (req) => {
  try {
    const url = new URL(req.url);

    const page = Math.max(
      1,
      parseInt(url.searchParams.get("page") || "1", 10)
    );

    const category = url.searchParams.get("category");

    let targetUrl = `https://www.oshakurfilms.com/movies?page=${page}`;

    if (category) {
      targetUrl += `&category=${encodeURIComponent(category)}`;
    }

    const response = await fetch(targetUrl, {
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

    const movies = [];

    /*
      Find OSHAkur movie links.

      Example:
      /watch/the-myth
      /watch/robin-hood
    */

    const linkRegex =
      /href=["'](\/watch\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    const seen = new Set();

    while ((match = linkRegex.exec(html)) !== null) {
      const path = match[1];

      if (seen.has(path)) continue;

      seen.add(path);

      const rawText = match[2]
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!rawText) continue;

      movies.push({
        title: decode(rawText),
        sourceUrl: `https://www.oshakurfilms.com${path}`
      });
    }

    return json({
      success: true,
      page,
      category: category || null,
      count: movies.length,
      movies
    });

  } catch (error) {
    return json({
      success: false,
      error: error.message
    }, 500);
  }
};


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
