const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const movie = movies.find(
  m => String(m.id) === String(id)
);

const watchTitle = document.getElementById("watchTitle");
const playerBox = document.getElementById("playerBox");
const movieInfo = document.getElementById("movieInfo");
const backButton = document.getElementById("backButton");


// ==========================================
// MOVIE NOT FOUND
// ==========================================

if (!movie) {

  watchTitle.textContent = "Movie Not Found";

  playerBox.innerHTML = `
    <div class="watch-error">

      <h2>Movie not found</h2>

      <p>
        We couldn't find this movie in MoviePulse.
      </p>

      <a
        href="index.html"
        class="error-back"
      >
        Back to MoviePulse
      </a>

    </div>
  `;

}


// ==========================================
// MOVIE FOUND
// ==========================================

else {

  document.title =
    `Watch ${movie.title} | MoviePulse`;

  watchTitle.innerHTML =
    `Watch <span>${escapeHTML(movie.title)}</span>`;


  // Back to trailer page

  backButton.href =
    `trailer.html?id=${encodeURIComponent(movie.id)}`;


  // Movie information

  movieInfo.innerHTML = `

    <h2>
      ${escapeHTML(movie.title)}
    </h2>

    <div class="movie-meta">

      ${movie.year ? movie.year : ""}

      ${movie.rating
        ? ` • ⭐ ${movie.rating}`
        : ""
      }

    </div>

    <div class="movie-summary">

      ${escapeHTML(
        movie.summary ||
        "No movie description available."
      )}

    </div>

  `;


  // ========================================
  // CHECK ARCHIVE ID
  // ========================================

  if (!movie.archiveId) {

    playerBox.innerHTML = `

      <div class="watch-error">

        <h2>Full Movie Unavailable</h2>

        <p>
          This movie does not currently have
          an authorized full-movie source on MoviePulse.
        </p>

      </div>

    `;

  }

  else {

    loadInternetArchiveMovie(movie);

  }

}


// ==========================================
// LOAD INTERNET ARCHIVE MOVIE
// ==========================================

async function loadInternetArchiveMovie(movie) {

  try {

    const identifier =
      encodeURIComponent(movie.archiveId);

    const response = await fetch(
      `https://archive.org/metadata/${identifier}`
    );

    if (!response.ok) {
      throw new Error("Archive request failed");
    }

    const data = await response.json();

    if (!data.files || !data.files.length) {
      throw new Error("No files available");
    }


    // ======================================
    // FIND VIDEO FILES
    // ======================================

    const videoFiles = data.files.filter(file => {

      if (!file.name) return false;

      const name =
        file.name.toLowerCase();

      return (
        name.endsWith(".mp4") ||
        name.endsWith(".webm") ||
        name.endsWith(".ogv") ||
        name.endsWith(".ogg")
      );

    });


    if (!videoFiles.length) {
      throw new Error("No playable video found");
    }


    // ======================================
    // PREFER MP4
    // ======================================

    const mp4Files =
      videoFiles.filter(file =>
        file.name.toLowerCase().endsWith(".mp4")
      );


    const candidates =
      mp4Files.length
        ? mp4Files
        : videoFiles;


    // ======================================
    // PICK LARGEST REASONABLE FILE
    // ======================================

    const selectedFile =
      candidates.reduce(
        (largest, file) => {

          const currentSize =
            Number(file.size || 0);

          const largestSize =
            Number(largest.size || 0);

          return currentSize > largestSize
            ? file
            : largest;

        },
        candidates[0]
      );


    const videoURL =
      `https://archive.org/download/` +
      `${encodeURIComponent(movie.archiveId)}/` +
      `${encodeURIComponent(selectedFile.name)}`;


    const archiveURL =
      `https://archive.org/details/` +
      `${encodeURIComponent(movie.archiveId)}`;


    const mimeType =
      getVideoMimeType(selectedFile.name);


    // ======================================
    // PLAYER
    // ======================================

    playerBox.innerHTML = `

      <video
        id="movieVideo"
        class="archive-video"
        controls
        playsinline
        preload="metadata"
        poster="${escapeHTML(movie.poster || "")}"
      >

        <source
          src="${videoURL}"
          type="${mimeType}"
        >

        Your browser does not support
        HTML5 video.

      </video>

      <div class="source-area">

        <a
          href="${archiveURL}"
          target="_blank"
          rel="noopener noreferrer"
          class="source-btn"
        >
          Source: Internet Archive ↗
        </a>

      </div>

    `;


    // ======================================
    // PLAYBACK ERROR
    // ======================================

    const video =
      document.getElementById("movieVideo");


    video.addEventListener(
      "error",
      () => {

        playerBox.innerHTML = `

          <div class="watch-error">

            <h2>Playback Error</h2>

            <p>
              This video could not be played
              right now.
            </p>

            <a
              href="${archiveURL}"
              target="_blank"
              rel="noopener noreferrer"
              class="error-back"
            >
              Open Internet Archive
            </a>

          </div>

        `;

      }
    );

  }

  catch (error) {

    console.error(
      "Internet Archive error:",
      error
    );


    playerBox.innerHTML = `

      <div class="watch-error">

        <h2>Movie Could Not Be Loaded</h2>

        <p>
          The authorized movie source could not
          be loaded right now.
        </p>

      </div>

    `;

  }

}


// ==========================================
// MIME TYPE
// ==========================================

function getVideoMimeType(filename) {

  const name =
    filename.toLowerCase();

  if (name.endsWith(".mp4")) {
    return "video/mp4";
  }

  if (name.endsWith(".webm")) {
    return "video/webm";
  }

  if (
    name.endsWith(".ogv") ||
    name.endsWith(".ogg")
  ) {
    return "video/ogg";
  }

  return "video/mp4";

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
