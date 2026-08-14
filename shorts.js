
// ===============================
// MOVIEPULSE SHORTS
// SUPABASE STORAGE
// ===============================

const shortsGrid = document.getElementById("shortsGrid");


// ===============================
// LOAD SHORTS
// ===============================

async function loadShorts() {

    if (!shortsGrid) {
        console.error("shortsGrid not found.");
        return;
    }

    shortsGrid.innerHTML = `
        <p style="
            color:#777;
            width:100%;
            text-align:center;
            padding:30px;
        ">
            Loading Shorts...
        </p>
    `;


    try {

        console.log("Loading Shorts from Supabase...");


const {
    data: files,
    error
} = await supabaseClient
    .rpc("get_moviepulse_shorts");

console.log("SHORTS FROM RPC:", {
    files,
    error
});


console.log("RAW STORAGE RESPONSE:", {
    files,
    error
});

        // ===============================
        // CHECK SUPABASE ERROR
        // ===============================

        if (error) {

            console.error(
                "Supabase Storage error:",
                error
            );

            throw error;
        }


        console.log(
            "Files found in shorts bucket:",
            files
        );


        // ===============================
        // NO FILES
        // ===============================

        if (!files || files.length === 0) {

            shortsGrid.innerHTML = `
                <p style="
                    color:#777;
                    width:100%;
                    text-align:center;
                    padding:30px;
                ">
                    No Shorts available yet.
                </p>
            `;

            return;
        }


        // Clear loading message

        shortsGrid.innerHTML = "";


        // ===============================
        // CREATE SHORT CARDS
        // ===============================

        files.forEach(file => {

            // Ignore folders

            if (!file.name) return;


            // Only videos

            const isVideo =
                /\.(mp4|webm|mov|m4v)$/i
                .test(file.name);


            if (!isVideo) return;


            // Get public URL

            const {
                data: publicData
            } = supabaseClient
                .storage
                .from("shorts")
                .getPublicUrl(file.name);


            const videoUrl =
                publicData.publicUrl;


            // Create card

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
                            src="${videoUrl}"
                            type="video/mp4">

                        Your browser does not support
                        this video.

                    </video>

                </div>

            `;


            shortsGrid.appendChild(card);

        });


        // ===============================
        // CHECK IF NO VIDEO FILES
        // ===============================

        if (shortsGrid.children.length === 0) {

            shortsGrid.innerHTML = `
                <p style="
                    color:#777;
                    width:100%;
                    text-align:center;
                    padding:30px;
                ">
                    No video files found in the Shorts bucket.
                </p>
            `;

        }


    } catch (error) {

        console.error(
            "ERROR LOADING SHORTS:",
            error
        );


        shortsGrid.innerHTML = `
            <p style="
                color:#e50914;
                width:100%;
                text-align:center;
                padding:30px;
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
