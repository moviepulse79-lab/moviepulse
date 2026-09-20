export default async (req) => {
    try {
        const requestUrl = new URL(req.url);

        const fileUrl = requestUrl.searchParams.get("url");

        if (!fileUrl) {
            return new Response("Missing download URL", {
                status: 400
            });
        }

        const parsed = new URL(fileUrl);

        /*
        Only allow the Agasobanuye media host.
        */
        if (
            parsed.hostname !==
            "media.agasobanuyenow.com"
        ) {
            return new Response("Invalid download host", {
                status: 400
            });
        }

        /*
        Request the file from the media server.
        */
        const response = await fetch(fileUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                "Accept":
                    "video/mp4,video/*,*/*;q=0.8",

                "Referer":
                    "https://agasobanuyefree.com/",

                "Origin":
                    "https://agasobanuyefree.com"
            }
        });

        if (!response.ok) {
            return new Response(
                `Source download returned ${response.status}`,
                {
                    status: response.status
                }
            );
        }

        /*
        Pass the source response back to the browser.
        */
        const headers = new Headers();

        const contentType =
            response.headers.get("content-type");

        const contentLength =
            response.headers.get("content-length");

        const contentDisposition =
            response.headers.get("content-disposition");

        if (contentType) {
            headers.set(
                "Content-Type",
                contentType
            );
        }

        if (contentLength) {
            headers.set(
                "Content-Length",
                contentLength
            );
        }

        if (contentDisposition) {
            headers.set(
                "Content-Disposition",
                contentDisposition
            );
        } else {
            headers.set(
                "Content-Disposition",
                "attachment"
            );
        }

        headers.set(
            "Access-Control-Allow-Origin",
            "*"
        );

        return new Response(
            response.body,
            {
                status: 200,
                headers
            }
        );

    } catch (error) {

        console.error(
            "Agasobanuye download error:",
            error
        );

        return new Response(
            "Download failed",
            {
                status: 500
            }
        );
    }
};
