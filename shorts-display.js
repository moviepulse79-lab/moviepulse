const container = document.getElementById("shorts-container");


function displayShorts(shortList) {

    container.innerHTML = "";


    shortList.forEach(short => {

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
                ?
                `<a href="trailer.html?id=${short.movieId}" class="watch-movie-btn">
                🎬 Movie Details
                </a>`
                :
                ""
            }

        </div>

        `;

    });


    if(window.tiktokEmbed && typeof window.tiktokEmbed.load === "function"){
        window.tiktokEmbed.load();
    }

}



function filterShorts(category){

    if(category === "All"){
        displayShorts(shorts);
    }
    else{

        const filtered = shorts.filter(short => 
            short.category === category
        );

        displayShorts(filtered);

    }

}


// Load all shorts initially
displayShorts(shorts);
