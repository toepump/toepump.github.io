"use strict";

// Home page behaviour: filter the inline post list by tag, and hand the area
// over to the site-wide search results (rendered by site.js) while searching.
(function () {
  function init() {
    var searchInput = document.getElementById("search");
    var postList = document.getElementById("post-list");
    var tagFilter = document.getElementById("tag-filter");
    var postCount = document.getElementById("post-count");
    var postCountNumber = document.getElementById("post-count-number");
    var postCountLabel = document.getElementById("post-count-label");

    if (!searchInput || !postList) {
      return;
    }

    var cards = Array.prototype.slice.call(
      postList.querySelectorAll("article.post-card"),
    );
    var filterButtons = Array.prototype.slice.call(
      document.querySelectorAll(".tag-filter__button"),
    );
    var tagChips = Array.prototype.slice.call(
      document.querySelectorAll(".tag-chip"),
    );
    var activeTags = [];

    // Templates can't easily build a unique tag set in Tera, so the buttons
    // are rendered once per post tag and de-duplicated here.
    (function dedupeTagButtons() {
      var container = document.querySelector(".tag-filter .buttons");
      if (!container) {
        return;
      }
      var seen = {};
      filterButtons = filterButtons.filter(function (btn) {
        var tag = btn.getAttribute("data-tag") || "";
        if (tag === "") {
          return true;
        }
        if (seen[tag]) {
          btn.remove();
          return false;
        }
        seen[tag] = true;
        return true;
      });

      var all = filterButtons.filter(function (btn) {
        return (btn.getAttribute("data-tag") || "") === "";
      })[0];
      var rest = filterButtons
        .filter(function (btn) {
          return (btn.getAttribute("data-tag") || "") !== "";
        })
        .sort(function (a, b) {
          return a
            .getAttribute("data-tag")
            .localeCompare(b.getAttribute("data-tag"));
        });

      if (all) {
        container.appendChild(all);
      }
      rest.forEach(function (btn) {
        container.appendChild(btn);
      });
    })();

    function tagsOf(card) {
      var raw = card.getAttribute("data-tags") || "";
      return raw === "" ? [] : raw.split("|");
    }

    function isActive(tag) {
      return tag !== "" && activeTags.indexOf(tag) !== -1;
    }

    function syncTagState() {
      filterButtons.forEach(function (btn) {
        var tag = btn.getAttribute("data-tag") || "";
        // "All" is active only when nothing else is selected.
        var on = tag === "" ? activeTags.length === 0 : isActive(tag);
        btn.classList.toggle("is-active", on);
      });
      tagChips.forEach(function (chip) {
        chip.classList.toggle(
          "is-active",
          isActive(chip.getAttribute("data-tag") || ""),
        );
      });
    }

    function render() {
      var searching = searchInput.value.trim() !== "";
      if (tagFilter) {
        tagFilter.style.display = searching ? "none" : "";
      }
      postList.style.display = searching ? "none" : "";
      if (postCount) {
        postCount.style.display = searching ? "none" : "";
      }

      if (searching) {
        return;
      }

      var visible = 0;
      cards.forEach(function (card) {
        var tags = tagsOf(card);
        var show =
          activeTags.length === 0 ||
          activeTags.some(function (tag) {
            return tags.indexOf(tag) !== -1;
          });
        card.style.display = show ? "" : "none";
        if (show) {
          visible++;
        }
      });

      if (postCountNumber) {
        postCountNumber.textContent = visible;
      }
      if (postCountLabel) {
        postCountLabel.textContent = visible === 1 ? "Post" : "Posts";
      }
    }

    function clearSearch() {
      if (searchInput.value === "") {
        return;
      }
      searchInput.value = "";
      var results = document.querySelector(".search-results");
      var items = document.querySelector(".search-results__items");
      if (results) {
        results.style.display = "none";
      }
      if (items) {
        items.innerHTML = "";
      }
    }

    // Multi-select: "" clears the filter, any other tag toggles on/off.
    function toggleTag(tag) {
      if (tag === "") {
        activeTags = [];
      } else if (isActive(tag)) {
        activeTags = activeTags.filter(function (t) {
          return t !== tag;
        });
      } else {
        activeTags.push(tag);
      }
      syncTagState();
      clearSearch();
      render();
    }

    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function (evt) {
        evt.preventDefault();
        toggleTag(btn.getAttribute("data-tag") || "");
      });
    });

    tagChips.forEach(function (chip) {
      chip.addEventListener("click", function (evt) {
        evt.preventDefault();
        toggleTag(chip.getAttribute("data-tag") || "");
      });
    });

    searchInput.addEventListener("input", render);
    searchInput.addEventListener("keyup", render);

    // site.js provides the site-wide search engine; wire it to this input.
    if (typeof search === "function") {
      search();
    }

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
