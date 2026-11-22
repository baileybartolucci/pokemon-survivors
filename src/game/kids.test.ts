import { describe, expect, it } from 'vitest'
import { ENEMIES } from '../data/enemies'
import { WAVE_LEGEND_HP } from '../data/legendBosses'
import { KIDS_STARTERS } from '../data/starters'
import { KIDS_STAGES, scaling } from '../data/waves'
import { hurtPlayer } from './combat'
import { spawnEnemy } from './enemies'
import { chooseOffer, createGame, createKidsGame, step } from './game'
import { runMods } from './legend'
import { gainXp } from './leveling'
import { TICK } from './replay'

const view = { w: 480, h: 270 }
const still = { move: { x: 0, y: 0 }, special: false }

describe('Kids Mode', () => {
  it('uses gentler stats with a rising wave and stat curve', () => {
    const kids = createKidsGame('mudkip', view, 19)
    const regular = createGame('mudkip', view, 19)
    const foe = spawnEnemy(kids, 'rattata', 0, 0)
    const normalFoe = spawnEnemy(regular, 'rattata', 0, 0)
    const mods = runMods(kids)
    expect(foe.maxHp).toBeLessThan(normalFoe.maxHp)
    expect(foe.speed).toBeLessThan(normalFoe.speed)
    expect(mods.spawnRate).toBeLessThan(runMods(regular).spawnRate)
    expect(KIDS_STAGES.map((stage) => stage.rate)).toEqual([1.2, 1.5, 1.9, 2.3])
    expect(scaling(250, mods.ramp).damage).toBeGreaterThan(scaling(0, mods.ramp).damage)
    hurtPlayer(kids, 20)
    hurtPlayer(regular, 20)
    expect(kids.player.stats.maxHp - kids.player.hp).toBeLessThan(regular.player.stats.maxHp - regular.player.hp)
    gainXp(kids, 4, 1)
    gainXp(regular, 4, 1)
    expect(kids.player.level).toBe(2)
    expect(regular.player.level).toBe(1)
  })

  it.each(KIDS_STARTERS)('%s evolves twice and wins with automatic attacks', (starter) => {
    const g = createKidsGame(starter, view, 42)
    const evolvedAt: number[] = []
    const bossAt: number[] = []
    let specials = 0
    let picks = 0
    for (let frame = 0; frame < 25_000 && g.phase !== 'victory' && g.phase !== 'gameover'; frame++) {
      if (g.phase === 'levelup' || g.phase === 'ability' || g.phase === 'pokeball' || g.phase === 'tm' || g.phase === 'branch') {
        expect(g.player.offers.length).toBeGreaterThan(0)
        chooseOffer(g, g.player.offers[0]!)
        picks++
      } else {
        step(g, still, TICK)
      }
      for (const e of g.events.splice(0)) {
        if (e.kind === 'evolved') evolvedAt.push(g.time)
        if (e.kind === 'boss') bossAt.push(g.time)
        if (e.kind === 'special') specials++
      }
    }
    expect(evolvedAt).toHaveLength(2)
    expect(evolvedAt[0]).toBeCloseTo(120, 1)
    expect(evolvedAt[1]).toBeCloseTo(210, 1)
    expect(picks).toBeGreaterThanOrEqual(8)
    expect(specials).toBeGreaterThan(0)
    expect(bossAt).toHaveLength(2)
    expect(bossAt[0]).toBeCloseTo(90, 1)
    expect(bossAt[1]).toBeCloseTo(270, 1)
    expect(g.phase).toBe('victory')
    expect(g.time).toBeLessThanOrEqual(300)
  })

  it('ends at five minutes if Mewtwo is still alive', () => {
    const g = createKidsGame('treecko', view, 18)
    g.time = 300 - TICK
    g.nextEvent = 2
    const boss = spawnEnemy(g, 'mewtwo', 200, 200)
    step(g, still, TICK)
    expect(g.time).toBe(300)
    expect(g.phase).toBe('gameover')
    expect(boss.hp).toBe(boss.maxHp)
    expect(g.events.some((e) => e.kind === 'victory')).toBe(false)
  })

  it('keeps the standard 15-minute finale and its full boss health', () => {
    const g = createGame('treecko', view, 42)
    g.nextEvent = g.roster.events.length - 2
    g.time = 899.99
    step(g, still, TICK)
    expect(g.enemies.find((e) => e.kind === 'mewtwo')?.maxHp).toBe(ENEMIES.mewtwo.hp * WAVE_LEGEND_HP)
    expect(g.phase).toBe('playing')
  })
})
