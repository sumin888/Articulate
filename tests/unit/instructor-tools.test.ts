import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB layer
vi.mock('@/lib/db', () => ({
  listCourseConcepts: vi.fn(),
  getOrCreateAgentState: vi.fn(),
  updateAgentState: vi.fn(),
  createCalibrationVersion: vi.fn(),
  getActiveCalibration: vi.fn(),
  getActiveRubric: vi.fn(),
  createRubricVersion: vi.fn(),
  getCalibrationVersion: vi.fn(),
  updateCalibrationField: vi.fn(),
  newId: vi.fn(() => 'test-id'),
}))

vi.mock('@/lib/source-ingestion', () => ({
  readSourceText: vi.fn(() => 'sample source text about quantum mechanics'),
}))

vi.mock('@/lib/chat-completion', () => ({
  createChatCompletion: vi.fn(),
}))

vi.mock('@/lib/rubric-templates', () => ({
  getTemplate: vi.fn(),
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    set: vi.fn(),
  })),
}))

import {
  read_source,
  extract_concepts,
  propose_seed_questions,
  generate_rubric,
  update_calibration_profile,
  publish_calibration_version,
  request_instructor_input,
  mark_draft_complete,
  get_agent_state,
} from '@/lib/instructor-tools'
import { listCourseConcepts, getOrCreateAgentState, updateAgentState, getActiveCalibration, getActiveRubric, createRubricVersion, getCalibrationVersion, updateCalibrationField, createCalibrationVersion, newId } from '@/lib/db'
import { readSourceText } from '@/lib/source-ingestion'
import { createChatCompletion } from '@/lib/chat-completion'
import { getTemplate } from '@/lib/rubric-templates'
import type { AgentState, CalibrationVersion, RubricVersion } from '@/lib/db'

describe('read_source', () => {
  it('returns text from readSourceText', () => {
    vi.mocked(readSourceText).mockReturnValue('quantum text')
    const result = read_source('src-1')
    expect(result).toBe('quantum text')
    expect(readSourceText).toHaveBeenCalledWith('src-1', undefined)
  })

  it('passes page range through', () => {
    read_source('src-1', [1, 5])
    expect(readSourceText).toHaveBeenCalledWith('src-1', [1, 5])
  })
})

describe('extract_concepts', () => {
  it('returns mapped concepts from DB', () => {
    vi.mocked(listCourseConcepts).mockReturnValue([
      { id: 'c1', sourceId: 'src-1', label: 'Quantum entanglement', chunkIds: ['ch1', 'ch2'] },
    ])
    const result = extract_concepts('src-1')
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Quantum entanglement')
    expect(result[0].chunkIds).toEqual(['ch1', 'ch2'])
  })
})

describe('propose_seed_questions', () => {
  it('calls LLM and returns parsed questions', async () => {
    vi.mocked(listCourseConcepts).mockReturnValue([
      { id: 'c1', sourceId: 's1', label: 'Superposition', chunkIds: [] },
    ])
    vi.mocked(createChatCompletion).mockResolvedValue({
      choices: [{
        message: {
          content: '{"questions":[{"text":"What is superposition?","type":"factual","dimension_targeted":"central_message"}]}',
        },
      }],
    } as Awaited<ReturnType<typeof createChatCompletion>>)
    vi.mocked(newId).mockReturnValue('q-id')

    const result = await propose_seed_questions('course-1', 1, 0.5)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('What is superposition?')
    expect(result[0].type).toBe('factual')
    expect(result[0].instructor_approved).toBe(false)
  })
})

describe('generate_rubric', () => {
  it('returns Stanford template when style is stanford_oral_comm', async () => {
    const template = {
      templateId: 'stanford_oral_comm',
      name: 'Stanford',
      dimensions: [],
      origin: { template_id: 'stanford_oral_comm' },
    }
    vi.mocked(getTemplate).mockReturnValue(template)
    vi.mocked(createRubricVersion).mockReturnValue({
      id: 'rv-1', courseId: 'c1', isActive: true, source: 'template',
      templateId: 'stanford_oral_comm', dimensions: [], origin: {}, createdAt: 0,
    } as RubricVersion)

    const result = await generate_rubric('course-1', [], 'stanford_oral_comm')
    expect(createRubricVersion).toHaveBeenCalledWith('course-1', 'template', [], expect.anything(), 'stanford_oral_comm')
    expect(result.source).toBe('template')
  })
})

describe('update_calibration_profile', () => {
  const mockCalibration: CalibrationVersion = {
    id: 'cal-1', courseId: 'c1', rubricVersionId: 'rv-1', isActive: true,
    createdBy: 'instructor', depthBreadth: 0.5, seedQuestions: [],
    inferredTypes: [], emphasisConcepts: [], deEmphasisConcepts: [],
    tonePreferences: { formality: 'professional', scaffolding_level: 'moderate' },
    reasoningLog: [], createdAt: 0,
  }

  beforeEach(() => {
    vi.mocked(getActiveCalibration).mockReturnValue(mockCalibration)
    vi.mocked(getCalibrationVersion).mockReturnValue({ ...mockCalibration, reasoningLog: [expect.anything()] } as CalibrationVersion)
    vi.mocked(updateCalibrationField).mockReturnValue(undefined)
  })

  it('throws for unknown fields', async () => {
    await expect(update_calibration_profile('c1', 'unknownField', 42, 'test', 'instructor'))
      .rejects.toThrow('Unknown calibration field')
  })

  it('updates depthBreadth and appends to reasoning log', async () => {
    await update_calibration_profile('c1', 'depthBreadth', 0.8, 'Focus on depth', 'instructor')
    expect(updateCalibrationField).toHaveBeenCalledWith('cal-1', 'depth_breadth', '0.8')
    expect(updateCalibrationField).toHaveBeenCalledWith('cal-1', 'reasoning_log_json', expect.stringContaining('Focus on depth'))
  })
})

describe('request_instructor_input — question budget enforcement', () => {
  it('rejects if draft is not complete', async () => {
    vi.mocked(getOrCreateAgentState).mockReturnValue({
      courseId: 'c1', questionsAsked: 0, draftComplete: false, updatedAt: 0,
    } as AgentState)

    await expect(request_instructor_input('c1', 'depthBreadth', 'slider', {}))
      .rejects.toThrow('must complete a draft')
  })

  it('rejects when budget (3) is exhausted', async () => {
    vi.mocked(getOrCreateAgentState).mockReturnValue({
      courseId: 'c1', questionsAsked: 3, draftComplete: true, updatedAt: 0,
    } as AgentState)

    await expect(request_instructor_input('c1', 'depthBreadth', 'slider', {}))
      .rejects.toThrow('budget exhausted')
  })

  it('increments counter and returns requestId when valid', async () => {
    vi.mocked(getOrCreateAgentState).mockReturnValue({
      courseId: 'c1', questionsAsked: 1, draftComplete: true, updatedAt: 0,
    } as AgentState)
    vi.mocked(updateAgentState).mockReturnValue(undefined)

    const id = await request_instructor_input('c1', 'depthBreadth', 'slider', { min: 0, max: 1 })
    expect(typeof id).toBe('string')
    expect(updateAgentState).toHaveBeenCalledWith('c1', { questionsAsked: 2 })
  })
})

describe('mark_draft_complete', () => {
  it('sets draftComplete to true', () => {
    vi.mocked(getOrCreateAgentState).mockReturnValue({
      courseId: 'c1', questionsAsked: 0, draftComplete: false, updatedAt: 0,
    } as AgentState)
    mark_draft_complete('c1')
    expect(updateAgentState).toHaveBeenCalledWith('c1', { draftComplete: true })
  })
})
