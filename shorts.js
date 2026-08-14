```javascript
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
// START
// ===============================

loadShorts();
```
