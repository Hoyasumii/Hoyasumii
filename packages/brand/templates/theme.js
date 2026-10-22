// ?theme=dark switches the tokens; the renderer passes it for each image.
document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") ?? "light";
