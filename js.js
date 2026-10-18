const EBERT_FEEDS = [
  "https://www.rogerebert.com/reviews/feed",
  "https://www.rogerebert.com/feed"
];

const MOVIEFONE_FEEDS = [
  "https://www.moviefone.com/feeds/reviews.json",
  "https://www.moviefone.com/feeds/reviews.rss"
];

const PROXIES = [
  url =>
    "https://api.allorigins.win/raw?url=" +
    encodeURIComponent(url),

  url =>
    "https://corsproxy.io/?" +
    new URLSearchParams({ url }).toString()
];

const $ = id => document.getElementById(id);

let reviews = [];

function status(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function text(value) {
  if (value == null) return "";

  if (typeof value === "object") {
    return text(
      value.name ?? value._ ?? value.text ?? value.value ?? ""
    );
  }

  const doc = new DOMParser().parseFromString(
    String(value),
    "text/html"
  );

  return doc.body.textContent.trim();
}

function formatDate(value) {
  if (!value) return "";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
}

function safeLink(value) {
  try {
    const url = new URL(String(value), window.location.href);

    return ["https:", "http:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function normalize(item, source) {
  const link =
    item.link?.href ??
    item.link?.["@_href"] ??
    item.link ??
    item.url ??
    item.guid ??
    "";

  return {
    title: text(item.title ?? item.name) || "Untitled review",
    link: safeLink(link),

    description: text(
      item.description ??
      item.summary ??
      item.content_text ??
      item.content ??
      item["content:encoded"] ??
      ""
    ),

    date: text(
      item.pubDate ??
      item.published ??
      item.updated ??
      item.date ??
      item["dc:date"] ??
      ""
    ),

    author: text(
      item.author?.name ??
      item.author ??
      item.creator ??
      item["dc:creator"] ??
      ""
    ),

    source
  };
}

function parseFeed(data, source) {
  // Try JSON first.
  try {
    const json = JSON.parse(data);

    const items = Array.isArray(json)
      ? json
      : json.items ??
        json.results ??
        json.articles ??
        json.feed?.items ??
        json.data ??
        [];

    if (Array.isArray(items) && items.length) {
      return items
        .map(item => normalize(item, source))
        .filter(item => item.title !== "Untitled review");
    }
  } catch {
    // Continue to XML parsing.
  }

  // Try RSS or Atom XML.
  const xml = new DOMParser().parseFromString(
    data,
    "application/xml"
  );

  if (xml.querySelector("parsererror")) {
    throw new Error("Invalid RSS, Atom, or JSON feed.");
  }

  return [...xml.querySelectorAll("item, entry")]
    .map(item => {
      const get = (...names) => {
        for (const name of names) {
          const node = item.getElementsByTagName(name)[0];

          if (node) return node.textContent.trim();
        }

        return "";
      };

      const linkNode = item.querySelector("link");

      const link =
        linkNode?.getAttribute("href") ||
        linkNode?.textContent?.trim() ||
        get("guid");

      return normalize({
        title: get("title"),
        link,
        description: get(
          "description",
          "summary",
          "content",
          "encoded"
        ),
        pubDate: get(
          "pubDate",
          "published",
          "updated",
          "date"
        ),
        author: get("author", "creator")
      }, source);
    })
    .filter(item => item.title !== "Untitled review");
}

async function fetchFeed(url) {
  let lastError;

  for (const makeProxyURL of PROXIES) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(
        () => controller.abort(),
        12000
      );

      try {
        const response = await fetch(makeProxyURL(url), {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.text();

        if (!data.trim()) {
          throw new Error("Empty feed response.");
        }

        return data;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      lastError = error;
      console.warn("Feed request failed:", error.message);
    }
  }

  throw lastError || new Error("All feed requests failed.");
}

function render(containerId, items, emptyMessage) {
  const container = $(containerId);

  if (!container) return;

  container.replaceChildren();

  if (!items.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = emptyMessage;
    container.appendChild(message);
    return;
  }

  items.forEach(review => {
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

    const metadata = document.createElement("p");
    metadata.className = "muted";

    metadata.textContent = [
      review.source,
      review.author,
      formatDate(review.date)
    ].filter(Boolean).join(" · ");

    article.append(heading, metadata);

    if (review.description) {
      const description = document.createElement("p");

      description.textContent =
        review.description.length > 400
          ? review.description.slice(0, 400) + "…"
          : review.description;

      article.appendChild(description);
    }

    container.appendChild(article);
  });
}



function extractText(value) {
  if (!value) return "";

  const html = String(value);
  const doc = new DOMParser().parseFromString(html, "text/html");

  return (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getExcerpt(item) {
  const description =
    item.description ||
    item.summary ||
    item.content ||
    item["content:encoded"] ||
    item.encoded ||
    "";

  const excerpt = extractText(description);

  if (!excerpt) {
    return "Read the full review on RogerEbert.com.";
  }

  return excerpt.length > 280
    ? excerpt.slice(0, 277).trimEnd() + "..."
    : excerpt;
}

function normalizeEbertItem(item) {
  const title = extractText(item.title) || "Movie review";

  let link = typeof item.link === "string"
    ? item.link
    : item.link?.href || item.link?.["@_href"] || "";

  if (!link && item.guid && /^https?:\/\//i.test(item.guid)) {
    link = item.guid;
  }

  if (link) {
    try {
      link = new URL(link, "https://www.rogerebert.com").href;
      if (new URL(link).hostname !== "www.rogerebert.com" &&
          new URL(link).hostname !== "rogerebert.com") {
        link = "";
      }
    } catch {
      link = "";
    }
  }

  return {
    title,
    excerpt: getExcerpt(item),
    link,
    date: item.pubDate || item.published || item.updated || ""
  };
}

const excerpt = document.createElement("p");
excerpt.textContent = review.excerpt;
card.appendChild(excerpt);

if (review.link) {
  const link = document.createElement("a");
  link.href = review.link;
  link.textContent = "Read full review →";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  card.appendChild(link);
}

function filterReviews() {
  const query = ($("search")?.value || "")
    .trim()
    .toLowerCase();

  const source = $("source")?.value || "all";
  const sort = $("sort")?.value || "newest";

  const filtered = reviews.filter(review => {
    const matchesSource =
      source === "all" || review.source === source;

    const matchesSearch = [
      review.title,
      review.description,
      review.author
    ].some(value =>
      value.toLowerCase().includes(query)
    );

    return matchesSource && matchesSearch;
  });

  filtered.sort((a, b) => {
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }

    const dateA = Date.parse(a.date) || 0;
    const dateB = Date.parse(b.date) || 0;

    return sort === "oldest"
      ? dateA - dateB
      : dateB - dateA;
  });

  render(
    "movies",
    filtered,
    "No reviews match your search."
  );

  status("status", `${filtered.length} reviews shown.`);
}

async function loadSource(
  urls,
  source,
  containerId,
  statusId
) {
  status(statusId, `Loading ${source} reviews…`);

  let lastError;

  for (const url of urls) {
    try {
      const data = await fetchFeed(url);
      const items = parseFeed(data, source);

      if (!items.length) {
        throw new Error("No review entries found.");
      }

      // Replace only this source's saved reviews.
      reviews = [
        ...reviews.filter(review => review.source !== source),
        ...items
      ];

      // Render this source's dedicated review section.
      render(
        containerId,
        items,
        `No ${source} reviews found.`
      );

      status(
        statusId,
        `${items.length} ${source} reviews loaded.`
      );

      // Also update the main review list.
      filterReviews();

      return items;
    } catch (error) {
      lastError = error;
      console.warn(`${source} feed failed:`, error.message);
    }
  }

  status(
    statusId,
    `${source} feed unavailable. ${
      lastError?.message || ""
    }`
  );

  render(
    containerId,
    [],
    `${source} reviews could not be loaded.`
  );

  return [];
}

function refreshReviews() {
  status("status", "Refreshing review feeds…");

  return Promise.allSettled([
    loadSource(
      EBERT_FEEDS,
      "RogerEbert.com",
      "ebert-feed",
      "ebert-status"
    ),

    loadSource(
      MOVIEFONE_FEEDS,
      "Moviefone",
      "moviefone-movies",
      "moviefone-status"
    )
  ]);
}

function ratingLinks(title) {
  const query = encodeURIComponent(title);

  const links = {
    "imdb-link":
      `https://www.imdb.com/find/?q=${query}`,

    "rotten-link":
      `https://www.rottentomatoes.com/search?search=${query}`,

    "metacritic-link":
      `https://www.google.com/search?q=${
        encodeURIComponent("site:metacritic.com/movie " + title)
      }`,

    "rogerebert-link":
      `https://www.google.com/search?q=${
        encodeURIComponent("site:rogerebert.com/reviews " + title)
      }`,

    "moviefone-link":
      `https://www.google.com/search?q=${
        encodeURIComponent("site:moviefone.com " + title)
      }`
  };

  Object.entries(links).forEach(([id, url]) => {
    const link = $(id);

    if (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}

async function searchRatings() {
  const title = $("rating-search")?.value.trim();

  if (!title) {
    status("rating-status", "Enter a movie title.");
    return;
  }

  status("rating-status", "Searching saved ratings…");

  try {
    const response = await fetch("./json.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load json.json.");
    }

    const data = await response.json();

    // Supports either one movie or an array of movies.
    const movies = Array.isArray(data) ? data : [data];

    const movie = movies.find(item =>
      item.title?.trim().toLowerCase() === title.toLowerCase()
    );

    if (!movie) {
      status(
        "rating-status",
        "Movie not found in json.json."
      );
      return;
    }

    $("rating-title").textContent =
      movie.title + (movie.year ? ` (${movie.year})` : "");

    $("imdb").textContent =
      movie.imdb != null ? `${movie.imdb}/10` : "N/A";

    $("rotten").textContent =
      movie.rt != null ? `${movie.rt}%` : "N/A";

    $("metacritic").textContent =
      movie.mc != null ? `${movie.mc}/100` : "N/A";

    $("rogerebert").textContent =
      movie.rogerEbert ?? "N/A";

    $("moviefone").textContent =
      movie.moviefone != null
        ? movie.moviefone
        : "N/A";

    ratingLinks(movie.title);

    status("rating-status", "Saved ratings loaded.");
  } catch (error) {
    console.error("Rating search failed:", error);

    status(
      "rating-status",
      "Could not load ratings. Check json.json."
    );
  }
}

$("rating-form")?.addEventListener("submit", event => {
  event.preventDefault();
  searchRatings();
});

$("rating-search")?.addEventListener("input", event => {
  const title = event.target.value.trim();

  if (title) ratingLinks(title);
});

$("search")?.addEventListener("input", filterReviews);
$("source")?.addEventListener("change", filterReviews);
$("sort")?.addEventListener("change", filterReviews);

$("refresh")?.addEventListener("click", refreshReviews);

$("refresh-moviefone")?.addEventListener("click", () => {
  loadSource(
    MOVIEFONE_FEEDS,
    "Moviefone",
    "moviefone-movies",
    "moviefone-status"
  );
});

refreshReviews();
