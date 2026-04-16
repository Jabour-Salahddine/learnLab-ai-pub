import { User, Topic, Submission, ChatMessage, RAGDocument, WeeklyReport } from "@/types";

export const students: User[] = [
  { id: "s1", name: "Salahddine Jabour", email: "s.jabour@fst.ma", role: "student", formation: "Data Science & Génie Informatique", year: 4, level: 3, avgScore: 78, skills: ["Python", "R", "Machine Learning", "SQL"], weakPoints: ["Récursivité", "Complexité O(n)", "Arbres binaires"], streak: 5, completedTPs: 12 },
  { id: "s2", name: "Fatima Zahra El Amrani", email: "f.elamrani@fst.ma", role: "student", formation: "Génie Informatique", year: 3, level: 4, avgScore: 85, skills: ["Python", "Java", "Algorithmes"], weakPoints: ["Graphes"], streak: 12, completedTPs: 18 },
  { id: "s3", name: "Omar Benali", email: "o.benali@fst.ma", role: "student", formation: "Data Science & Génie Informatique", year: 4, level: 2, avgScore: 62, skills: ["Python", "SQL"], weakPoints: ["Récursivité", "OOP", "Complexité"], streak: 0, completedTPs: 7 },
  { id: "s4", name: "Yasmine Tazi", email: "y.tazi@fst.ma", role: "student", formation: "Réseaux & Télécoms", year: 2, level: 2, avgScore: 71, skills: ["Python", "R"], weakPoints: ["Algorithmes de tri"], streak: 3, completedTPs: 9 },
  { id: "s5", name: "Ahmed Rachidi", email: "a.rachidi@fst.ma", role: "student", formation: "Génie Électrique", year: 3, level: 3, avgScore: 74, skills: ["Python", "MATLAB", "C"], weakPoints: ["Structures de données"], streak: 7, completedTPs: 14 },
  { id: "s6", name: "Nadia Chraibi", email: "n.chraibi@fst.ma", role: "student", formation: "Data Science & Génie Informatique", year: 5, level: 5, avgScore: 92, skills: ["Python", "R", "TensorFlow", "SQL", "Machine Learning"], weakPoints: [], streak: 20, completedTPs: 25 },
  { id: "s7", name: "Khalid Mouline", email: "k.mouline@fst.ma", role: "student", formation: "Génie Informatique", year: 2, level: 1, avgScore: 55, skills: ["Python"], weakPoints: ["OOP", "Algorithmes", "SQL"], streak: 1, completedTPs: 4 },
  { id: "s8", name: "Imane Fassi", email: "i.fassi@fst.ma", role: "student", formation: "Réseaux & Télécoms", year: 4, level: 3, avgScore: 76, skills: ["Python", "Java", "SQL", "Réseaux"], weakPoints: ["Machine Learning"], streak: 4, completedTPs: 11 },
];

export const teachers: User[] = [
  { id: "t1", name: "Prof. Mohammed Alaoui", email: "m.alaoui@fst.ma", role: "teacher" },
];

export const topics: Topic[] = [
  { id: "tp1", title: "Tri et recherche", description: "Algorithmes de tri classiques (QuickSort, MergeSort, HeapSort)", domain: "Algorithmique", difficulty: "Intermédiaire", tags: ["Python", "Algorithmes"], duration: "45 min", icon: "🔄", aiRecommended: true, matchPercentage: 95, generatedCount: 34, avgScore: 72, active: true },
  { id: "tp2", title: "Arbres binaires de recherche", description: "Implémentation et parcours d'arbres BST", domain: "Structures de données", difficulty: "Avancé", tags: ["Python", "Structures de données"], duration: "60 min", icon: "🌳", aiRecommended: true, matchPercentage: 88, generatedCount: 28, avgScore: 65, active: true },
  { id: "tp3", title: "Régression linéaire", description: "Implémentation from scratch d'une régression linéaire", domain: "Machine Learning", difficulty: "Intermédiaire", tags: ["Python", "R", "Machine Learning"], duration: "50 min", icon: "📈", aiRecommended: false, matchPercentage: 72, generatedCount: 41, avgScore: 78, active: true },
  { id: "tp4", title: "Analyse en Composantes Principales", description: "Réduction de dimensionnalité avec PCA", domain: "Data Science", difficulty: "Avancé", tags: ["R", "Data Science"], duration: "55 min", icon: "📊", generatedCount: 19, avgScore: 61, active: true },
  { id: "tp5", title: "Programmation orientée objet", description: "Concepts fondamentaux de l'OOP (héritage, polymorphisme)", domain: "Java", difficulty: "Débutant", tags: ["Java", "OOP"], duration: "40 min", icon: "🧱", aiRecommended: true, matchPercentage: 91, generatedCount: 52, avgScore: 81, active: true },
  { id: "tp6", title: "Requêtes SQL avancées", description: "Jointures, sous-requêtes et optimisation", domain: "Bases de données", difficulty: "Intermédiaire", tags: ["SQL", "Bases de données"], duration: "35 min", icon: "🗃️", generatedCount: 38, avgScore: 74, active: true },
  { id: "tp7", title: "Algorithmes de graphes", description: "BFS, DFS, Dijkstra et applications", domain: "Algorithmique", difficulty: "Avancé", tags: ["Python", "Algorithmes", "Graphes"], duration: "65 min", icon: "🕸️", generatedCount: 22, avgScore: 58, active: true },
  { id: "tp8", title: "Classification supervisée", description: "KNN, SVM et évaluation de modèles", domain: "Machine Learning", difficulty: "Intermédiaire", tags: ["Python", "Machine Learning"], duration: "50 min", icon: "🤖", aiRecommended: true, matchPercentage: 87, generatedCount: 35, avgScore: 70, active: false },
];

export const submissions: Submission[] = [
  { id: "sub1", studentId: "s1", topicId: "tp1", topicTitle: "Tri et recherche", score: 73, duration: "42 min", date: "2024-03-15", status: "completed", tests: [{ name: "Liste vide", passed: true }, { name: "Liste triée", passed: true }, { name: "Pivot worst case", passed: false, detail: "Complexité O(n²) détectée" }, { name: "Grande liste", passed: false, detail: "Timeout dépassé" }], aiAnalysis: { accuracy: 80, performance: 60, readability: 90, bestPractices: 75, errors: [{ type: "LogicError", count: 1 }, { type: "AlgoError", count: 1 }], recommendations: ["Utiliser un pivot aléatoire pour éviter le pire cas", "Ajouter une gestion de la mémoire pour les grandes listes", "Revoir la complexité temporelle"] } },
  { id: "sub2", studentId: "s1", topicId: "tp5", topicTitle: "Programmation OOP", score: 88, duration: "35 min", date: "2024-03-13", status: "completed", tests: [{ name: "Héritage", passed: true }, { name: "Polymorphisme", passed: true }, { name: "Encapsulation", passed: true }], aiAnalysis: { accuracy: 90, performance: 85, readability: 92, bestPractices: 88, errors: [], recommendations: ["Excellent travail !"] } },
  { id: "sub3", studentId: "s1", topicId: "tp3", topicTitle: "Régression linéaire", score: 81, duration: "48 min", date: "2024-03-10", status: "completed", tests: [{ name: "Fit simple", passed: true }, { name: "Multi-variable", passed: true }, { name: "R² score", passed: false, detail: "R² = 0.72, attendu > 0.85" }], aiAnalysis: { accuracy: 85, performance: 78, readability: 88, bestPractices: 80, errors: [{ type: "AccuracyError", count: 1 }], recommendations: ["Normaliser les features avant le fit"] } },
  { id: "sub4", studentId: "s1", topicId: "tp6", topicTitle: "Requêtes SQL", score: 65, duration: "38 min", date: "2024-03-08", status: "completed", tests: [{ name: "JOIN simple", passed: true }, { name: "Sous-requête", passed: false, detail: "Résultat incorrect" }, { name: "GROUP BY", passed: true }], aiAnalysis: { accuracy: 70, performance: 65, readability: 80, bestPractices: 60, errors: [{ type: "LogicError", count: 1 }], recommendations: ["Revoir les sous-requêtes corrélées"] } },
  { id: "sub5", studentId: "s1", topicId: "tp8", topicTitle: "Classification supervisée", score: 79, duration: "52 min", date: "2024-03-05", status: "completed", tests: [{ name: "KNN basic", passed: true }, { name: "Cross-validation", passed: true }, { name: "Confusion matrix", passed: false, detail: "Matrice incomplète" }], aiAnalysis: { accuracy: 82, performance: 75, readability: 85, bestPractices: 78, errors: [{ type: "ImplementationError", count: 1 }], recommendations: ["Ajouter la matrice de confusion complète"] } },
];

export const chatMessages: ChatMessage[] = [
  { id: "c1", sender: "agent", agentType: "tuteur", content: "Bonjour Salahddine ! Je suis votre assistant pour ce TP. N'hésitez pas à me poser des questions sur l'algorithme ou votre code. Je vous guiderai sans vous donner la solution directement 😊", timestamp: "14:30" },
  { id: "c2", sender: "student", content: "Je ne comprends pas comment choisir le pivot", timestamp: "14:32" },
  { id: "c3", sender: "agent", agentType: "tuteur", content: "Bonne question ! Le choix du pivot est crucial pour les performances de QuickSort. Pensez à ce qui se passerait si vous choisissiez toujours le premier élément... Quel serait le pire cas ? 🤔", timestamp: "14:32" },
  { id: "c4", sender: "student", content: "Si la liste est déjà triée, ça serait O(n²) ?", timestamp: "14:35" },
  { id: "c5", sender: "agent", agentType: "tuteur", content: "Exactement ! 🎯 C'est pour ça qu'on utilise souvent un pivot aléatoire ou la médiane de trois éléments. Essayez de modifier votre fonction pour utiliser un pivot aléatoire et observez la différence.", timestamp: "14:35" },
];

export const ragDocuments: RAGDocument[] = [
  { id: "d1", filename: "Cours_Algorithmique_Ch3.pdf", type: "pdf", size: "2.4 MB", topic: "Algorithmique", status: "indexed", dateAdded: "2024-03-01", chunks: 156 },
  { id: "d2", filename: "TP_Exemples_Tri.pdf", type: "pdf", size: "1.1 MB", topic: "Algorithmique", status: "indexed", dateAdded: "2024-03-02", chunks: 89 },
  { id: "d3", filename: "Solutions_Arbres.md", type: "md", size: "340 KB", topic: "Structures de données", status: "indexed", dateAdded: "2024-03-05", chunks: 45 },
  { id: "d4", filename: "Cours_ML_Regression.pdf", type: "pdf", size: "3.8 MB", topic: "Machine Learning", status: "indexed", dateAdded: "2024-02-28", chunks: 234 },
  { id: "d5", filename: "Exercices_SQL_Avancé.pdf", type: "pdf", size: "890 KB", topic: "Bases de données", status: "indexed", dateAdded: "2024-03-10", chunks: 67 },
  { id: "d6", filename: "Notes_Graphes_BFS_DFS.md", type: "md", size: "210 KB", topic: "Algorithmique", status: "processing", dateAdded: "2024-03-14", chunks: 0 },
  { id: "d7", filename: "Cours_OOP_Java.pdf", type: "pdf", size: "4.2 MB", topic: "Java", status: "indexed", dateAdded: "2024-02-15", chunks: 312 },
  { id: "d8", filename: "Guide_PCA_Pratique.txt", type: "txt", size: "156 KB", topic: "Data Science", status: "indexed", dateAdded: "2024-03-08", chunks: 34 },
];

export const weeklyReports: WeeklyReport[] = [
  { studentId: "s1", week: "11-17 Mars 2024", summary: "Salahddine a montré des progrès constants cette semaine avec 3 TPs complétés. Son point fort reste la lisibilité du code, mais la gestion de la complexité algorithmique nécessite plus de travail.", strengths: ["Qualité de code excellente", "Bonne compréhension des concepts OOP", "Participation régulière"], weaknesses: ["Difficulté avec les cas limites des algorithmes récursifs", "Optimisation des performances"], recommendations: ["Revoir le chapitre 3 sur la récursivité", "Pratiquer les algorithmes de tri avancés", "Essayer le TP sur les arbres binaires"] },
  { studentId: "s3", week: "11-17 Mars 2024", summary: "Omar n'a montré aucune activité cette semaine. Son dernier TP date de 8 jours. Intervention recommandée.", strengths: ["Bonne compréhension de SQL"], weaknesses: ["Absence prolongée", "Difficultés en programmation orientée objet"], recommendations: ["Contacter l'étudiant", "Proposer un TP de niveau débutant pour reprendre"] },
];

export const scoreHistory = [
  { tp: "TP1", score: 65 },
  { tp: "TP2", score: 79 },
  { tp: "TP3", score: 81 },
  { tp: "TP4", score: 88 },
  { tp: "TP5", score: 73 },
];

export const classScoreTrend = [
  { week: "S1", score: 65 },
  { week: "S2", score: 68 },
  { week: "S3", score: 64 },
  { week: "S4", score: 71 },
  { week: "S5", score: 69 },
  { week: "S6", score: 73 },
  { week: "S7", score: 71 },
  { week: "S8", score: 75 },
];

export const commonErrors = [
  { name: "Récursivité", percentage: 45 },
  { name: "Complexité O(n)", percentage: 38 },
  { name: "Pointeurs", percentage: 31 },
  { name: "Récurrence", percentage: 28 },
];

export const activityData = Array.from({ length: 84 }, (_, i) => ({
  day: i,
  count: Math.floor(Math.random() * 5),
}));
