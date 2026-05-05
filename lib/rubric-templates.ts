import type { RubricDimension, RubricOrigin } from './db'

export type RubricTemplate = {
  templateId: string
  name: string
  dimensions: RubricDimension[]
  origin: RubricOrigin
}

export const STANFORD_ORAL_COMM: RubricTemplate = {
  templateId: 'stanford_oral_comm',
  name: 'Stanford SCALE / AAC&U Oral Communication',
  origin: { template_id: 'stanford_oral_comm' },
  dimensions: [
    {
      id: 'organization',
      name: 'Organization',
      description: 'Grouping and sequencing of ideas: introduction, sequenced body, transitions, conclusion.',
      active: true,
      weight: 0.25,
      proficiency_levels: [
        { level: 1, label: 'Basic', descriptor: 'Organizational pattern (specific introduction and conclusion, sequenced material within the body, and transitions) is not observable within the presentation.' },
        { level: 2, label: 'Developing', descriptor: 'Organizational pattern is intermittently observable within the presentation.' },
        { level: 3, label: 'Proficient', descriptor: 'Organizational pattern is clearly and consistently observable within the presentation.' },
        { level: 4, label: 'Mastery', descriptor: 'Organizational pattern is clearly and consistently observable, skillful, and makes the content cohesive.' },
      ],
    },
    {
      id: 'language',
      name: 'Language',
      description: 'Vocabulary, terminology, and sentence structure appropriate to topic and audience.',
      active: true,
      weight: 0.25,
      proficiency_levels: [
        { level: 1, label: 'Basic', descriptor: 'Language choices are unclear and minimally support the effectiveness of the presentation; not appropriate to audience.' },
        { level: 2, label: 'Developing', descriptor: 'Language choices are mundane and commonplace and partially support the effectiveness of the presentation.' },
        { level: 3, label: 'Proficient', descriptor: 'Language choices are thoughtful and generally support the effectiveness of the presentation.' },
        { level: 4, label: 'Mastery', descriptor: 'Language choices are imaginative, memorable, and compelling, and enhance the effectiveness of the presentation.' },
      ],
    },
    {
      id: 'delivery',
      name: 'Delivery',
      description: 'Posture, gesture, eye contact, vocal expressiveness. Inactive for text-based sessions; included for forward compatibility with voice/video modes.',
      active: false,
      weight: 0.0,
      proficiency_levels: [
        { level: 1, label: 'Basic', descriptor: 'Delivery techniques detract from the understandability of the presentation; speaker appears uncomfortable.' },
        { level: 2, label: 'Developing', descriptor: 'Delivery techniques make the presentation understandable; speaker appears tentative.' },
        { level: 3, label: 'Proficient', descriptor: 'Delivery techniques make the presentation interesting; speaker appears comfortable.' },
        { level: 4, label: 'Mastery', descriptor: 'Delivery techniques make the presentation compelling; speaker appears polished and confident.' },
      ],
    },
    {
      id: 'supporting_material',
      name: 'Supporting Material',
      description: 'Explanations, examples, statistics, analogies, quotations from authorities supporting the central ideas.',
      active: true,
      weight: 0.25,
      proficiency_levels: [
        { level: 1, label: 'Basic', descriptor: 'Insufficient supporting materials; minimally supports the presentation or establishes credibility.' },
        { level: 2, label: 'Developing', descriptor: 'Supporting materials partially support the presentation or establish credibility.' },
        { level: 3, label: 'Proficient', descriptor: 'Supporting materials generally support the presentation or establish credibility.' },
        { level: 4, label: 'Mastery', descriptor: 'A variety of supporting materials significantly support the presentation and establish the presenter\'s credibility/authority.' },
      ],
    },
    {
      id: 'central_message',
      name: 'Central Message',
      description: 'Main point/thesis/take-away of the articulation.',
      active: true,
      weight: 0.25,
      proficiency_levels: [
        { level: 1, label: 'Basic', descriptor: 'Central message can be deduced but is not explicitly stated.' },
        { level: 2, label: 'Developing', descriptor: 'Central message is basically understandable but is not often repeated and is not memorable.' },
        { level: 3, label: 'Proficient', descriptor: 'Central message is clear and consistent with the supporting material.' },
        { level: 4, label: 'Mastery', descriptor: 'Central message is compelling — precisely stated, appropriately repeated, memorable, and strongly supported.' },
      ],
    },
  ],
}

export const TEMPLATES: RubricTemplate[] = [STANFORD_ORAL_COMM]

export function getTemplate(templateId: string): RubricTemplate | null {
  return TEMPLATES.find(t => t.templateId === templateId) ?? null
}
