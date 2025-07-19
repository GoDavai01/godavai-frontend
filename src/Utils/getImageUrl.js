// src/utils/getImageUrl.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export function getImageUrl(img) {
  if (!img)
    return "https://img.freepik.com/free-vector/medicine-bottle-pills-isolated_1284-42391.jpg?w=400";
  if (img.startsWith("/uploads/"))
    return `${API_BASE_URL}${img}`;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return img;
}
