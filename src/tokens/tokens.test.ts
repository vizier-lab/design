/**
 * The contrast the panel's amber text depends on, asserted rather than eyeballed (T098).
 *
 * Two layers are checked: the values declared in `tokens.css` (so a later edit cannot quietly
 * undo the measurement) and the WCAG ratio those values produce. A token that reads well only in
 * one theme is worse than no token, because the failure shows up as unreadable text rather than as
 * a missing style — so both themes are measured.
 *
 * The ratios are computed here rather than imported: WCAG's own formula is six lines, and a
 * dependency for it would be one more thing the design package has to keep current.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, 'tokens.css'), 'utf8')

/** The file's three theme blocks, cut at the markers that open them. */
const darkMediaAt = css.indexOf('@media (prefers-color-scheme: dark)')
const darkAttrAt = css.indexOf(':root[data-theme="dark"]')
const light = css.slice(0, darkMediaAt)
const darkMedia = css.slice(darkMediaAt, darkAttrAt)
const darkAttr = css.slice(darkAttrAt)

function declared(block: string, name: string): string | undefined {
    // A plain pattern, with no backslash escapes: inside a template literal they are swallowed.
    const match = block.match(new RegExp(name + ': *(#[0-9a-fA-F]{3,8})'))
    return match?.[1]?.toLowerCase()
}

function channel(value: number): number {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance, WCAG 2.1 §relative luminance. */
function luminance(hex: string): number {
    const h = hex.replace('#', '')
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(h.slice(at, at + 2), 16))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Contrast ratio between two opaque colours, WCAG 2.1 §contrast ratio. */
function contrast(a: string, b: string): number {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
}

/** Two decimals, which is what the measurement is quoted to. */
const ratio = (a: string, b: string) => Math.round(contrast(a, b) * 100) / 100

describe('state/retrying-text', () => {
    it('is declared in every theme, so no theme falls back to an inherited colour', () => {
        expect(declared(light, '--vz-retrying-text'), 'light').toBe('#8a560e')
        expect(declared(darkMedia, '--vz-retrying-text'), 'dark (prefers-color-scheme)').toBe(
            '#e2b04a'
        )
        expect(declared(darkAttr, '--vz-retrying-text'), 'dark (data-theme)').toBe('#e2b04a')
    })

    it('clears 4.5:1 on every ground the amber text is drawn on, in light', () => {
        const text = declared(light, '--vz-retrying-text')!
        const surface = declared(light, '--vz-surface')!
        const retryingBg = declared(light, '--vz-retrying-bg')!
        const ground = declared(light, '--vz-ground')!

        // The exact figures the token was chosen for, pinned so a value change cannot hide behind
        // "still passes".
        expect(ratio(text, surface), 'bg/surface').toBe(5.59)
        expect(ratio(text, retryingBg), 'state/retrying-bg').toBe(5.61)
        expect(ratio(text, ground), 'bg/ground').toBe(6.14)

        for (const bg of [surface, retryingBg, ground]) {
            expect(contrast(text, bg), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5)
        }
    })

    it('clears 4.5:1 on the dark surface too', () => {
        for (const block of [darkMedia, darkAttr]) {
            const text = declared(block, '--vz-retrying-text')!
            const surface = declared(block, '--vz-surface')!
            expect(contrast(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
        }
    })

    it('needed a new token: the amber already in the palette fails as small text', () => {
        // Not a regression — `state/retrying` stays exactly as it was, because it is used for
        // dots and rings rather than for text. This is why the pair exists.
        const amber = declared(light, '--vz-retrying')!
        expect(amber).toBe('#a86a12')
        const surface = declared(light, '--vz-surface')!
        expect(ratio(amber, surface)).toBe(4.03)
        expect(contrast(amber, surface)).toBeLessThan(4.5)
    })
})

describe('state/failed in the dark theme', () => {
    it("uses the library pair, not the render's brighter red", () => {
        expect(declared(darkMedia, '--vz-failed')).toBe('#e5654b')
        expect(declared(darkMedia, '--vz-failed-text')).toBe('#f0a394')
        expect(declared(darkAttr, '--vz-failed')).toBe('#e5654b')
        expect(declared(darkAttr, '--vz-failed-text')).toBe('#f0a394')
        // `#f87171` is deliberately absent from the palette: it is the generative-UI fallback in
        // the WebUI, not a design token, and replacing it globally would break that page.
        expect(css).not.toContain('#f87171')
    })

    it('keeps the failed text readable on the dark surface', () => {
        const text = declared(darkAttr, '--vz-failed-text')!
        const surface = declared(darkAttr, '--vz-surface')!
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
    })
})
