import { CERTIFICATE_HEIGHT, CERTIFICATE_WIDTH } from "../data/certificateConfig";

const waitForAssets = async (element) => {
  await document.fonts?.ready;
  const images = [...element.querySelectorAll("img")];
  await Promise.all(images.map((image) => image.complete && image.naturalWidth
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    })));
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const inlineImages = async (source, clone) => {
  const sourceImages = [...source.querySelectorAll("img")];
  const cloneImages = [...clone.querySelectorAll("img")];
  await Promise.all(sourceImages.map(async (image, index) => {
    const response = await fetch(image.currentSrc || image.src, { mode: "cors" });
    if (!response.ok) throw new Error("A certificate image could not be loaded.");
    cloneImages[index].setAttribute("src", await blobToDataUrl(await response.blob()));
    cloneImages[index].removeAttribute("crossorigin");
  }));
};

const copyComputedStyles = (source, clone) => {
  const sources = [source, ...source.querySelectorAll("*")];
  const clones = [clone, ...clone.querySelectorAll("*")];
  sources.forEach((node, index) => {
    const computed = getComputedStyle(node);
    const css = [...computed].map((property) => `${property}:${computed.getPropertyValue(property)};`).join("");
    clones[index].setAttribute("style", css);
  });
};

const renderCertificate = async (element) => {
  await waitForAssets(element);
  const clone = element.cloneNode(true);
  copyComputedStyles(element, clone);
  await inlineImages(element, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.boxShadow = "none";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CERTIFICATE_WIDTH}" height="${CERTIFICATE_HEIGHT}" viewBox="0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const rendered = new Image();
    rendered.decoding = "async";
    rendered.src = svgUrl;
    await rendered.decode();
    const canvas = document.createElement("canvas");
    canvas.width = CERTIFICATE_WIDTH * 2;
    canvas.height = CERTIFICATE_HEIGHT * 2;
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    context.drawImage(rendered, 0, 0, CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
};

const dataUrlBytes = (dataUrl) => {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

// A compact, standards-compliant PDF writer: one JPEG XObject, one landscape page.
const createSinglePagePdf = (jpegBytes, imageWidth, imageHeight) => {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const add = (value) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    parts.push(bytes); length += bytes.length;
  };
  const object = (number, content) => {
    offsets[number] = length;
    add(`${number} 0 obj\n`); add(content); add("\nendobj\n");
  };

  add("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CERTIFICATE_WIDTH} ${CERTIFICATE_HEIGHT}] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  add(jpegBytes); add("\nendstream\nendobj\n");
  const commands = `q ${CERTIFICATE_WIDTH} 0 0 ${CERTIFICATE_HEIGHT} 0 0 cm /Certificate Do Q`;
  object(5, `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
  const xref = length;
  add("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) add(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
};

export const downloadCertificatePdf = async (element, certificateId) => {
  if (!element) throw new Error("Certificate canvas is unavailable.");
  const canvas = await renderCertificate(element);
  const jpeg = dataUrlBytes(canvas.toDataURL("image/jpeg", 0.96));
  const pdf = createSinglePagePdf(jpeg, canvas.width, canvas.height);
  const url = URL.createObjectURL(pdf);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `OVTech-Certificate-${certificateId}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
