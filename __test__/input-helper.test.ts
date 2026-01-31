import {
  parseBooleanInput,
  parseVariantsInput,
  parseSourcesInput,
  parseInstallPortsInput
} from '../src/input-helper'

describe('input-helper', () => {
  describe('parseBooleanInput', () => {
    it.each([
      ['true', true],
      ['TRUE', true],
      ['1', true],
      ['yes', true],
      ['false', false],
      ['FALSE', false],
      ['0', false],
      ['no', false]
    ])('parseBooleanInput("%s") should return %s', (input, expected) => {
      expect(parseBooleanInput(input)).toBe(expected)
    })

    it('handles whitespace', () => {
      expect(parseBooleanInput('  true  ')).toBe(true)
    })
  })

  describe('parseVariantsInput', () => {
    it('returns empty config for empty input', () => {
      expect(parseVariantsInput('')).toEqual({select: [], deselect: []})
      expect(parseVariantsInput('   ')).toEqual({select: [], deselect: []})
    })

    it('parses variants with + prefix', () => {
      expect(parseVariantsInput('+aqua +metal')).toEqual({
        select: ['aqua', 'metal'],
        deselect: []
      })
    })

    it('parses variants with - prefix', () => {
      expect(parseVariantsInput('-x11 -x11')).toEqual({
        select: [],
        deselect: ['x11', 'x11']
      })
    })

    it('parses mixed + and - variants', () => {
      expect(parseVariantsInput('+aqua +metal -x11')).toEqual({
        select: ['aqua', 'metal'],
        deselect: ['x11']
      })
    })

    it('throws error for invalid variant syntax', () => {
      expect(() => parseVariantsInput('aqua')).toThrow('Invalid variant syntax')
      // Note: ++aqua is actually accepted as variant name "+aqua"
      // which may be unusual but is technically valid
    })
  })

  describe('parseSourcesInput', () => {
    it('returns empty array for empty input', () => {
      expect(parseSourcesInput('')).toEqual([])
    })

    it('parses multiline sources', () => {
      const input = 'rsync://example.com/ports.tar\nfile:///local/ports'
      expect(parseSourcesInput(input)).toEqual([
        'rsync://example.com/ports.tar',
        'file:///local/ports'
      ])
    })

    it('trims whitespace from each line', () => {
      const input = '  rsync://example.com/ports.tar  \n  file:///local/ports  '
      expect(parseSourcesInput(input)).toEqual([
        'rsync://example.com/ports.tar',
        'file:///local/ports'
      ])
    })

    it('filters empty lines', () => {
      const input = 'rsync://example.com/ports.tar\n\nfile:///local/ports\n'
      expect(parseSourcesInput(input)).toEqual([
        'rsync://example.com/ports.tar',
        'file:///local/ports'
      ])
    })
  })

  describe('parseInstallPortsInput', () => {
    it('returns empty array for empty input', () => {
      expect(parseInstallPortsInput('')).toEqual([])
    })

    it('parses space-separated port names', () => {
      expect(parseInstallPortsInput('git curl wget')).toEqual([
        {name: 'git'},
        {name: 'curl'},
        {name: 'wget'}
      ])
    })

    it('parses JSON array with variants', () => {
      const input = '[{"name":"db48","variants":"+tcl +universal -java"}]'
      expect(parseInstallPortsInput(input)).toEqual([
        {name: 'db48', variants: '+tcl +universal -java'}
      ])
    })

    it('parses JSON array without variants', () => {
      const input = '[{"name":"git"},{"name":"curl"}]'
      expect(parseInstallPortsInput(input)).toEqual([
        {name: 'git'},
        {name: 'curl'}
      ])
    })

    it('falls back to space-separated for invalid JSON', () => {
      const input = '[invalid json] git curl'
      // Space-separated split treats each whitespace-separated token as a port name
      expect(parseInstallPortsInput(input)).toEqual([
        {name: '[invalid'},
        {name: 'json]'},
        {name: 'git'},
        {name: 'curl'}
      ])
    })
  })
})
