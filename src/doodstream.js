const BASE = "https://doodapi.co/api";

export const fetchDoodFiles = async ({ folderId, page = 1 } = {}) => {
  const params = new URLSearchParams({
    key: process.env.DOOD_API_KEY,
    page: String(page),
    per_page: "50",
  });

  if (folderId) params.set("fld_id", folderId);

  const url = `${BASE}/file/list?${params}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 200 || !json.result?.files) {
    throw new Error(`Doodstream API error: ${json.msg || "Unknown error"}`);
  }

  return json.result.files.map((f) => ({
    filecode: f.file_code,
    title: f.title,
    length: f.length,
    size: f.size,
    uploaded: f.uploaded,
    views: f.views,
    canplay: f.canplay,
    thumbnail: f.single_img,
    downloadUrl: f.download_url,
  }));
};

export const fetchDoodFileInfo = async (filecode) => {
  const url = `${BASE}/file/info?key=${process.env.DOOD_API_KEY}&file_code=${filecode}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== 200) {
    throw new Error(`File not found or error: ${json.msg}`);
  }

  return json.result[0];
};

export const buildDoodUrl = (filecode) => {
  return `https://doodstream.com/d/${filecode}`;
};