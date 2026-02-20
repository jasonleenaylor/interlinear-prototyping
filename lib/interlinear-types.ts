export interface Occurrence {
  id: string
  text: string
  isPunctuation: boolean
  gloss: string
  morphemeText: string // user-editable text with spaces to split morphemes
  approved: boolean
  linkedWithNext: boolean // whether this occurrence is linked with the next one
}

export interface LinkedGroup {
  occurrences: Occurrence[]
  startIndex: number
}

export function tokenizeText(text: string): Occurrence[] {
  // Split text into words and punctuation, preserving all tokens
  const tokens: string[] = []
  let current = ""

  for (const char of text) {
    const isPunct = /[^\w\s]/.test(char) && char !== "'" && char !== "\u2019" && char !== "-"
    const isSpace = /\s/.test(char)

    if (isSpace) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    if (isPunct) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      tokens.push(char)
    } else {
      current += char
    }
  }
  if (current) {
    tokens.push(current)
  }

  return tokens.map((token, i) => ({
    id: `occ-${i}`,
    text: token,
    isPunctuation: /^[^\w]$/.test(token) && token !== "'" && token !== "\u2019",
    gloss: "",
    morphemeText: token,
    approved: false,
    linkedWithNext: false,
  }))
}

export function getMorphemes(morphemeText: string): string[] {
  const parts = morphemeText.split(/\s+/).filter(Boolean)
  return parts.length > 0 ? parts : [morphemeText]
}

/**
 * Build linked groups: consecutive occurrences where linkedWithNext is true
 * form a single group. Each non-linked occurrence is its own group.
 */
export function buildLinkedGroups(occurrences: Occurrence[]): LinkedGroup[] {
  const groups: LinkedGroup[] = []
  let i = 0

  while (i < occurrences.length) {
    const group: Occurrence[] = [occurrences[i]]
    const startIndex = i

    while (i < occurrences.length - 1 && occurrences[i].linkedWithNext) {
      i++
      group.push(occurrences[i])
    }

    groups.push({ occurrences: group, startIndex })
    i++
  }

  return groups
}
