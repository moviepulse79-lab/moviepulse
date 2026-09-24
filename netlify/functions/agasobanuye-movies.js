export default async (req) => {

    /*
    ============================================================
    OPTIONS
    ============================================================
    */

    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        });
    }

    try {

        const url = new URL(req.url);

        const page = Math.max(
            1,
            parseInt(
                url.searchParams.get("page") || "1",
                10
            )
        );

        const limit = Math.min(
            Math.max(
                parseInt(
                    url.searchParams.get("limit") || "12",
                    10
                ),
                1
            ),
            24
        );

        const category =
            url.searchParams.get("category");


        /*
        ============================================================
        AGASOBANUYE FREE CATALOGUE
        ============================================================
        */

        const targetUrl =
            `https://agasobanuyefree.com/movies?page=${page}` +
            (
                category
                    ? `&category=${encodeURIComponent(category)}`
                    : ""
            );


        const response =
            await fetch(
                targetUrl,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                        "Accept":
                            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

                        "Accept-Language":
                            "en-US,en;q=0.9"
                    }
                }
            );


        if (!response.ok) {
            throw new Error(
                `Agasobanuye FREE returned ${response.status}`
            );
        }


        const html =
            await response.text();


        /*
        ============================================================
        MOVIE CATALOGUE
        ============================================================
        */

        const movies = [];

        const seen =
            new Set();


        const hrefRegex =
            /href=["']([^"']*\/movies\/[^"'?#]+)["']/gi;


        let match;


        while (
            (match = hrefRegex.exec(html)) !== null
        ) {

            let sourceUrl;


            try {

                sourceUrl =
                    new URL(
                        match[1],
                        "https://agasobanuyefree.com"
                    ).href;

            } catch {

                continue;
            }


            const cleanUrl =
                sourceUrl
                    .split("?")[0]
                    .split("#")[0];


            let parsed;


            try {

                parsed =
                    new URL(cleanUrl);

            } catch {

                continue;
            }


            if (
                parsed.hostname !==
                    "agasobanuyefree.com" &&
                parsed.hostname !==
                    "www.agasobanuyefree.com"
            ) {
                continue;
            }


            const parts =
                parsed.pathname
                    .split("/")
                    .filter(Boolean);


            if (
                parts.length !== 2 ||
                parts[0] !== "movies"
            ) {
                continue;
            }


            const slug =
                parts[1];


            if (
                !slug ||
                seen.has(slug)
            ) {
                continue;
            }


            seen.add(slug);


            const title =
                slug
                    .replace(
                        /-by-[^-]+$/i,
                        ""
                    )
                    .replace(
                        /-/g,
                        " "
                    )
                    .replace(
                        /\b\w/g,
                        c => c.toUpperCase()
                    );


            movies.push({

                id:
                    slug,

                title,

                poster:
                    "",

                summary:
                    "",

                category:
                    "Movie",

                duration:
                    "",

                sourceUrl:
                    cleanUrl,

                watchUrl:
                    `${cleanUrl}/watch`,

                server1Url:
                    "",

                server2Url:
                    "",

                downloadUrl:
                    "",

                playerUrl:
                    "",

                playerType:
                    "",

                server1PlayerUrl:
                    "",

                server2PlayerUrl:
                    "",

                server1VideoUrl:
                    ""
            });


            if (
                movies.length >= limit
            ) {
                break;
            }
        }


        /*
        ============================================================
        HELPERS
        ============================================================
        */

        function decodeUrl(value) {

            if (!value) {
                return "";
            }


            let result =
                value
                    .replace(
                        /&amp;/g,
                        "&"
                    )
                    .replace(
                        /\\\//g,
                        "/"
                    )
                    .replace(
                        /&quot;/g,
                        '"'
                    )
                    .replace(
                        /&#39;/g,
                        "'"
                    )
                    .replace(
                        /&#x2F;/gi,
                        "/"
                    )
                    .trim();


            if (
                result.startsWith("//")
            ) {
                result =
                    "https:" +
                    result;
            }


            return result;
        }


        /*
        ============================================================
        ABSOLUTE URL
        ============================================================
        */

        function absoluteUrl(
            value,
            baseUrl
        ) {

            if (!value) {
                return "";
            }


            try {

                return new URL(
                    decodeUrl(value),
                    baseUrl
                ).href;

            } catch {

                return "";
            }
        }


        /*
        ============================================================
        DOWNLOAD URL CHECK
        ============================================================
        */

        function isDownloadUrl(value) {

            if (!value) {
                return false;
            }


            const decoded =
                decodeUrl(value);


            if (!decoded) {
                return false;
            }


            try {

                const parsed =
                    new URL(decoded);


                if (
                    parsed.protocol !== "http:" &&
                    parsed.protocol !== "https:"
                ) {
                    return false;
                }


                const pathname =
                    parsed.pathname.toLowerCase();


                if (
                    pathname.includes("/download/") &&
                    /\.(mp4|m4v|webm|mov)(?:$|\?)/i.test(
                        pathname
                    )
                ) {
                    return parsed.href;
                }


                if (
                    pathname.includes(
                        "/download.php"
                    )
                ) {
                    return parsed.href;
                }


                if (
                    parsed.searchParams.has(
                        "download"
                    )
                ) {
                    return parsed.href;
                }


                return false;

            } catch {

                return false;
            }
        }


        /*
        ============================================================
        DOWNLOAD EXTRACTION
        ============================================================
        */

        function extractDownloadUrl(
            html,
            pageUrl
        ) {

            if (!html) {
                return "";
            }


            const anchorRegex =
                /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


            let anchorMatch;


            while (
                (
                    anchorMatch =
                        anchorRegex.exec(html)
                ) !== null
            ) {

                const href =
                    anchorMatch[1] || "";


                const text =
                    (anchorMatch[2] || "")
                        .replace(
                            /<[^>]+>/g,
                            " "
                        )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim()
                        .toLowerCase();


                const candidate =
                    absoluteUrl(
                        href,
                        pageUrl
                    );


                if (!candidate) {
                    continue;
                }


                if (
                    /\.(mp4|m4v|webm|mov)(?:\?|$)/i.test(
                        candidate
                    )
                ) {
                    return candidate;
                }


                if (
                    text.includes("download")
                ) {

                    const valid =
                        isDownloadUrl(
                            candidate
                        );


                    if (valid) {
                        return valid;
                    }
                }
            }


            /*
            DIRECT MEDIA URL
            */

            const directRegex =
                /https?:\/\/[^"'\\<>\s]+(?:\.mp4|\.m4v|\.webm|\.mov)(?:\?[^"'\\<>\s]*)?/gi;


            const directMatches =
                html.match(
                    directRegex
                ) || [];


            for (
                const candidate
                of directMatches
            ) {

                const decoded =
                    decodeUrl(candidate);


                if (
                    /\.(mp4|m4v|webm|mov)(?:\?|$)/i.test(
                        decoded
                    )
                ) {

                    return decoded;
                }
            }


            /*
            /download/
            */

            const downloadRegex =
                /["']([^"']*\/download\/[^"']+)["']/gi;


            let downloadMatch;


            while (
                (
                    downloadMatch =
                        downloadRegex.exec(html)
                ) !== null
            ) {

                const candidate =
                    absoluteUrl(
                        downloadMatch[1],
                        pageUrl
                    );


                const valid =
                    isDownloadUrl(
                        candidate
                    );


                if (valid) {
                    return valid;
                }
            }


            /*
            download.php
            */

            const phpRegex =
                /["']([^"']*download\.php[^"']*)["']/gi;


            let phpMatch;


            while (
                (
                    phpMatch =
                        phpRegex.exec(html)
                ) !== null
            ) {

                const candidate =
                    absoluteUrl(
                        phpMatch[1],
                        pageUrl
                    );


                const valid =
                    isDownloadUrl(
                        candidate
                    );


                if (valid) {
                    return valid;
                }
            }


            return "";
        }


        /*
        ============================================================
        EXTRACT REAL WATCH / SERVER LINKS
        ============================================================
        */

        function extractWatchLinks(
            html,
            pageUrl
        ) {

            const result = {

                watchUrl:
                    "",

                server1Url:
                    "",

                server2Url:
                    ""
            };


            if (!html) {
                return result;
            }


            const anchorRegex =
                /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


            let match;


            while (
                (
                    match =
                        anchorRegex.exec(html)
                ) !== null
            ) {

                const href =
                    match[1] || "";


                const text =
                    (match[2] || "")
                        .replace(
                            /<[^>]+>/g,
                            " "
                        )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim()
                        .toLowerCase();


                const candidate =
                    absoluteUrl(
                        href,
                        pageUrl
                    );


                if (!candidate) {
                    continue;
                }


                /*
                WATCH
                */

                if (
                    !result.watchUrl &&
                    (
                        text === "watch" ||
                        text.includes("watch movie") ||
                        /\/watch(?:\/|$)/i.test(
                            candidate
                        )
                    )
                ) {

                    result.watchUrl =
                        candidate;
                }


                /*
                SERVER 1
                */

                if (
                    !result.server1Url &&
                    (
                        /server\s*1/i.test(text) ||
                        /server[-_\s]?1/i.test(candidate)
                    )
                ) {

                    result.server1Url =
                        candidate;
                }


                /*
                SERVER 2
                */

                if (
                    !result.server2Url &&
                    (
                        /server\s*2/i.test(text) ||
                        /server[-_\s]?2/i.test(candidate)
                    )
                ) {

                    result.server2Url =
                        candidate;
                }
            }


            return result;
        }


        /*
        ============================================================
        PUBLIC MEDIA URL
        ============================================================
        */

        function isPublicMediaUrl(value) {

            if (!value) {
                return false;
            }


            const decoded =
                decodeUrl(value);


            if (!decoded) {
                return false;
            }


            if (
                isDownloadUrl(decoded)
            ) {
                return false;
            }


            try {

                const parsed =
                    new URL(decoded);


                if (
                    parsed.protocol !== "http:" &&
                    parsed.protocol !== "https:"
                ) {
                    return false;
                }


                const pathname =
                    parsed.pathname.toLowerCase();


                if (
                    /\.(mp4|m3u8|webm|mov)(?:$|\?)/i.test(
                        pathname
                    )
                ) {
                    return parsed.href;
                }


                return false;

            } catch {

                return false;
            }
        }


        /*
        ============================================================
        PUBLIC PLAYER URL
        ============================================================
        */

        function isPublicPlayerUrl(value) {

            if (!value) {
                return false;
            }


            const decoded =
                decodeUrl(value);


            if (!decoded) {
                return false;
            }


            if (
                isDownloadUrl(decoded)
            ) {
                return false;
            }


            try {

                const parsed =
                    new URL(decoded);


                if (
                    parsed.protocol !== "http:" &&
                    parsed.protocol !== "https:"
                ) {
                    return false;
                }


                const hostname =
                    parsed.hostname.toLowerCase();


                if (
                    hostname === "abyssplayer.com" ||
                    hostname.endsWith(
                        ".abyssplayer.com"
                    )
                ) {
                    return parsed.href;
                }


                return false;

            } catch {

                return false;
            }
        }


        /*
        ============================================================
        EXTRACT SERVER 1
        ============================================================
        */

        function extractServer1(
            html,
            pageUrl
        ) {

            if (!html) {

                return {
                    videoUrl: "",
                    playerUrl: "",
                    playerType: ""
                };
            }


            let videoUrl =
                "";

            let playerUrl =
                "";


            const explicitPatterns = [

                /["']videoUrl["']\s*:\s*["']([^"']+)["']/i,

                /["']video_url["']\s*:\s*["']([^"']+)["']/i,

                /["']videoURL["']\s*:\s*["']([^"']+)["']/i,

                /["']video["']\s*:\s*["']([^"']+)["']/i,

                /["']file["']\s*:\s*["']([^"']+)["']/i,

                /["']src["']\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,

                /Video\s*url\s*:\s*["']([^"']+)["']/i,

                /Video\s*URL\s*:\s*["']([^"']+)["']/i,

                /https?:\/\/[^"'\\<>\s]+\.m3u8(?:\?[^"'\\<>\s]*)?/i,

                /https?:\/\/[^"'\\<>\s]+\.mp4(?:\?[^"'\\<>\s]*)?/i
            ];


            for (
                const pattern
                of explicitPatterns
            ) {

                const found =
                    html.match(pattern);


                if (
                    found &&
                    found[1]
                ) {

                    const candidate =
                        absoluteUrl(
                            found[1],
                            pageUrl
                        );


                    const valid =
                        isPublicMediaUrl(
                            candidate
                        );


                    if (valid) {

                        videoUrl =
                            valid;

                        break;
                    }
                }
            }


            /*
            VIDEO SRC
            */

            if (!videoUrl) {

                const videoSrcRegex =
                    /<video\b[^>]*\bsrc=["']([^"']+)["']/gi;


                let found;


                while (
                    (
                        found =
                            videoSrcRegex.exec(
                                html
                            )
                    ) !== null
                ) {

                    const candidate =
                        absoluteUrl(
                            found[1],
                            pageUrl
                        );


                    const valid =
                        isPublicMediaUrl(
                            candidate
                        );


                    if (valid) {

                        videoUrl =
                            valid;

                        break;
                    }
                }
            }


            /*
            SOURCE SRC
            */

            if (!videoUrl) {

                const sourceRegex =
                    /<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;


                let found;


                while (
                    (
                        found =
                            sourceRegex.exec(
                                html
                            )
                    ) !== null
                ) {

                    const candidate =
                        absoluteUrl(
                            found[1],
                            pageUrl
                        );


                    const valid =
                        isPublicMediaUrl(
                            candidate
                        );


                    if (valid) {

                        videoUrl =
                            valid;

                        break;
                    }
                }
            }


            /*
            DATA VIDEO / DATA SRC
            */

            if (!videoUrl) {

                const dataPatterns = [

                    /\bdata-video=["']([^"']+)["']/gi,

                    /\bdata-video-url=["']([^"']+)["']/gi,

                    /\bdata-src=["']([^"']+)["']/gi,

                    /\bdata-file=["']([^"']+)["']/gi
                ];


                for (
                    const pattern
                    of dataPatterns
                ) {

                    let found;


                    while (
                        (
                            found =
                                pattern.exec(html)
                        ) !== null
                    ) {

                        const candidate =
                            absoluteUrl(
                                found[1],
                                pageUrl
                            );


                        const valid =
                            isPublicMediaUrl(
                                candidate
                            );


                        if (valid) {

                            videoUrl =
                                valid;

                            break;
                        }
                    }


                    if (videoUrl) {
                        break;
                    }
                }
            }


            /*
            IFRAME
            */

            if (!videoUrl) {

                const iframeRegex =
                    /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;


                let found;


                while (
                    (
                        found =
                            iframeRegex.exec(
                                html
                            )
                    ) !== null
                ) {

                    const candidate =
                        absoluteUrl(
                            found[1],
                            pageUrl
                        );


                    const valid =
                        isPublicPlayerUrl(
                            candidate
                        );


                    if (valid) {

                        playerUrl =
                            valid;

                        break;
                    }
                }
            }


            /*
            ABYSS PLAYER
            */

            if (
                !videoUrl &&
                !playerUrl
            ) {

                const abyssRegex =
                    /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<>\s]+/gi;


                const matches =
                    html.match(
                        abyssRegex
                    ) || [];


                for (
                    const candidate
                    of matches
                ) {

                    const valid =
                        isPublicPlayerUrl(
                            candidate
                        );


                    if (valid) {

                        playerUrl =
                            valid;

                        break;
                    }
                }
            }


            if (videoUrl) {

                return {
                    videoUrl,
                    playerUrl: "",
                    playerType: "mp4"
                };
            }


            if (playerUrl) {

                return {
                    videoUrl: "",
                    playerUrl,
                    playerType: "iframe"
                };
            }


            return {
                videoUrl: "",
                playerUrl: "",
                playerType: ""
            };
        }


        /*
        ============================================================
        EXTRACT SERVER 2
        ============================================================
        */

        function extractServer2(
            html,
            pageUrl
        ) {

            if (!html) {
                return "";
            }


            const iframeRegex =
                /<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;


            let found;


            while (
                (
                    found =
                        iframeRegex.exec(html)
                ) !== null
            ) {

                const candidate =
                    absoluteUrl(
                        found[1],
                        pageUrl
                    );


                const valid =
                    isPublicPlayerUrl(
                        candidate
                    );


                if (valid) {
                    return valid;
                }
            }


            const abyssRegex =
                /https?:\/\/(?:www\.)?abyssplayer\.com\/[^"'\\<>\s]+/gi;


            const matches =
                html.match(
                    abyssRegex
                ) || [];


            for (
                const candidate
                of matches
            ) {

                const valid =
                    isPublicPlayerUrl(
                        candidate
                    );


                if (valid) {
                    return valid;
                }
            }


            return "";
        }


        /*
        ============================================================
        MOVIE DETAILS
        ============================================================
        */

        const detailedMovies =
            await Promise.all(
                movies.map(
                    async movie => {

                        try {

                            /*
                            DETAIL PAGE
                            */

                            const detailResponse =
                                await fetch(
                                    movie.sourceUrl,
                                    {
                                        headers: {
                                            "User-Agent":
                                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                            "Accept":
                                                "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8",

                                            "Accept-Language":
                                                "en-US,en;q=0.9"
                                        }
                                    }
                                );

 
                            if (
                                !detailResponse.ok
                            ) {
                                return movie;
                            }


                            const detailHtml =
                                await detailResponse.text();


                            /*
                            ==================================================
                            WATCH PAGE
                            ==================================================
                            */

                            let watchUrl =
                                movie.watchUrl;


                            let server1Url =
                                "";

                            let server2Url =
                                "";


                            let watchHtml =
                                "";


                            try {

                                const watchResponse =
                                    await fetch(
                                        watchUrl,
                                        {
                                            headers: {
                                                "User-Agent":
                                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                                "Accept":
                                                    "text/html,application/xhtml+xml,*/*;q=0.8",

                                                "Accept-Language":
                                                    "en-US,en;q=0.9",

                                                "Referer":
                                                    movie.sourceUrl
                                            }
                                        }
                                    );


                                if (
                                    watchResponse.ok
                                ) {

                                    watchHtml =
                                        await watchResponse.text();


                                    /*
                                    Find the REAL server links
                                    from the watch page.
                                    */

                                    const serverLinks =
                                        extractWatchLinks(
                                            watchHtml,
                                            watchUrl
                                        );


                                    if (
                                        serverLinks.watchUrl
                                    ) {

                                        watchUrl =
                                            serverLinks.watchUrl;
                                    }


                                    server1Url =
                                        serverLinks.server1Url;

                                    server2Url =
                                        serverLinks.server2Url;


                                    /*
                                    Download link is normally
                                    exposed on this page.
                                    */

                                }

                            } catch (
                                watchError
                            ) {

                                console.error(
                                    "Watch page failed:",
                                    watchUrl,
                                    watchError
                                );
                            }


                            /*
                            ==================================================
                            DOWNLOAD URL
                            ==================================================
                            */

                            let downloadUrl =
                                "";


                            /*
                            1. Detail page
                            */

                            downloadUrl =
                                extractDownloadUrl(
                                    detailHtml,
                                    movie.sourceUrl
                                );


                            /*
                            2. Watch page
                            */

                            if (
                                !downloadUrl &&
                                watchHtml
                            ) {

                                downloadUrl =
                                    extractDownloadUrl(
                                        watchHtml,
                                        watchUrl
                                    );
                            }


                            /*
                            3. If watch page did not expose it,
                            try the real server pages.
                            */

                            if (
                                !downloadUrl &&
                                server1Url
                            ) {

                                try {

                                    const server1DownloadResponse =
                                        await fetch(
                                            server1Url,
                                            {
                                                headers: {
                                                    "User-Agent":
                                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                                    "Accept":
                                                        "text/html,application/xhtml+xml,*/*;q=0.8",

                                                    "Accept-Language":
                                                        "en-US,en;q=0.9",

                                                    "Referer":
                                                        watchUrl
                                                }
                                            }
                                        );


                                    if (
                                        server1DownloadResponse.ok
                                    ) {

                                        const server1DownloadHtml =
                                            await server1DownloadResponse.text();


                                        downloadUrl =
                                            extractDownloadUrl(
                                                server1DownloadHtml,
                                                server1Url
                                            );
                                    }

                                } catch (
                                    error
                                ) {

                                    console.error(
                                        "Server 1 download extraction failed:",
                                        server1Url,
                                        error
                                    );
                                }
                            }


                            if (
                                !downloadUrl &&
                                server2Url
                            ) {

                                try {

                                    const server2DownloadResponse =
                                        await fetch(
                                            server2Url,
                                            {
                                                headers: {
                                                    "User-Agent":
                                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                                    "Accept":
                                                        "text/html,application/xhtml+xml,*/*;q=0.8",

                                                    "Accept-Language":
                                                        "en-US,en;q=0.9",

                                                    "Referer":
                                                        watchUrl
                                                }
                                            }
                                        );


                                    if (
                                        server2DownloadResponse.ok
                                    ) {

                                        const server2DownloadHtml =
                                            await server2DownloadResponse.text();


                                        downloadUrl =
                                            extractDownloadUrl(
                                                server2DownloadHtml,
                                                server2Url
                                            );
                                    }

                                } catch (
                                    error
                                ) {

                                    console.error(
                                        "Server 2 download extraction failed:",
                                        server2Url,
                                        error
                                    );
                                }
                            }

/*
==================================================
PROTECT DOWNLOAD URL THROUGH NETLIFY PROXY
==================================================
*/

if (downloadUrl) {

    try {

        const parsedDownload =
            new URL(downloadUrl);

        if (
            parsedDownload.hostname ===
            "media.agasobanuyenow.com"
        ) {

            downloadUrl =
                `https://moviepulse247.netlify.app/.netlify/functions/agasobanuye-download?url=${encodeURIComponent(
                    parsedDownload.href
                )}`;
        }

    } catch (error) {

        console.error(
            "Download URL proxy error:",
            downloadUrl,
            error
        );
    }
}
                            /*
                            IMPORTANT:
                            We do NOT fetch the final media URL.
                            We only expose the public URL.
                            */


                            /*
                            ==================================================
                            POSTER
                            ==================================================
                            */

                            let poster =
                                "";


                            const ogImage =
                                detailHtml.match(
                                    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
                                );


                            if (ogImage) {
                                poster =
                                    ogImage[1];
                            }


                            if (!poster) {

                                const ogImageReverse =
                                    detailHtml.match(
                                        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
                                    );


                                if (ogImageReverse) {

                                    poster =
                                        ogImageReverse[1];
                                }
                            }


                            if (!poster) {

                                const twitterImage =
                                    detailHtml.match(
                                        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
                                    );


                                if (twitterImage) {

                                    poster =
                                        twitterImage[1];
                                }
                            }


                            if (!poster) {

                                const imageRegex =
                                    /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi;


                                let imageMatch;


                                const possibleImages =
                                    [];


                                while (
                                    (
                                        imageMatch =
                                            imageRegex.exec(
                                                detailHtml
                                            )
                                    ) !== null
                                ) {

                                    const imageUrl =
                                        imageMatch[1];


                                    if (
                                        !imageUrl ||
                                        imageUrl.startsWith(
                                            "data:"
                                        )
                                    ) {
                                        continue;
                                    }


                                    try {

                                        possibleImages.push(
                                            new URL(
                                                imageUrl,
                                                movie.sourceUrl
                                            ).href
                                        );

                                    } catch {}
                                }


                                poster =
                                    possibleImages.find(
                                        src =>
                                            /poster|cover|thumbnail/i.test(
                                                src
                                            )
                                    ) ||
                                    possibleImages.find(
                                        src =>
                                            /\.(jpg|jpeg|png|webp)(\?|$)/i.test(
                                                src
                                            )
                                    ) ||
                                    "";
                            }


                            if (poster) {

                                try {

                                    poster =
                                        new URL(
                                            poster,
                                            movie.sourceUrl
                                        ).href;

                                } catch {}
                            }


                            /*
                            ==================================================
                            SUMMARY
                            ==================================================
                            */

                            let summary =
                                "";


                            const description =
                                detailHtml.match(
                                    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
                                );


                            if (description) {

                                summary =
                                    description[1]
                                        .replace(
                                            /\s+/g,
                                            " "
                                        )
                                        .trim();
                            }


                            /*
                            ==================================================
                            TITLE
                            ==================================================
                            */

                            let realTitle =
                                "";


                            const h1Match =
                                detailHtml.match(
                                    /<h1[^>]*>([\s\S]*?)<\/h1>/i
                                );


                            if (h1Match) {

                                realTitle =
                                    h1Match[1]
                                        .replace(
                                            /<[^>]+>/g,
                                            ""
                                        )
                                        .replace(
                                            /\s+/g,
                                            " "
                                        )
                                        .trim();
                            }


                            if (!realTitle) {

                                const ogTitle =
                                    detailHtml.match(
                                        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
                                    );


                                if (ogTitle) {

                                    realTitle =
                                        ogTitle[1]
                                            .replace(
                                                /\s+/g,
                                                " "
                                            )
                                            .trim();
                                }
                            }


                            if (!realTitle) {

                                const titleMatch =
                                    detailHtml.match(
                                        /<title[^>]*>([\s\S]*?)<\/title>/i
                                    );


                                if (titleMatch) {

                                    realTitle =
                                        titleMatch[1]
                                            .replace(
                                                /<[^>]+>/g,
                                                ""
                                            )
                                            .replace(
                                                /\s+/g,
                                                " "
                                            )
                                            .trim();
                                }
                            }


                            realTitle =
                                realTitle
                                    .replace(
                                        /\s*[-|–]\s*Agasobanuye\s*FREE.*$/i,
                                        ""
                                    )
                                    .replace(
                                        /\s*[-|–]\s*Agasobanuye.*$/i,
                                        ""
                                    )
                                    .replace(
                                        /\s*\|\s*Agasobanuye.*$/i,
                                        ""
                                    )
                                    .trim();


                            if (!realTitle) {

                                realTitle =
                                    movie.title ||
                                    "Untitled Movie";
                            }


                            /*
                            ==================================================
                            CATEGORY
                            ==================================================
                            */

                            let movieCategory =
                                "Movie";


                            const categoryMatch =
                                detailHtml.match(
                                    /(?:Genre|Category)[^<]{0,80}<\/[^>]+>\s*<[^>]+>([^<]+)/i
                                );


                            if (categoryMatch) {

                                movieCategory =
                                    categoryMatch[1]
                                        .replace(
                                            /\s+/g,
                                            " "
                                        )
                                        .trim();
                            }


                            /*
                            ==================================================
                            DURATION
                            ==================================================
                            */

                            let duration =
                                "";


                            const durationMatch =
                                detailHtml.match(
                                    /(?:Duration|Runtime)[^<]{0,100}(\d{1,3}\s*(?:min|mins|minutes|h|hr|hrs))/i
                                );


                            if (durationMatch) {

                                duration =
                                    durationMatch[1]
                                        .trim();
                            }


                            /*
                            ==================================================
                            SERVER 1
                            ==================================================
                            */

                            let server1VideoUrl =
                                "";

                            let server1PlayerUrl =
                                "";

                            let server1PlayerType =
                                "";


                            if (server1Url) {

                                try {

                                    const server1Response =
                                        await fetch(
                                            server1Url,
                                            {
                                                headers: {
                                                    "User-Agent":
                                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                                    "Accept":
                                                        "text/html,application/xhtml+xml,*/*;q=0.8",

                                                    "Accept-Language":
                                                        "en-US,en;q=0.9",

                                                    "Referer":
                                                        watchUrl
                                                }
                                            }
                                        );


                                    if (
                                        server1Response.ok
                                    ) {

                                        const server1Html =
                                            await server1Response.text();


                                        const server1 =
                                            extractServer1(
                                                server1Html,
                                                server1Url
                                            );


                                        server1VideoUrl =
                                            server1.videoUrl;


                                        server1PlayerUrl =
                                            server1.playerUrl;


                                        server1PlayerType =
                                            server1.playerType;
                                    }

                                } catch (
                                    server1Error
                                ) {

                                    console.error(
                                        "Server 1 extraction failed:",
                                        server1Url,
                                        server1Error
                                    );
                                }
                            }


                            /*
                            SERVER 1 VIDEO
                            */

                            if (
                                server1VideoUrl
                            ) {

                                return {

                                    ...movie,

                                    title:
                                        realTitle,

                                    poster,

                                    summary,

                                    category:
                                        movieCategory,

                                    duration,

                                    watchUrl,

                                    server1Url,

                                    server2Url,

                                    downloadUrl,

                                    playerUrl:
                                        server1VideoUrl,

                                    playerType:
                                        "mp4",

                                    server1VideoUrl,

                                    server1PlayerUrl,

                                    server2PlayerUrl:
                                        "",

                                    sourcePriority:
                                        "server1"
                                };
                            }


                            /*
                            SERVER 1 PLAYER
                            */

                            if (
                                server1PlayerUrl
                            ) {

                                return {

                                    ...movie,

                                    title:
                                        realTitle,

                                    poster,

                                    summary,

                                    category:
                                        movieCategory,

                                    duration,

                                    watchUrl,

                                    server1Url,

                                    server2Url,

                                    downloadUrl,

                                    playerUrl:
                                        server1PlayerUrl,

                                    playerType:
                                        server1PlayerType ||
                                        "iframe",

                                    server1VideoUrl:
                                        "",

                                    server1PlayerUrl,

                                    server2PlayerUrl:
                                        "",

                                    sourcePriority:
                                        "server1"
                                };
                            }


                            /*
                            ==================================================
                            SERVER 2
                            ==================================================
                            */

                            let server2PlayerUrl =
                                "";


                            if (server2Url) {

                                try {

                                    const server2Response =
                                        await fetch(
                                            server2Url,
                                            {
                                                headers: {
                                                    "User-Agent":
                                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                                                    "Accept":
                                                        "text/html,application/xhtml+xml,*/*;q=0.8",

                                                    "Accept-Language":
                                                        "en-US,en;q=0.9",

                                                    "Referer":
                                                        watchUrl
                                                }
                                            }
                                        );


                                    if (
                                        server2Response.ok
                                    ) {

                                        const server2Html =
                                            await server2Response.text();


                                        server2PlayerUrl =
                                            extractServer2(
                                                server2Html,
                                                server2Url
                                            );
                                    }

                                } catch (
                                    server2Error
                                ) {

                                    console.error(
                                        "Server 2 extraction failed:",
                                        server2Url,
                                        server2Error
                                    );
                                }
                            }


                            /*
                            SERVER 2 RESULT
                            */

                            if (
                                server2PlayerUrl
                            ) {

                                return {

                                    ...movie,

                                    title:
                                        realTitle,

                                    poster,

                                    summary,

                                    category:
                                        movieCategory,

                                    duration,

                                    watchUrl,

                                    server1Url,

                                    server2Url,

                                    downloadUrl,

                                    playerUrl:
                                        server2PlayerUrl,

                                    playerType:
                                        "iframe",

                                    server1VideoUrl:
                                        "",

                                    server1PlayerUrl:
                                        "",

                                    server2PlayerUrl,

                                    sourcePriority:
                                        "server2"
                                };
                            }


                            /*
                            ==================================================
                            NOTHING AVAILABLE
                            ==================================================
                            */

                            return {

                                ...movie,

                                title:
                                    realTitle,

                                poster,

                                summary,

                                category:
                                    movieCategory,

                                duration,

                                watchUrl,

                                server1Url,

                                server2Url,

                                downloadUrl,

                                playerUrl:
                                    "",

                                playerType:
                                    "",

                                server1VideoUrl:
                                    "",

                                server1PlayerUrl:
                                    "",

                                server2PlayerUrl:
                                    "",

                                sourcePriority:
                                    "none"
                            };


                        } catch (
                            error
                        ) {

                            console.error(
                                "Movie detail error:",
                                movie.sourceUrl,
                                error
                            );


                            return movie;
                        }
                    }
                )
            );


        /*
        ============================================================
        RESPONSE
        ============================================================
        */

        return json({

            success:
                true,

            source:
                "Agasobanuye FREE",

            page,

            limit,

            category:
                category || null,

            count:
                detailedMovies.length,

            hasNext:
                detailedMovies.length >= limit,

            movies:
                detailedMovies
        });


    } catch (
        error
    ) {

        console.error(
            "Agasobanuye function error:",
            error
        );


        return json(
            {
                success:
                    false,

                error:
                    error.message,

                movies:
                    []
            },
            500
        );
    }
};


/*
============================================================
JSON RESPONSE HELPER
============================================================
*/

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
                    "application/json; charset=utf-8",

                "Cache-Control":
                    "public, max-age=300",

                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Methods":
                    "GET, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type"
            }
        }
    );
}
