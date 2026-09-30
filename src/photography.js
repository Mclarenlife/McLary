export const places = [
  { id: "all", name: "全部", english: "All places", lat: 35, lon: 105 },
  {
    id: "guangdong",
    name: "广东",
    english: "Guangdong",
    lat: 23.0,
    lon: 113.4,
  },
  { id: "macau", name: "澳门", english: "Macau", lat: 22.164, lon: 113.554 },
  { id: "shanxi", name: "山西", english: "Shanxi", lat: 37.5, lon: 112.5 },
];

const oss = "https://mclary-gallery.oss-cn-shenzhen.aliyuncs.com";

// Same-origin previews keep WebGL fast and independent of the bucket's CORS policy.
// The photograph viewer opens the original OSS image only on demand.
export const photographs = [
  ...["DSC02546", "DSCF1439", "DSCF1500"].map((file, index) => ({
    id: `guangdong-0${index + 1}`,
    place: "guangdong",
    title: `广州 · ${file}`,
    image: `${oss}/Guangzhou/${file}.jpg`,
    preview: `/photography/${file}.webp`,
    credit: "McLary",
    empty: false,
  })),
  {
    id: "macau-01",
    place: "macau",
    title: "澳门",
    image: "",
    credit: "",
    empty: true,
  },
  {
    id: "shanxi-01",
    place: "shanxi",
    title: "山西",
    image: "",
    credit: "",
    empty: true,
  },
];
