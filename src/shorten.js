export const shortenLink = async (originalLink) => {
  const url = `https://shrinkme.io/api?api=${process.env.SHRINKME_API_KEY}&url=${encodeURIComponent(originalLink)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ShrinkMe error: ${res.status}`);

  const json = await res.json();

  if (json.status !== "success" || !json.shortenedUrl) {
    throw new Error(`ShrinkMe failed: ${JSON.stringify(json)}`);
  }

  return json.shortenedUrl;
};