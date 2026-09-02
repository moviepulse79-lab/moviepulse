document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");

  const watchTitle = document.getElementById("watchTitle");
  const playerBox = document.getElementById("playerBox");
  const movieInfo = document.getElementById("movieInfo");
  const backButton = document.getElementById("backButton");

  // Check movie ID
  if (!movieId) {
    showError("No movie was selected.");
    return;
  }

  // Find movie
  const movie = movies.find(
    m => String(m.id) === String(movieId)
  );

  if (!movie) {
    showError("Movie not found.");
    return;
  }

  // Page information
  watchTitle.textContent = `Watch ${movie.title}`;
  document.title = `Watch ${movie.title} | MoviePulse`;

  // Back to trailer page
  backButton.href = `trailer.html?id=${encodeURIComponent(movie.id)}`;

  // Movie information
  movieInfo.innerHTML = `
    <p>
      Now watching <strong>${escapeHTML(movie.title)}</strong>
    </p>
  `;

  // No Internet Archive ID
  if (!movie.archiveId) {
    showError(
      "The full movie is not currently available on MoviePulse."
    );
    return;
  }

  // Load Internet Archive video
  await loadArchiveMovie(movie);


  async function loadArchiveMovie(movie) {

    playerBox.innerHTML = `
      <div class="loading">
        Checking movie availability...
      </div>
    `;

    try {

      const metadataURL =
        `https://archive.org/metadata/${encodeURIComponent(movie.archiveId)}`;

      const response = await fetch(metadataURL);

      if (!response.ok) {
        throw new Error("Internet Archive request failed.");
      }

      const data = await response.json();

      if (!data.files || !Array.isArray(data.files)) {
        throw new Error("No files returned by Internet Archive.");
      }

      // Find playable video files
      const videoFiles = data.files.filter(file => {

        if (!file.name) return false;

        const name = file.name.toLowerCase();

        return (
          name.endsWith(".mp4") ||
          name.endsWith(".webm") ||
          name.endsWith(".ogv") ||
          name.endsWith(".ogg")
        );
      });

      if (!videoFiles.length) {
        throw new Error(
          "No playable video file was found for this movie."
        );
      }

      // Prefer MP4
      videoFiles.sort((a, b) => {

        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aMp4 = aName.endsWith(".mp4");
        const bMp4 = bName.endsWith(".mp4");

        if (aMp4 && !bMp4) return -1;
        if (!aMp4 && bMp4) return 1;

        return (Number(b.size) || 0) - (Number(a.size) || 0);
      });

      const selectedFile = videoFiles[0];

      const videoURL =
        `https://archive.org/download/${encodeURIComponent(movie.archiveId)}/${encodeURIComponent(selectedFile.name)}`;

      const archiveItemURL =
        `https://archive.org/details/${encodeURIComponent(movie.archiveId)}`;

      // Create player
      playerBox.innerHTML = `
        <video
          class="archive-video"
          controls
          playsinline
          preload="none"
          poster="${escapeAttribute(movie.poster || "")}"
        >
          <source
            src="${escapeAttribute(videoURL)}"
            type="${getVideoType(selectedFile.name)}"
          >

          Your browser does not support HTML5 video.
        </video>
      `;

      // Add Archive link
      playerBox.insertAdjacentHTML(
        "afterend",
        `
          <div style="text-align:right; margin-top:12px;">
            <a
              class="archive-link"
              href="${escapeAttribute(archiveItemURL)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Internet Archive Source
            </a>
          </div>
        `
      );

    } catch (error) {

      console.error("MoviePulse Archive error:", error);

      showError(
        "The full movie could not be loaded right now."
      );
    }
  }


  function showError(message) {

    playerBox.innerHTML = `
      <div class="error-box">
        <h2>🎬 Movie Unavailable</h2>
        <p>${escapeHTML(message)}</p>
      </div>
    `;
  }


  function getVideoType(filename) {

    const name = filename.toLowerCase();

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


  function escapeHTML(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function escapeAttribute(value) {
    return escapeHTML(value);
  }

});
