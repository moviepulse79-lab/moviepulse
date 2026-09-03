
// =====================================================
// MOVIEPULSE - INTERNET ARCHIVE SCANNER
// =====================================================

const scanBtn = document.getElementById("scanBtn");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");

const totalCount = document.getElementById("totalCount");
const goodCount = document.getElementById("goodCount");
const reviewCount = document.getElementById("reviewCount");
const noneCount = document.getElementById("noneCount");

const progressWrap =
  document.getElementById("progressWrap");

const progressFill =
  document.getElementById("progressFill");

const progressText =
  document.getElementById("progressText");


// -----------------------------------------------------
// SETTINGS
// -----------------------------------------------------

const SEARCH_DELAY = 1200;


// -----------------------------------------------------
// CHECK MOVIE DATABASE
// -----------------------------------------------------

if (!Array.isArray(movies)) {

  statusBox.textContent =
    "❌ Could not find the movies array.";

  resultsBox.innerHTML = `
    <div class="empty">
      <h3>Movie database not found</h3>

      <p>
        Make sure archive-scanner.html loads
        movie.js before archive-scanner.js.
      </p>
    </div>
  `;

  scanBtn.disabled = true;

} else {

  totalCount.textContent = movies.length;

}


// -----------------------------------------------------
// SLEEP
// -----------------------------------------------------

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}


// -----------------------------------------------------
// CLEAN TITLE
// -----------------------------------------------------

function cleanTitle(title) {

  return String(title || "")
    .replace(/\(\d{4}\)/g, "")
    .replace(/\[\d{4}\]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}


// -----------------------------------------------------
// SEARCH INTERNET ARCHIVE
// -----------------------------------------------------

async function searchArchive(movie) {

  const title = cleanTitle(movie.title);

  let query =
    `title:("${title}")`;

  if (movie.year) {

    query +=
      ` AND year:${movie.year}`;

  }

  const url =
    "https://archive.org/advancedsearch.php" +
    "?q=" +
    encodeURIComponent(query) +
    "&fl[]=identifier" +
    "&fl[]=title" +
    "&fl[]=year" +
    "&fl[]=description" +
    "&rows=10" +
    "&page=1" +
    "&output=json";

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `Search failed (${response.status})`
    );

  }

  const data =
    await response.json();

  return data?.response?.docs || [];

}


// -----------------------------------------------------
// GET ARCHIVE METADATA
// -----------------------------------------------------

async function getArchiveMetadata(identifier) {

  const url =
    `https://archive.org/metadata/${encodeURIComponent(identifier)}`;

  const response =
    await fetch(url);

  if (!response.ok) {

    throw new Error(
      `Metadata failed (${response.status})`
    );

  }

  return await response.json();

}


// -----------------------------------------------------
// CHECK FOR VIDEO FILES
// -----------------------------------------------------

function getVideoFiles(data) {

  if (!data || !Array.isArray(data.files)) {
    return [];
  }

  return data.files.filter(file => {

    if (!file.name) {
      return false;
    }

    const name =
      file.name.toLowerCase();

    return (
      name.endsWith(".mp4") ||
      name.endsWith(".webm") ||
      name.endsWith(".ogv") ||
      name.endsWith(".m4v")
    );

  });

}


// -----------------------------------------------------
// SCORE POSSIBLE MATCH
// -----------------------------------------------------

function scoreMatch(movie, result) {

  const movieTitle =
    cleanTitle(movie.title)
      .toLowerCase();

  const archiveTitle =
    cleanTitle(result.title)
      .toLowerCase();

  let score = 0;


  // Exact title
  if (movieTitle === archiveTitle) {

    score += 70;

  }

  // Archive title contains movie title
  else if (
    archiveTitle.includes(movieTitle) ||
    movieTitle.includes(archiveTitle)
  ) {

    score += 45;

  }

  // Year match
  if (
    movie.year &&
    result.year &&
    String(movie.year) === String(result.year)
  ) {

    score += 30;

  }


  return Math.min(score, 100);

}


// -----------------------------------------------------
// DETERMINE RESULT STATUS
// -----------------------------------------------------

function getStatus(score, hasVideo) {

  if (!hasVideo) {

    return {
      type: "none",
      label: "NO PLAYABLE VIDEO"
    };

  }

  if (score >= 90) {

    return {
      type: "good",
      label: "STRONG CANDIDATE"
    };

  }

  if (score >= 50) {

    return {
      type: "review",
      label: "NEEDS REVIEW"
    };

  }

  return {
    type: "none",
    label: "WEAK MATCH"
  };

}


// -----------------------------------------------------
// ESCAPE HTML
// -----------------------------------------------------

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// -----------------------------------------------------
// CREATE RESULT CARD
// -----------------------------------------------------

function createResultCard(
  movie,
  result,
  score,
  hasVideo,
  status
) {

  const archiveURL =
    `https://archive.org/details/${encodeURIComponent(result.identifier)}`;


  return `
    <div class="movie-result">

      <div class="movie-top">

        <div>

          <div class="movie-title">
            ${escapeHTML(movie.title)}
          </div>

          <div class="movie-year">
            Movie ID: ${escapeHTML(movie.id)}
            ${movie.year ? ` • ${escapeHTML(movie.year)}` : ""}
          </div>

        </div>

        <div
          class="result-status status-${status.type}"
        >
          ${status.label}
        </div>

      </div>


      <div class="details">

        <strong>
          Possible Archive Match:
        </strong>

        ${escapeHTML(
          result.title || "Unknown"
        )}

        <br>

        <strong>
          Archive ID:
        </strong>

        <span class="archive-id">
          ${escapeHTML(result.identifier)}
        </span>

        <br>

        <strong>
          Match Score:
        </strong>

        ${score}/100

        <br>

        <strong>
          Playable Video:
        </strong>

        ${hasVideo ? "YES" : "NO"}

        <br><br>

        <a
          href="${archiveURL}"
          target="_blank"
          rel="noopener noreferrer"
          style="
            color:#e50914;
            font-weight:700;
            text-decoration:none;
          "
        >
          🔗 Open Internet Archive
        </a>

      </div>

    </div>
  `;

}


// -----------------------------------------------------
// NO MATCH CARD
// -----------------------------------------------------

function createNoMatchCard(movie) {

  return `
    <div class="movie-result">

      <div class="movie-top">

        <div>

          <div class="movie-title">
            ${escapeHTML(movie.title)}
          </div>

          <div class="movie-year">
            Movie ID: ${escapeHTML(movie.id)}
            ${movie.year ? ` • ${escapeHTML(movie.year)}` : ""}
          </div>

        </div>

        <div
          class="result-status status-none"
        >
          NO MATCH
        </div>

      </div>

      <div class="details">
        No suitable Internet Archive result
        was found.
      </div>

    </div>
  `;

}


// -----------------------------------------------------
// SCAN ONE MOVIE
// -----------------------------------------------------

async function scanMovie(movie) {

  try {

    const results =
      await searchArchive(movie);


    if (!results.length) {

      return {
        movie,
        type: "none",
        cards: [
          createNoMatchCard(movie)
        ]
      };

    }


    const candidates = [];


    for (const result of results) {

      try {

        const metadata =
          await getArchiveMetadata(
            result.identifier
          );

        const videoFiles =
          getVideoFiles(metadata);

        const score =
          scoreMatch(movie, result);

        const status =
          getStatus(
            score,
            videoFiles.length > 0
          );


        candidates.push({

          result,
          score,
          hasVideo:
            videoFiles.length > 0,

          status

        });


      } catch (error) {

        console.warn(
          "Metadata error:",
          result.identifier,
          error
        );

      }

    }


    candidates.sort(
      (a, b) =>
        b.score - a.score
    );


    if (!candidates.length) {

      return {
        movie,
        type: "none",
        cards: [
          createNoMatchCard(movie)
        ]
      };

    }


    const best =
      candidates[0];


    return {

      movie,

      type:
        best.status.type,

      cards:
        candidates
          .slice(0, 3)
          .map(candidate =>
            createResultCard(
              movie,
              candidate.result,
              candidate.score,
              candidate.hasVideo,
              candidate.status
            )
          )

    };


  } catch (error) {

    console.error(
      "Scan error:",
      movie.title,
      error
    );


    return {

      movie,

      type: "none",

      cards: [`

        <div class="movie-result">

          <div class="movie-top">

            <div>

              <div class="movie-title">
                ${escapeHTML(movie.title)}
              </div>

              <div class="movie-year">
                Movie ID: ${escapeHTML(movie.id)}
              </div>

            </div>

            <div
              class="result-status status-none"
            >
              ERROR
            </div>

          </div>

          <div class="details">
            Scanner could not check this movie.
            Check the browser console for details.
          </div>

        </div>

      `]

    };

  }

}


// -----------------------------------------------------
// UPDATE STATS
// -----------------------------------------------------

function updateStats(results) {

  let good = 0;
  let review = 0;
  let none = 0;


  results.forEach(result => {

    if (result.type === "good") {
      good++;
    }

    else if (result.type === "review") {
      review++;
    }

    else {
      none++;
    }

  });


  goodCount.textContent = good;
  reviewCount.textContent = review;
  noneCount.textContent = none;

}


// -----------------------------------------------------
// MAIN SCANNER
// -----------------------------------------------------

async function startScan() {

  if (!Array.isArray(movies) || !movies.length) {

    statusBox.textContent =
      "❌ No movies found.";

    return;

  }


  scanBtn.disabled = true;

  progressWrap.style.display =
    "block";

  resultsBox.innerHTML = "";

  goodCount.textContent = "0";
  reviewCount.textContent = "0";
  noneCount.textContent = "0";


  const scanResults = [];


  progressFill.style.width =
    "0%";

  progressText.textContent =
    `0 / ${movies.length}`;


  statusBox.textContent =
    `Starting scan of ${movies.length} movies...`;


  for (
    let i = 0;
    i < movies.length;
    i++
  ) {

    const movie =
      movies[i];


    statusBox.textContent =
      `Scanning: ${movie.title}`;


    const result =
      await scanMovie(movie);


    scanResults.push(result);


    resultsBox.insertAdjacentHTML(
      "beforeend",
      result.cards.join("")
    );


    const progress =
      ((i + 1) / movies.length) * 100;


    progressFill.style.width =
      `${progress}%`;


    progressText.textContent =
      `${i + 1} / ${movies.length}`;


    updateStats(scanResults);


    await sleep(
      SEARCH_DELAY
    );

  }


  statusBox.textContent =
    `✅ Scan complete. Checked ${movies.length} movies.`;


  scanBtn.disabled = false;

}


// -----------------------------------------------------
// BUTTON
// -----------------------------------------------------

scanBtn.addEventListener(
  "click",
  startScan
);

