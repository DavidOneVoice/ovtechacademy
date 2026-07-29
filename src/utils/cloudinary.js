const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1";

export const uploadImageToCloudinary = async (file) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary upload is not configured.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  body.append("folder", "certificate-profiles");

  const response = await fetch(
    `${CLOUDINARY_UPLOAD_URL}/${cloudName}/image/upload`,
    { method: "POST", body },
  );
  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || "Unable to upload this photo.");
  }

  return result.secure_url;
};
