
// ===============================
// MOVIEPULSE SHORTS
// SUPABASE STORAGE
// ===============================

const shortsGrid =
    document.getElementById("shortsGrid");


// ===============================
// LOAD SHORTS
// ===============================

async function loadShorts() {

    if (!shortsGrid) {

        console.error(
            "shortsGrid not found."
        );

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

        console.log(
            "Loading Shorts from Supabase..."
        );


        // ===============================
        // GET SHORTS FROM RPC
        // ===============================

        const {
            data: files,
            error
        } = await supabaseClient
            .rpc("get_moviepulse_shorts");


        console.log(
            "SHORTS FROM RPC:",
            {
                files,
                error
            }
        );


        // ===============================
        // CHECK ERROR
        // ===============================

        if (error) {

            console.error(
                "Supabase error:",
                error
            );

            throw error;
        }


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


        // ===============================
        // CLEAR LOADING
        // ===============================

        shortsGrid.innerHTML = "";


        // ===============================
        // CREATE SHORT CARDS
        // ===============================

        files.forEach(file => {

            if (!file.name) return;


            // Only video files

            const isVideo =
                /\.(mp4|webm|mov|m4v)$/i
                .test(file.name);


            if (!isVideo) return;


            // ===============================
            // PUBLIC VIDEO URL
            // ===============================

            const {
                data: publicData
            } = supabaseClient
                .storage
                .from("shorts")
                .getPublicUrl(file.name);


            const videoUrl =
                publicData.publicUrl;


            // ===============================
            // CREATE CARD
            // ===============================

            const card =
                document.createElement("article");

            card.className =
                "short-card";


            card.innerHTML = `

                <div class="short-video">

                    <video
                        playsinline
                        preload="metadata">

                        <source
                            src="${videoUrl}"
                            type="video/mp4">

                        Your browser does not
                        support this video.

                    </video>


                    <!-- MOVIEPULSE PLAY BUTTON -->

                    <button
                        class="short-play"
                        type="button"
                        aria-label="Play Short">

                        ▶

                    </button>


                    <!-- SHORT BADGE -->

                    <span class="short-badge">

                        SHORT

                    </span>

                </div>

            `;


            // ===============================
            // ADD CARD
            // ===============================

            shortsGrid.appendChild(card);


            // ===============================
            // GET VIDEO + BUTTON
            // ===============================

            const video =
                card.querySelector("video");

            const playButton =
                card.querySelector(".short-play");


            // ===============================
            // PLAY BUTTON
            // ===============================

            playButton.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();


                    if (video.paused) {

                        // Stop all other Shorts

                        document
                            .querySelectorAll(
                                ".short-video video"
                            )
                            .forEach(
                                otherVideo => {

                                    if (
                                        otherVideo !==
                                        video
                                    ) {

                                        otherVideo.pause();

                                    }

                                }
                            );


                        video.play();

                    } else {

                        video.pause();

                    }

                }
            );


            // ===============================
            // VIDEO PLAY EVENT
            // ===============================

            video.addEventListener(
                "play",
                () => {


                    // Stop all other Shorts

                    document
                        .querySelectorAll(
                            ".short-video video"
                        )
                        .forEach(
                            otherVideo => {

                                if (
                                    otherVideo !==
                                    video
                                ) {

                                    otherVideo.pause();

                                }

                            }
                        );


                    playButton.textContent =
                        "⏸";

                }
            );


            // ===============================
            // VIDEO PAUSE EVENT
            // ===============================

            video.addEventListener(
                "pause",
                () => {

                    playButton.textContent =
                        "▶";

                }
            );


            // ===============================
            // CLICK VIDEO
            // ===============================

            video.addEventListener(
                "click",
                () => {

                    if (video.paused) {

                        video.play();

                    } else {

                        video.pause();

                    }

                }
            );

        });


        // ===============================
        // CHECK VIDEO FILES
        // ===============================

        if (
            shortsGrid.children.length === 0
        ) {

            shortsGrid.innerHTML = `
                <p style="
                    color:#777;
                    width:100%;
                    text-align:center;
                    padding:30px;
                ">
                    No video files found
                    in the Shorts bucket.
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

