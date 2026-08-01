const container = document.getElementById("shorts-container");

shorts.forEach(short => {

    // Extract the video ID from the TikTok URL
    const videoId = short.tiktok.split("/video/")[1];


    container.innerHTML += `

    <div class="short-card">

        <blockquote
            class="tiktok-embed"
            cite="${short.tiktok}"
            data-video-id="${videoId}"
            style="max-width:325px; min-width:325px;">

            <section>
                <a target="_blank" href="https://www.tiktok.com/@moviepulse_247">
                    @moviepulse_247
                </a>
            </section>

        </blockquote>


        <h3>${short.title}</h3>

        <p>${short.description}</p>


        ${
            short.movieId 
            ? `
            <a href="trailer.html?id=${short.movieId}" class="watch-movie-btn">
                🎬 Movie Details
            </a>
            `
            : ""
        }


    </div>

    `;

});


// Tell TikTok to render the newly added embeds
if (window.tiktokEmbed && typeof window.tiktokEmbed.load === "function") {
    window.tiktokEmbed.load();
}
