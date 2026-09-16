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

// Original, procedurally rendered concept studies. Replace with real work as ready.
export const projects = [
  {
    id: "quiet-spaces",
    title: "Quiet spaces",
    category: "Digital",
    year: "01",
    color: "#c7dfe2",
    art: "portal",
    subtitle: "Space, light & interaction",
    description:
      "An architectural exploration of light and stillness. A soft blue portal frames a space that changes with your point of view.",
  },
  {
    id: "liquid-thoughts",
    title: "Liquid thoughts",
    category: "Motion",
    year: "02",
    color: "#dccbdc",
    art: "ribbon",
    subtitle: "Material & motion study",
    description:
      "A study in fluid form: a continuous ribbon of reflected light, shifting between sculpture and movement.",
  },
  {
    id: "soft-structure",
    title: "Soft structure",
    category: "Design",
    year: "03",
    color: "#e4c3ac",
    art: "sphere",
    subtitle: "Colour, form & balance",
    description:
      "Simple forms in a carefully balanced composition. Soft colour and tactile surfaces turn a familiar shape into something new.",
  },
  {
    id: "another-orbit",
    title: "Another orbit",
    category: "Motion",
    year: "04",
    color: "#b7c2d8",
    art: "orbit",
    subtitle: "An experiment in rhythm",
    description:
      "An exploration of repetition and orbit. Floating rings trace a quiet rhythm around a central form.",
  },
  {
    id: "in-bloom",
    title: "In bloom",
    category: "Design",
    year: "05",
    color: "#c8d0ba",
    art: "bloom",
    subtitle: "Organic form exploration",
    description:
      "A sculptural study of growth and symmetry. Rounded petals unfold into an abstract botanical form.",
  },
  {
    id: "between-worlds",
    title: "Between worlds",
    category: "Digital",
    year: "06",
    color: "#d6b9ad",
    art: "stairs",
    subtitle: "An impossible landscape",
    description:
      "Stairs, openings and a suspended sphere form a small landscape with no fixed destination. An invitation to keep exploring.",
  },
].map((project) => ({ image: `/studies/${project.id}.webp`, ...project }));
