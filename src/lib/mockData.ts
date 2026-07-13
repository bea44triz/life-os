// Mocked data for Life OS MVP. Structure mirrors planned Supabase tables.

export const user = {
  name: "Beatriz",
  greeting: "Bom te ver de novo",
  avatar: "B",
};

export const account = {
  name: "Conta principal",
  bank: "Itaú",
  balance: 8420.55,
};

export type CreditCard = {
  id: string;
  name: string;
  bank: string;
  brand: string;
  limit: number;
  used: number;
  closingDay: number;
  dueDay: number;
  color: string;
};

export const creditCards: CreditCard[] = [
  {
    id: "card-nubank",
    name: "Nubank",
    bank: "Nubank",
    brand: "Mastercard",
    limit: 8000,
    used: 2340.18,
    closingDay: 5,
    dueDay: 12,
    color: "oklch(0.45 0.18 320)",
  },
  {
    id: "card-xp",
    name: "XP Visa Infinite",
    bank: "XP",
    brand: "Visa",
    limit: 15000,
    used: 4180.9,
    closingDay: 20,
    dueDay: 27,
    color: "oklch(0.3 0.04 260)",
  },
];

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  amount: number; // negative = expense
  type: "income" | "expense" | "card" | "transfer";
  source: "manual" | "txt" | "csv" | "pdf";
  account?: string;
  cardId?: string;
  projectId?: string;
  installment?: { current: number; total: number };
};

export const transactions: Transaction[] = [
  { id: "t1", date: "2026-06-26", description: "iFood - Sushi Yassu", category: "Delivery", amount: -78.4, type: "card", source: "manual", cardId: "card-nubank" },
  { id: "t2", date: "2026-06-25", description: "Smartfit - Mensalidade", category: "Saúde", amount: -109.9, type: "expense", source: "manual", account: "Itaú" },
  { id: "t3", date: "2026-06-25", description: "Salário", category: "Renda", amount: 9800, type: "income", source: "manual", account: "Itaú" },
  { id: "t4", date: "2026-06-24", description: "Pão de Açúcar", category: "Mercado", amount: -312.55, type: "card", source: "csv", cardId: "card-xp" },
  { id: "t5", date: "2026-06-23", description: "Rappi - Açaí", category: "Delivery", amount: -42.9, type: "card", source: "manual", cardId: "card-nubank" },
  { id: "t6", date: "2026-06-22", description: "Curso de Japonês - Mensal", category: "Educação", amount: -189, type: "card", source: "pdf", cardId: "card-xp", projectId: "p1" },
  { id: "t7", date: "2026-06-20", description: "Uber", category: "Transporte", amount: -34.5, type: "card", source: "manual", cardId: "card-nubank" },
  { id: "t8", date: "2026-06-18", description: "Notebook Lenovo - 6/12", category: "Eletrônicos", amount: -416.6, type: "card", source: "pdf", cardId: "card-xp", installment: { current: 6, total: 12 } },
  { id: "t9", date: "2026-06-15", description: "Spotify Family", category: "Assinatura", amount: -34.9, type: "card", source: "manual", cardId: "card-nubank" },
  { id: "t10", date: "2026-06-14", description: "Aporte poupança Japão", category: "Investimento", amount: -800, type: "transfer", source: "manual", account: "Itaú", projectId: "p1" },
  { id: "t11", date: "2026-06-12", description: "iFood - Marmita fit", category: "Delivery", amount: -36.5, type: "card", source: "manual", cardId: "card-nubank" },
  { id: "t12", date: "2026-06-10", description: "Aluguel", category: "Moradia", amount: -2200, type: "expense", source: "manual", account: "Itaú" },
];

export const monthSummary = {
  income: 9800,
  expenses: 2647.85,
  openCardTotal: 2340.18,
  nextBillTotal: 1820.4,
  saved: 800,
};

export type Project = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  deadline: string;
  goalAmount?: number;
  savedAmount?: number;
  behavioralGoal?: string;
  behavioralProgress?: number; // 0-100
  tone: "gold" | "sage" | "sky";
};

export const projects: Project[] = [
  {
    id: "p1",
    name: "Viajar para o Japão",
    emoji: "🗾",
    description: "Duas semanas em Tóquio e Kyoto na primavera de 2027.",
    deadline: "Abr 2027",
    goalAmount: 20000,
    savedAmount: 6400,
    behavioralGoal: "Estudar japonês 3x por semana",
    behavioralProgress: 62,
    tone: "gold",
  },
  {
    id: "p2",
    name: "Perder 15 kg",
    emoji: "🌱",
    description: "Mais comida em casa, caminhada diária e sono regular.",
    deadline: "Dez 2026",
    behavioralGoal: "Caminhar 30min e cozinhar 5x/semana",
    behavioralProgress: 48,
    tone: "sage",
  },
  {
    id: "p3",
    name: "Reserva de emergência",
    emoji: "🛟",
    description: "Seis meses de despesas guardados em renda fixa.",
    deadline: "Mar 2027",
    goalAmount: 15000,
    savedAmount: 4200,
    behavioralProgress: 28,
    tone: "sky",
  },
];

export type Habit = {
  id: string;
  name: string;
  area: "saúde" | "dinheiro" | "rotina" | "aprendizado" | "bem-estar";
  streak: number;
  weekDone: number; // out of 7
  emoji: string;
  projectId?: string;
};

export const habits: Habit[] = [
  { id: "h1", name: "Caminhar 30 minutos", area: "saúde", streak: 12, weekDone: 5, emoji: "🚶‍♀️", projectId: "p2" },
  { id: "h2", name: "Cozinhar em casa", area: "saúde", streak: 4, weekDone: 3, emoji: "🍳", projectId: "p2" },
  { id: "h3", name: "Beber 2L de água", area: "bem-estar", streak: 21, weekDone: 6, emoji: "💧" },
  { id: "h4", name: "Estudar japonês", area: "aprendizado", streak: 8, weekDone: 4, emoji: "🇯🇵", projectId: "p1" },
  { id: "h5", name: "Registrar gastos", area: "dinheiro", streak: 30, weekDone: 7, emoji: "📒" },
  { id: "h6", name: "Dormir antes das 23h", area: "rotina", streak: 2, weekDone: 3, emoji: "🌙" },
];

export type JournalEntry = {
  id: string;
  date: string;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  anxiety: 1 | 2 | 3 | 4 | 5;
  gratitude?: string;
  text: string;
};

export const journal: JournalEntry[] = [
  {
    id: "j1",
    date: "2026-06-26",
    mood: 2,
    energy: 2,
    anxiety: 4,
    gratitude: "Conversa boa com minha irmã.",
    text: "Hoje me senti ansiosa e pedi delivery novamente. Não consegui treinar.",
  },
  {
    id: "j2",
    date: "2026-06-25",
    mood: 4,
    energy: 4,
    anxiety: 2,
    gratitude: "Café da manhã sem pressa.",
    text: "Dia mais leve. Caminhei de manhã e cozinhei à noite. Me senti no controle.",
  },
  {
    id: "j3",
    date: "2026-06-24",
    mood: 3,
    energy: 3,
    anxiety: 3,
    text: "Dia normal. Foco no trabalho, sem grandes vitórias nem derrotas.",
  },
];

export const weekMood = [3, 4, 2, 3, 4, 3, 2]; // seg..dom

export type Insight = {
  id: string;
  kind: "pattern" | "explanation" | "suggestion" | "question";
  title: string;
  body: string;
  related: string[]; // ids: projects, habits
  tone: "sage" | "sky" | "gold" | "clay";
};

export const insights: Insight[] = [
  {
    id: "i1",
    kind: "pattern",
    title: "Ansiedade e delivery andam juntos",
    body: "Percebi que nos dias em que sua ansiedade ficou mais alta, seus gastos com delivery também aumentaram. Isso pode estar afetando seu projeto Japão e seu objetivo de emagrecimento. Quer revisar uma alternativa simples para esses dias?",
    related: ["p1", "p2"],
    tone: "gold",
  },
  {
    id: "i2",
    kind: "explanation",
    title: "Sua fatura Nubank fecha em 4 dias",
    body: "Parte dos gastos feitos agora ainda pode entrar nesta fatura, o que pode reduzir a folga do seu caixa no vencimento do dia 12. Quer ver quais compras mais pesaram?",
    related: ["card-nubank"],
    tone: "sky",
  },
  {
    id: "i3",
    kind: "suggestion",
    title: "Academia sem registro há 2 semanas",
    body: "Você continua investindo na academia, mas não registrou atividades nas últimas semanas. Talvez o problema não seja falta de disciplina, e sim o formato. Caminhada pode combinar melhor com sua rotina atual. Quer testar uma meta mais leve esta semana?",
    related: ["p2", "h1"],
    tone: "sage",
  },
];

export const onboardingQuestions = [
  {
    id: "goal",
    title: "Qual seu principal objetivo neste momento?",
    options: ["Organizar minhas finanças", "Realizar um sonho", "Cuidar do bem-estar", "Sair das dívidas", "Construir patrimônio"],
  },
  {
    id: "feeling",
    title: "Como você se sente com sua vida financeira hoje?",
    options: ["Em paz", "Em alerta", "Ansiosa", "Perdida", "Animada"],
  },
  {
    id: "areas",
    title: "Quais áreas deseja acompanhar?",
    options: ["Finanças", "Cartão de crédito", "Hábitos", "Sono", "Exercícios", "Humor", "Projetos"],
    multi: true,
  },
  {
    id: "projects",
    title: "Algum projeto importante agora?",
    options: ["Viajar", "Emagrecer", "Comprar casa", "Abrir empresa", "Trocar de carro", "Casar", "Aprender inglês"],
    multi: true,
  },
] as const;
