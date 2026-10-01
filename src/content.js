// Edit this file to replace sample studies with your own portfolio.
export const profile = {
  name: "McLary",
  title: "Independent creative",
  disciplines: "DESIGN, MOTION & DIGITAL EXPERIENCES",
  hero: ["A world of", "possibility."],
  introduction: "Exploring the space between imagination and experience.",
  about:
    "A personal collection of ideas, experiments and new perspectives. I’m drawn to expressive identities, thoughtful digital experiences and the unexpected beauty in everyday things.",
  email: "xiangjinleee@gmail.com",
  socials: [], // Example: { label: 'Instagram', url: 'https://instagram.com/yourname' }
};

// Fictional website concepts with generated cover art. Replace with real work as ready.
export const projects = [
  {
    id: "quiet-spaces",
    title: "Quiet spaces",
    category: "Digital",
    year: "01",
    color: "#e8e2d7",
    art: "portal",
    subtitle: "Architecture studio website",
    description:
      "A website concept for an architecture practice. Warm stone, generous typography and an editorial grid bring light and stillness into the digital experience.",
  },
  {
    id: "liquid-thoughts",
    title: "Signal",
    category: "Motion",
    year: "02",
    color: "#171b15",
    art: "ribbon",
    subtitle: "Independent music platform",
    description:
      "A music platform concept combining acid-green typography, chrome textures and an integrated radio player. A visual identity built around independent sound.",
  },
  {
    id: "soft-structure",
    title: "Soft Form",
    category: "Design",
    year: "03",
    color: "#a14d35",
    art: "sphere",
    subtitle: "Furniture & lifestyle store",
    description:
      "An ecommerce concept for contemporary furniture. Tactile product imagery, terracotta tones and relaxed typography make room for everyday objects.",
  },
  {
    id: "another-orbit",
    title: "Orbital",
    category: "Motion",
    year: "04",
    color: "#08203c",
    art: "orbit",
    subtitle: "Space technology website",
    description:
      "A space technology website concept pairing a cinematic Earth horizon with precise mission details. An exploration of scale, discovery and scientific storytelling.",
  },
  {
    id: "in-bloom",
    title: "In bloom",
    category: "Design",
    year: "05",
    color: "#ece0ad",
    art: "bloom",
    subtitle: "Botanical fragrance boutique",
    description:
      "A botanical fragrance boutique concept. Sunlit glass, forest-green lettering and soft yellow tones turn a product collection into a sensory editorial experience.",
  },
  {
    id: "between-worlds",
    title: "Elsewhere",
    category: "Digital",
    year: "06",
    color: "#f1eee5",
    art: "stairs",
    subtitle: "Travel & culture magazine",
    description:
      "An independent travel magazine concept with a bold masthead, expansive photography and an expressive editorial layout. Stories for taking the slower route.",
  },
].map((project) => ({ image: `/covers/${project.id}.webp`, ...project }));
