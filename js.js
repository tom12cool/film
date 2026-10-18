const EBERT_FEED_URLS = [
  "https://www.rogerebert.com/reviews/feed",
  "https://www.rogerebert.com/feed"
];

const MOVIE_JSON_URL = "https://www.moviefone.com/feeds/reviews.json";
const MOVIE_RSS_URL = "https://www.moviefone.com/feeds/reviews.rss";

const FEED_PROXIES = [
  (url) =>
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent(url),

  (url) =>
    "https://corsproxy.io/?" +
    new URLSearchParams({ url }).toString()
];

const $ = (id) => document.getElementById(id);

let allReviews = [];
let refreshController = null;

function setStatus(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function cleanText(value) {
  if (value == null) return "";

  if (typeof value === "object") {
    if (typeof value._ === "string") return value._;
    if (typeof value.text === "string") return value.text;
    if (typeof value.value === "string") return value.value;
    return "";
  }

  const doc = new DOMParser().parseFromString(
    String(value),
    "text/html"
  );

  return (doc.body.textContent || "").trim();
}

function safeURL(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value), window.location.href);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch (error) {
    console.warn("Invalid feed URL:", value);
  }

  return "";
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function fetchFeedText(url, signal) {
  let lastError;

  for (const makeProxyURL of FEED_PROXIES) {
    if (signal?.aborted) {
      throw new Error("Feed refresh cancelled.");
    }

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 12000);

    const cancelRequest = () => controller.abort();

    signal?.addEventListener("abort", cancelRequest, {
      once: true
    });

    try {
      const response = await fetch(makeProxyURL(url), {
        method: "GET",
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      if (!text.trim()) {
        throw new Error("The feed returned an empty response.");
      }

      return text;
    } catch (error) {
      if (signal?.aborted) {
        throw new Error("Feed refresh cancelled.");
      }

      lastError = controller.signal.aborted
        ? new Error("Request timed out after 12 seconds.")
        : error;

      console.warn(
        `Feed proxy failed for ${url}:`,
        lastError.message
      );
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", cancelRequest);
    }
  }

  throw new Error(
    `All feed proxies failed. ${
      lastError?.message || "Unknown error."
    }`
  );
}

function normalizeReview(item, source) {
  const title = cleanText(
    item.title ??
    item["dc:title"] ??
    item.name ??
    ""
  );

  const linkValue =
    item.link?.href ??
    item.link?.["@_href"] ??
    item.link ??
    item.url ??
    item.guid ??
    "";

  const description = cleanText(
    item.description ??
    item.summary ??
    item.content ??
    item["content:encoded"] ??
    item["content:encoded#text"] ??
    ""
  );

  const date = cleanText(
    item.pubDate ??
    item.published ??
    item.updated ??
    item.date ??
    item["dc:date"] ??
    ""
  );

  const author = cleanText(
    item.author?.name ??
    item.author ??
    item.creator ??
    item["dc:creator"] ??
    ""
  );

  return {
    title: title || "Untitled review",
    link: safeURL(linkValue),
    description,
    date,
    author,
    source
  };
}

function parseReviewFeed(text, source) {
  // Try JSON first.
  try {
    const data = JSON.parse(text);

    let items = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray(data.items)) {
      items = data.items;
    } else if (Array.isArray(data.results)) {
      items = data.results;
    } else if (Array.isArray(data.articles)) {
      items = data.articles;
    } else if (Array.isArray(data.feed?.items)) {
      items = data.feed.items;
    } else if (Array.isArray(data.data)) {
      items = data.data;
    }

    if (items.length) {
      return items
        .map((item) => normalizeReview(item, source))
        .filter((item) => item.title !== "Untitled review");
    }
  } catch (error) {
    // Not JSON: continue to XML parsing.
  }

  const xml = new DOMParser().parseFromString(
    text,
    "application/xml"
  );

  if (xml.querySelector("parsererror")) {
    throw new Error(
      "The server did not return valid RSS, Atom, or JSON."
    );
  }

  const entries = [
    ...xml.querySelectorAll("item"),
    ...xml.querySelectorAll("entry")
  ];

  return entries.map((entry) => {
    const getText = (...selectors) => {
      for (const selector of selectors) {
        const node = entry.querySelector(selector);

        if (node) {
          return node.textContent?.trim() || "";
        }
      }

      return "";
    };

    const linkNode = entry.querySelector("link");
    const link =
      linkNode?.getAttribute("href") ||
      linkNode?.textContent?.trim() ||
      getText("guid");

    return {
      title: getText("title") || "Untitled review",
      link: safeURL(link),
      description: cleanText(
        getText(
          "description",
          "summary",
          "content",
          "encoded"
        )
      ),
      date: getText(
        "pubDate",
        "published",
        "updated",
        "date"
      ),
      author: getText(
        "author name",
        "author",
        "creator"
      ),
      source
    };
  }).filter((item) => item.title !== "Untitled review");
}

function renderReviewList(containerId, reviews, emptyMessage) {
  const container = $(containerId);
  if (!container) return;

  container.replaceChildren();

  if (!reviews.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = emptyMessage;
    container.appendChild(message);
    return;
  }

  reviews.forEach((review) => {
    const article = document.createElement("article");
    article.className = "movie-card review-card";

    const heading = document.createElement("h3");

    if (review.link) {
      const link = document.createElement("a");
      link.href = review.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = review.title;
      heading.appendChild(link);
    } else {
      heading.textContent = review.title;
    }

    article.appendChild(heading);

    const metadata = document.createElement("p");
    metadata.className = "muted";

    const details = [review.source];

    if (review.author) details.push(review.author);

    if (review.date) {
      details.push(formatDate(review.date));
    }

    metadata.textContent = details.join(" · ");
    article.appendChild(metadata);

    if (review.description) {
      const description = document.createElement("p");

      description.textContent =
        review.description.length > 450
          ? review.description.slice(0, 450) + "…"
          : review.description;

      article.appendChild(description);
    }

    container.appendChild(article);
  });
}


function renderMainReviews() {
  const search = $("search")?.value.trim().toLowerCase() || "";
  const source = $("source")?.value || "all";
  const sort = $("sort")?.value || "newest";

  let reviews = allReviews.filter((review) => {
    const matchesSearch =
      !search ||
      review.title.toLowerCase().includes(search) ||
      review.description.toLowerCase().includes(search) ||
      review.author.toLowerCase().includes(search);

    const matchesSource =
      source === "all" || review.source === source;

    return matchesSearch && matchesSource;
  });

  reviews.sort((a, b) => {
    const dateA = Date.parse(a.date) || 0;
    const dateB = Date.parse(b.date) || 0;

    if (sort === "oldest") return dateA - dateB;
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    return dateB - dateA;
  });

  renderReviewList(
    "movies",
    reviews,
    "No reviews match your filters."
  );

  setStatus("status", `${reviews.length} reviews shown.`);
}


async function loadEbertFeed(signal) {
  setStatus("ebert-feed", "Loading RogerEbert reviews…");

  let lastError;

  for (const url of EBERT_FEED_URLS) {
    try {
      const text = await fetchFeedText(url, signal);

      const reviews = parseReviewFeed(
        text,
        "RogerEbert.com"
      );

      if (!reviews.length) {
        throw new Error("No review entries were found.");
      }

      allReviews = [
        ...allReviews.filter(
          review => review.source !== "RogerEbert.com"
        ),
        ...reviews
      ];

      renderReviewList(
        "ebert-feed",
        reviews,
        "No RogerEbert reviews found."
      );

      setStatus(
        "ebert-feed",
        `Loaded ${reviews.length} RogerEbert reviews.`
      );

      renderMainReviews();

      return reviews;
    } catch (error) {
      if (signal?.aborted) return [];

      lastError = error;

      console.warn(
        `RogerEbert feed failed: ${url}`,
        error
      );
    }
  }

  setStatus(
    "ebert-feed",
    `RogerEbert feed unavailable: ${
      lastError?.message || "Unknown error."
    }`
  );

  return [];
}

async function loadMoviefoneFeed(signal) {
  setStatus(
    "moviefone-status",
    "Loading Moviefone reviews…"
  );

  try {
    let text;
    let lastError;

    for (const url of [MOVIE_JSON_URL, MOVIE_RSS_URL]) {
      try {
        text = await fetchFeedText(url, signal);

        const parsed = parseReviewFeed(text, "Moviefone");

        if (parsed.length) break;

        throw new Error("No review entries were found.");
      } catch (error) {
        if (signal?.aborted) return [];

        lastError = error;
        text = null;
      }
    }

    if (!text) {
      throw lastError || new Error("Both Moviefone feeds failed.");
    }

    const reviews = parseReviewFeed(text, "Moviefone");

    if (!reviews.length) {
      throw new Error("No review entries were found.");
    }

    allReviews = [
      ...allReviews.filter(
        (review) => review.source !== "Moviefone"
      ),
      ...reviews
    ];

    renderReviewList(
      "moviefone-movies",
      reviews,
      "No Moviefone reviews found."
    );

    setStatus(
      "moviefone-status",
      `Loaded ${reviews.length} Moviefone reviews.`
    );

    renderMainReviews();

    return reviews;
  } catch (error) {
    if (signal?.aborted) return [];

    console.error("Moviefone feed error:", error);

    setStatus(
      "moviefone-status",
      `Moviefone feed failed: ${error.message}`
    );

    return [];
  }
}


async function refreshReviews() {
  if (refreshController) {
    refreshController.abort();
  }

  refreshController = new AbortController();
  const signal = refreshController.signal;

  setStatus("status", "Refreshing review feeds…");
  setStatus("ebert-feed", "Loading RogerEbert reviews…");
  setStatus("moviefone-status", "Loading Moviefone reviews…");

  await Promise.allSettled([
    loadEbertFeed(signal),
    loadMoviefoneFeed(signal)
  ]);

  if (!signal.aborted) {
    renderMainReviews();
  }
}

function getRatingURLs(title) {
  const q = encodeURIComponent(title);

  return {
    "imdb-link": `https://www.imdb.com/find/?q=${q}`,
    "rotten-link": `https://www.rottentomatoes.com/search?search=${q}`,
    "metacritic-link": `https://www.google.com/search?q=${encodeURIComponent(
      "site:metacritic.com/movie " + title
    )}`,
    "rogerebert-link": `https://www.google.com/search?q=${encodeURIComponent(
      "site:rogerebert.com/reviews " + title
    )}`,
    "moviefone-link": `https://www.google.com/search?q=${encodeURIComponent(
      "site:moviefone.com " + title
    )}`
  };
}

function updateRatingLinks(title) {
  if (!title) return;

  const urls = getRatingURLs(title);

  Object.entries(urls).forEach(([id, url]) => {
    const link = $(id);

    if (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}

function setRatingText(id, value, suffix = "") {
  const element = $(id);
  if (!element) return;

  element.textContent =
    value !== null && value !== undefined && value !== ""
      ? `${value}${suffix}`
      : "N/A";
}


async function searchScores() {
  const input = $("rating-search");
  const query = input?.value.trim();
  const status = $("rating-status");

  if (!query) {
    if (status) status.textContent = "Please enter a movie title.";
    input?.focus();
    return;
  }

  try {
    if (status) status.textContent = "Loading movie scores…";

    const response = await fetch("./json.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`json.json returned HTTP ${response.status}`);
    }

    const data = await response.json();

    // Support an array of movies, not just a single object.
    const movies = Array.isArray(data)
      ? data
      : Array.isArray(data.movies)
        ? data.movies
        : [data];

    const normalize = value =>
      String(value ?? "").trim().toLowerCase();

    let movie = movies.find(
      item => normalize(item.title) === normalize(query)
    );

    // If no exact match, allow a unique partial title match.
    if (!movie) {
      const matches = movies.filter(
        item => normalize(item.title).includes(normalize(query))
      );

      if (matches.length === 1) {
        movie = matches[0];
      }
    }

    if (!movie) {
      if (status) {
        status.textContent =
          `No matching movie found for "${query}". Check the title in json.json.`;
      }

      const heading = $("rating-title");
      if (heading) heading.textContent = "Movie not found";

      ["imdb", "rotten", "metacritic", "rogerebert", "moviefone"]
        .forEach(id => setRatingText(id, null));

      return;
    }

    const heading = $("rating-title");

    if (heading) {
      heading.textContent = movie.year
        ? `${movie.title} (${movie.year})`
        : movie.title;
    }

    setRatingText(
      "imdb",
      movie.imdb,
      movie.imdb != null ? "/10" : ""
    );

    setRatingText(
      "rotten",
      movie.rt,
      movie.rt != null ? "%" : ""
    );

    setRatingText(
      "metacritic",
      movie.mc,
      movie.mc != null ? "/100" : ""
    );

    setRatingText("rogerebert", movie.rogerEbert);

    setRatingText(
      "moviefone",
      movie.moviefone,
      movie.moviefone != null ? "%" : ""
    );

    updateRatingLinks(movie.title);

    if (status) {
      status.textContent = "Scores loaded successfully.";
    }
  } catch (error) {
    console.error("CriticGuide rating error:", error);

    if (status) {
      status.textContent = `Could not load scores: ${error.message}`;
    }
  }
}


$("rating-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchScores();
});

$("rating-search")?.addEventListener("input", (event) => {
  const title = event.target.value.trim();
  if (title) updateRatingLinks(title);
});

$("search")?.addEventListener("input", renderMainReviews);
$("source")?.addEventListener("change", renderMainReviews);
$("sort")?.addEventListener("change", renderMainReviews);

$("refresh")?.addEventListener("click", refreshReviews);
$("refresh-moviefone")?.addEventListener("click", async () => {
  // Refresh the Moviefone feed without restarting RogerEbert.
  await loadMoviefoneFeed(new AbortController().signal);
});

document.addEventListener("DOMContentLoaded", () => {
  refreshReviews();
});
