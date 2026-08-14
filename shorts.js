
// ===============================
// MOVIEPULSE SHORTS
// SUPABASE STORAGE
// ===============================

const shortsGrid = document.getElementById("shortsGrid");
const featuredVideo = document.getElementById("featuredVideo");


// ===============================
// SUPABASE STORAGE BUCKET
// ===============================

const SHORTS_BUCKET = "shorts";


// ===============================
// GET PUBLIC VIDEO URL
// ===============================

function getShortUrl(filename) {

    const {
        data
    } = supabaseClient
        .storage
        .from(SHORTS_BUCKET)
        .getPublicUrl(filename);

    return data.publicUrl;
}


// ===============================
// LOAD SHORTS
// ===============================

function loadShorts() {

    const videoUrl = getShortUrl("0811.mp4");


    // =========================
    // FEATURED VIDEO
    // =========================

    if (featuredVideo) {

        featuredVideo.src = videoUrl;

    }


    // =========================
    // LATEST SHORT
    // =========================

    if (shortsGrid) {

        shortsGrid.innerHTML = "";


        const shortCard = document.createElement("article");

        shortCard.className = "short-card";


        shortCard.innerHTML = `

            <div class="short-video">

                <video
                    src="${videoUrl}"
                    controls
                    playsinline
                    preload="metadata">
                </video>

            </div>

        `;


        shortsGrid.appendChild(shortCard);

    }

}



// ===============================
// LOAD SHORTS
// ===============================

async function loadShorts() {

    if (!shortsGrid) return;

    shortsGrid.innerHTML = `
        <p style="
            color:#777;
            text-align:center;
            width:100%;
        ">
            Loading Shorts...
        </p>
    `;


    try {

        const {
            data,
            error
        } = await supabaseClient
            .storage
            .from("shorts")
            .list("", {
                limit: 100,
                sortBy: {
                    column: "created_at",
                    order: "desc"
                }
            });


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            shortsGrid.innerHTML = `
                <p style="
                    color:#777;
                    text-align:center;
                    width:100%;
                ">
                    No Shorts available yet.
                </p>
            `;

            return;
        }


        shortsGrid.innerHTML = "";


        data.forEach(file => {

            // Ignore folders
            if (!file.name) return;


            // Only allow video files
            const isVideo =
                /\.(mp4|webm|mov|m4v)$/i
                .test(file.name);


            if (!isVideo) return;


            const {
                data: publicUrl
            } =
                supabaseClient
                    .storage
                    .from("shorts")
                    .getPublicUrl(file.name);


            const card =
                document.createElement("article");

            card.className =
                "short-card";


            card.innerHTML = `

                <div class="short-video">

                    <video
                        controls
                        playsinline
                        preload="metadata">

                        <source
                            src="${publicUrl.publicUrl}"
                            type="video/mp4">

                        Your browser does not support
                        this video.
                    </video>

                </div>

            `;


            shortsGrid.appendChild(card);

        });


    } catch (error) {

        console.error(
            "Error loading Shorts:",
            error
        );


        shortsGrid.innerHTML = `
            <p style="
                color:#e50914;
                text-align:center;
                width:100%;
            ">
                Unable to load Shorts.
            </p>
        `;

    }

}


// ===============================
// START
// ===============================

loadShorts();



// ===============================
// START
// ===============================

loadShorts();
