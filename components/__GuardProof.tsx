'use client'
// TEMPORARY — proves the Checks job's lint leg actually fails.
import { useState } from 'react'

export function GuardProof({ flag }: { flag: boolean }) {
  if (flag) {
    // Conditional hook call — react-hooks/rules-of-hooks, an error.
    const [n] = useState(0)
    return <span>{n}</span>
  }
  return <a href="/companies">companies</a>
}
