// Sample content for an ML/DL course notebook
const NOTEBOOKS = [
  { id: "nb-dl", title: "Deep Learning — Fall '26", color: "#b9722e", pinned: true, pages: 28, updated: "just now" },
  { id: "nb-ml", title: "Intro to Machine Learning", color: "#5a7f4a", pinned: true, pages: 41, updated: "2d ago" },
  { id: "nb-math", title: "Math for ML (review)", color: "#6b5aa6", pinned: false, pages: 17, updated: "1w ago" },
  { id: "nb-lab", title: "Lab notebooks", color: "#3b6e86", pinned: false, pages: 9, updated: "3w ago" },
];

// Sections inside the active notebook — OneNote style
const SECTIONS = [
  {
    id: "s1",
    title: "00 · Orientation",
    color: "#8d7a4b",
    open: false,
    pages: [
      { id: "p01", title: "Syllabus & expectations", type: "ruled" },
      { id: "p02", title: "How to use this notebook", type: "plain" },
    ],
  },
  {
    id: "s2",
    title: "01 · Foundations",
    color: "#b9722e",
    open: true,
    pages: [
      { id: "p11", title: "What is learning?", type: "ruled" },
      { id: "p12", title: "Linear regression, by hand", type: "grid" },
      { id: "p13", title: "Loss landscapes", type: "plain" },
      { id: "p14", title: "Gradient descent — intuition", type: "ruled" },
      { id: "p15", title: "Assignment 1", type: "ruled" },
    ],
  },
  {
    id: "s3",
    title: "02 · Neural Networks",
    color: "#3b6e86",
    open: true,
    pages: [
      { id: "p21", title: "Neurons & activations", type: "grid" },
      { id: "p22", title: "Backprop, step by step", type: "plain" },
      { id: "p23", title: "Building an MLP in PyTorch", type: "ruled" },
      { id: "p24", title: "Overfitting & regularization", type: "ruled" },
    ],
  },
  {
    id: "s4",
    title: "03 · Convolutions",
    color: "#5a7f4a",
    open: false,
    pages: [
      { id: "p31", title: "From dense to conv", type: "grid" },
      { id: "p32", title: "Kernels as edge detectors", type: "plain" },
      { id: "p33", title: "CIFAR-10 walkthrough", type: "ruled" },
    ],
  },
  {
    id: "s5",
    title: "04 · Transformers",
    color: "#6b5aa6",
    open: false,
    pages: [
      { id: "p41", title: "Attention is matrix math", type: "grid" },
      { id: "p42", title: "Why positional encodings?", type: "ruled" },
    ],
  },
  {
    id: "s6",
    title: "Scratch",
    color: "#7a7360",
    open: false,
    pages: [{ id: "p91", title: "Office hours notes", type: "ruled" }],
  },
];

const ACTIVE_NOTEBOOK = NOTEBOOKS[0];
const ACTIVE_PAGE_ID = "p14";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const SECTIONS_ML = [
  {
    id: "ml-s1",
    title: "Week 1 — Orientation",
    color: "#5a7f4a",
    open: true,
    pages: [
      { id: "ml-p1", title: "Course roadmap", type: "ruled" },
      { id: "ml-p2", title: "Supervised vs unsupervised", type: "grid" },
    ],
  },
  {
    id: "ml-s2",
    title: "Week 2 — Linear models",
    color: "#3b6e86",
    open: false,
    pages: [
      { id: "ml-p3", title: "Least squares intuition", type: "ruled" },
      { id: "ml-p4", title: "Logistic regression", type: "plain" },
    ],
  },
];

const SECTIONS_MATH = [
  {
    id: "ma-s1",
    title: "Linear algebra refresh",
    color: "#6b5aa6",
    open: true,
    pages: [
      { id: "ma-p1", title: "Vectors & norms", type: "grid" },
      { id: "ma-p2", title: "Eigenvalues — why they matter", type: "ruled" },
    ],
  },
];

const SECTIONS_LAB = [
  {
    id: "lb-s1",
    title: "Lab 00 — Setup",
    color: "#3b6e86",
    open: true,
    pages: [
      { id: "lb-p1", title: "Python + PyTorch environment", type: "ruled" },
      { id: "lb-p2", title: "GPU sanity check", type: "plain" },
    ],
  },
];

const DEFAULT_SECTIONS_BY_NOTEBOOK = {
  "nb-dl": deepClone(SECTIONS),
  "nb-ml": deepClone(SECTIONS_ML),
  "nb-math": deepClone(SECTIONS_MATH),
  "nb-lab": deepClone(SECTIONS_LAB),
};

function getDefaultSectionsForNotebook(notebookId) {
  return deepClone(DEFAULT_SECTIONS_BY_NOTEBOOK[notebookId] || DEFAULT_SECTIONS_BY_NOTEBOOK["nb-dl"]);
}

function getNotebookById(notebookId) {
  return NOTEBOOKS.find((n) => n.id === notebookId) || NOTEBOOKS[0];
}

window.NOTEBOOKS = NOTEBOOKS;
window.SECTIONS = SECTIONS;
window.ACTIVE_NOTEBOOK = ACTIVE_NOTEBOOK;
window.ACTIVE_PAGE_ID = ACTIVE_PAGE_ID;
window.deepClone = deepClone;
window.DEFAULT_SECTIONS_BY_NOTEBOOK = DEFAULT_SECTIONS_BY_NOTEBOOK;
window.getDefaultSectionsForNotebook = getDefaultSectionsForNotebook;
window.getNotebookById = getNotebookById;
