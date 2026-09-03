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
    const seen = new Set();

    /*
      Find EVERY OSHAkur /watch/ link.

      We no longer assume the movie title is
      inside the same <a> element.
    */

    const hrefRegex =
      /href=["']([^"']*\/watch\/[^"'?#]+)["']/gi;

    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      let href = match[1];

      // Convert relative URL to absolute
      const sourceUrl = new URL(
        href,
        "https://www.oshakurfilms.com"
      ).href;

      // Remove query/hash
      const cleanUrl = sourceUrl.split("?")[0].split("#")[0];

      if (seen.has(cleanUrl)) continue;

      seen.add(cleanUrl);

      movies.push({
        sourceUrl: cleanUrl
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
