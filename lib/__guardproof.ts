// TEMPORARY — proves the Checks job actually fails. Removed in the next commit.
export function typeErrorHere(): number {
  return 'this is a string, not a number'
}
export function lintErrorHere() {
  const unused = 1
  return 2
}
