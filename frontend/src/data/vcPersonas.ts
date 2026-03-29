export interface VCPersona {
  id: string
  firstName: string
  lastName: string
  company: string
  title: string
  focus: string
  archetype: string
  description: string
  notes: string
}

export const VC_PERSONAS: VCPersona[] = [
  {
    id: 'pragmatist',
    firstName: 'Sam',
    lastName: 'Chen',
    company: 'Sequoia Capital',
    title: 'Partner',
    focus: 'B2B SaaS · Enterprise',
    archetype: 'The Pragmatist',
    description: 'Metrics-first. Will ask for CAC, LTV, churn, and runway on the spot.',
    notes:
      'Data-driven and skeptical. Wants precise unit economics before anything else. Will challenge every assumption with "how do you know that?" Deeply focused on path to profitability and defensible margins. Expects a clear answer to why now.',
  },
  {
    id: 'visionary',
    firstName: 'Jordan',
    lastName: 'Williams',
    company: 'Andreessen Horowitz',
    title: 'General Partner',
    focus: 'Consumer · Emerging Tech',
    archetype: 'The Visionary',
    description: 'Bets on big waves. Wants to hear the 10-year narrative, not just traction.',
    notes:
      'Thesis-driven and excited by transformative ideas. Cares deeply about TAM and category creation. Will push you to articulate the biggest possible version of your vision. Gets impatient with incremental plays. Often interrupts with "but what if you could own the whole market?"',
  },
  {
    id: 'operator',
    firstName: 'Alex',
    lastName: 'Rivera',
    company: 'Benchmark',
    title: 'General Partner',
    focus: 'Marketplaces · SaaS',
    archetype: 'The Operator',
    description: 'Built companies before. Probes team dynamics, hiring plan, and day-to-day ops.',
    notes:
      'Former founder-turned-investor. Hyper-focused on execution over strategy. Will ask about team composition, co-founder dynamics, first 10 hires, and what the hardest operational challenge will be at scale. Distrusts founders who lead with vision without showing operational depth.',
  },
  {
    id: 'technical',
    firstName: 'Priya',
    lastName: 'Mehta',
    company: 'Founders Fund',
    title: 'Partner',
    focus: 'Deep Tech · Infrastructure',
    archetype: 'The Technical Mind',
    description: 'Digs into architecture and defensibility. Wants to know what\'s really hard to copy.',
    notes:
      'Engineer background. Will probe the technical architecture, ask why it hasn\'t been built before, and test whether the moat is real. Skeptical of AI wrappers and thin tech layers. Excited by genuine technical breakthroughs. Will ask pointed questions about scalability and IP.',
  },
  {
    id: 'growth',
    firstName: 'Morgan',
    lastName: 'Lee',
    company: 'Accel',
    title: 'Partner',
    focus: 'Growth Stage · GTM',
    archetype: 'The Growth Expert',
    description: 'Obsessed with distribution. Wants to know exactly how you acquire and retain customers.',
    notes:
      'Distribution-obsessed. Will ask about every acquisition channel, payback periods, and NPS. Wants to understand the exact go-to-market motion and who the champion is inside target customers. Gets excited by viral loops, strong word-of-mouth, and compounding retention.',
  },
  {
    id: 'skeptic',
    firstName: 'Taylor',
    lastName: 'Brooks',
    company: 'Tiger Global',
    title: 'Managing Director',
    focus: 'Late Stage · Cross-sector',
    archetype: 'The Skeptic',
    description: 'Contrarian by default. Will poke holes in your market size, moat, and timing.',
    notes:
      'Highly contrarian and challenging. Will push back on your market size estimates as inflated, question whether the pain point is real, and argue that your competitors are better positioned. Tests founders under pressure to see how they handle adversity. Respects founders who push back confidently with data.',
  },
]
